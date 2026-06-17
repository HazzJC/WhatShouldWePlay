"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { addGameToSession, importSteamGamesForUser, upsertGame } from "@/lib/games";
import { prisma } from "@/lib/prisma";
import { dateRangeFromPreset, type DatePreset } from "@/lib/scheduling";
import { getOwnedSteamGames, getRecentlyPlayedSteamGames } from "@/lib/steam";
import { createShareToken } from "@/lib/tokens";

const createSessionSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    hostName: z.string().trim().min(1).max(80),
    mode: z.enum(["ONLINE", "IN_PERSON"]),
    requiredDuration: z.coerce.number().int().min(1).max(8),
    minimumPlayerCount: z.coerce.number().int().min(2).max(30),
    datePreset: z.enum(["tonight", "this_week", "this_month"]),
    dailyStartHour: z.coerce.number().int().min(0).max(23),
    dailyEndHour: z.coerce.number().int().min(1).max(24),
    separateWeekendTimes: z.boolean().default(false),
    weekendStartHour: z.coerce.number().int().min(0).max(23).optional(),
    weekendEndHour: z.coerce.number().int().min(1).max(24).optional(),
    timezone: z.string().trim().min(1).max(80),
    discordChannel: z.string().trim().max(120).optional(),
    reminders: z.array(z.string()).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.dailyEndHour - value.dailyStartHour < value.requiredDuration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Daily window must fit the session duration.",
        path: ["dailyEndHour"],
      });
    }

    if (!value.separateWeekendTimes) {
      return;
    }

    if (value.weekendStartHour === undefined || value.weekendEndHour === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose weekend start and finish times.",
        path: ["weekendStartHour"],
      });
      return;
    }

    if (value.weekendEndHour - value.weekendStartHour < value.requiredDuration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Weekend window must fit the session duration.",
        path: ["weekendEndHour"],
      });
    }
  });

export async function createSessionAction(formData: FormData) {
  const parsed = createSessionSchema.safeParse({
    title: formData.get("title"),
    hostName: formData.get("hostName"),
    mode: formData.get("mode"),
    requiredDuration: formData.get("requiredDuration"),
    minimumPlayerCount: formData.get("minimumPlayerCount"),
    datePreset: formData.get("datePreset"),
    dailyStartHour: formData.get("dailyStartHour"),
    dailyEndHour: formData.get("dailyEndHour"),
    separateWeekendTimes: formData.get("separateWeekendTimes") === "on",
    weekendStartHour: formData.get("weekendStartHour") || undefined,
    weekendEndHour: formData.get("weekendEndHour") || undefined,
    timezone: formData.get("timezone"),
    discordChannel: formData.get("discordChannel") || undefined,
    reminders: formData.getAll("reminders"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create the session.");
  }

  const values = parsed.data;
  const dateRange = dateRangeFromPreset(values.datePreset as DatePreset, values.timezone);
  const session = await prisma.session.create({
    data: {
      title: values.title,
      shareToken: createShareToken(),
      mode: values.mode,
      requiredDuration: values.requiredDuration,
      minimumPlayerCount: values.minimumPlayerCount,
      dateRangeStart: fromZonedTime(`${dateRange.startsOn}T00:00:00`, values.timezone),
      dateRangeEnd: fromZonedTime(`${dateRange.endsOn}T00:00:00`, values.timezone),
      dailyStartHour: values.dailyStartHour,
      dailyEndHour: values.dailyEndHour,
      weekendStartHour: values.separateWeekendTimes ? values.weekendStartHour : null,
      weekendEndHour: values.separateWeekendTimes ? values.weekendEndHour : null,
      timezone: values.timezone,
      discordChannel: values.discordChannel || null,
      reminderPreferences: values.reminders,
      participants: {
        create: {
          name: values.hostName,
          isHost: true,
        },
      },
    },
    include: {
      participants: true,
    },
  });

  const host = session.participants[0];
  redirect(`/s/${session.shareToken}?participant=${host.id}`);
}

const submitAvailabilitySchema = z.object({
  shareToken: z.string().min(1),
  participantId: z.string().optional(),
  participantName: z.string().trim().min(1).max(80),
});

export async function submitAvailabilityAction(formData: FormData) {
  const parsed = submitAvailabilitySchema.safeParse({
    shareToken: formData.get("shareToken"),
    participantId: formData.get("participantId") || undefined,
    participantName: formData.get("participantName"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not save availability.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: { id: true, shareToken: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  const existingParticipant = parsed.data.participantId
    ? await prisma.participant.findFirst({
        where: { id: parsed.data.participantId, sessionId: session.id },
      })
    : null;

  const participant = existingParticipant
    ? await prisma.participant.update({
        where: { id: existingParticipant.id },
        data: { name: parsed.data.participantName },
      })
    : await prisma.participant.create({
        data: {
          sessionId: session.id,
          name: parsed.data.participantName,
        },
      });

  const responses = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("status:"))
    .map(([key, value]) => ({
      slotStart: new Date(key.replace("status:", "")),
      slotEnd: new Date(new Date(key.replace("status:", "")).getTime() + 60 * 60 * 1000),
      status: String(value) as "AVAILABLE" | "MAYBE" | "UNAVAILABLE",
    }))
    .filter((response) => ["AVAILABLE", "MAYBE", "UNAVAILABLE"].includes(response.status));

  const writes = [
    prisma.availabilityResponse.deleteMany({
      where: { participantId: participant.id },
    }),
  ];

  if (responses.length > 0) {
    writes.push(
      prisma.availabilityResponse.createMany({
        data: responses.map((response) => ({
          participantId: participant.id,
          slotStart: response.slotStart,
          slotEnd: response.slotEnd,
          status: response.status,
        })),
      }),
    );
  }

  await prisma.$transaction(writes);

  revalidatePath(`/s/${session.shareToken}`);
  redirect(`/s/${session.shareToken}?participant=${participant.id}`);
}

const lockSessionSchema = z.object({
  shareToken: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function lockSessionAction(formData: FormData) {
  const parsed = lockSessionSchema.safeParse({
    shareToken: formData.get("shareToken"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not lock the session.");
  }

  await prisma.session.update({
    where: { shareToken: parsed.data.shareToken },
    data: {
      lockedStartTime: new Date(parsed.data.startsAt),
      lockedEndTime: new Date(parsed.data.endsAt),
    },
  });

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const addSessionGameSchema = z.object({
  shareToken: z.string().min(1),
  participantId: z.string().optional(),
  title: z.string().trim().min(1).max(180),
  source: z
    .enum(["MANUAL", "IGDB_SEARCH", "POPULAR", "TRENDING", "COMMON", "FRIEND_ADDED"])
    .default("MANUAL"),
  gameId: z.string().optional(),
  igdbId: z.coerce.number().int().positive().optional(),
  steamAppId: z.coerce.number().int().positive().optional(),
  coverUrl: z.string().trim().max(500).optional(),
  summary: z.string().trim().max(1200).optional(),
  popularityScore: z.coerce.number().optional(),
});

export async function addSessionGameAction(formData: FormData) {
  const parsed = addSessionGameSchema.safeParse({
    shareToken: formData.get("shareToken"),
    participantId: formData.get("participantId") || undefined,
    title: formData.get("title"),
    source: formData.get("source") || "MANUAL",
    gameId: formData.get("gameId") || undefined,
    igdbId: formData.get("igdbId") || undefined,
    steamAppId: formData.get("steamAppId") || undefined,
    coverUrl: formData.get("coverUrl") || undefined,
    summary: formData.get("summary") || undefined,
    popularityScore: formData.get("popularityScore") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not add game.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: { id: true, shareToken: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  const participant = parsed.data.participantId
    ? await prisma.participant.findFirst({
        where: { id: parsed.data.participantId, sessionId: session.id },
        select: { id: true, userId: true },
      })
    : null;
  const currentUser = await getCurrentUser();
  const game = parsed.data.gameId
    ? await prisma.game.findUniqueOrThrow({ where: { id: parsed.data.gameId } })
    : await upsertGame({
        title: parsed.data.title,
        igdbId: parsed.data.igdbId,
        steamAppId: parsed.data.steamAppId,
        coverUrl: parsed.data.coverUrl,
        summary: parsed.data.summary,
        popularityScore: parsed.data.popularityScore,
      });

  await addGameToSession({
    sessionId: session.id,
    gameId: game.id,
    participantId: participant?.id,
    userId: currentUser?.id ?? participant?.userId,
    source: parsed.data.source,
    signal: "AVAILABLE_TO_PLAY",
  });

  revalidatePath(`/s/${session.shareToken}`);
}

const removeSessionGameSchema = z.object({
  shareToken: z.string().min(1),
  sessionGameId: z.string().min(1),
});

export async function removeSessionGameAction(formData: FormData) {
  const parsed = removeSessionGameSchema.safeParse({
    shareToken: formData.get("shareToken"),
    sessionGameId: formData.get("sessionGameId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not remove game.");
  }

  await prisma.sessionGame.deleteMany({
    where: {
      id: parsed.data.sessionGameId,
      session: { shareToken: parsed.data.shareToken },
    },
  });

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const markGameAvailableSchema = z.object({
  shareToken: z.string().min(1),
  sessionGameId: z.string().min(1),
  participantId: z.string().min(1),
  signal: z.enum(["OWNED", "AVAILABLE_TO_PLAY", "NOT_AVAILABLE"]),
});

export async function markGameAvailableAction(formData: FormData) {
  const parsed = markGameAvailableSchema.safeParse({
    shareToken: formData.get("shareToken"),
    sessionGameId: formData.get("sessionGameId"),
    participantId: formData.get("participantId"),
    signal: formData.get("signal"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not update game.");
  }

  const sessionGame = await prisma.sessionGame.findFirst({
    where: {
      id: parsed.data.sessionGameId,
      session: { shareToken: parsed.data.shareToken },
    },
    select: { id: true, sessionId: true },
  });

  if (!sessionGame) {
    throw new Error("Game not found.");
  }

  const participant = await prisma.participant.findFirst({
    where: { id: parsed.data.participantId, sessionId: sessionGame.sessionId },
    select: { id: true },
  });

  if (!participant) {
    throw new Error("Participant not found.");
  }

  await prisma.sessionGameSignal.upsert({
    where: {
      sessionGameId_participantId: {
        sessionGameId: sessionGame.id,
        participantId: participant.id,
      },
    },
    create: {
      sessionGameId: sessionGame.id,
      participantId: participant.id,
      signal: parsed.data.signal,
    },
    update: { signal: parsed.data.signal },
  });

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const importSteamLibrarySchema = z.object({
  shareToken: z.string().min(1),
  participantId: z.string().optional(),
});

export async function importSteamLibraryAction(formData: FormData) {
  const parsed = importSteamLibrarySchema.safeParse({
    shareToken: formData.get("shareToken"),
    participantId: formData.get("participantId") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not import Steam library.");
  }

  const currentUser = await getCurrentUser();

  if (!currentUser?.steamAccount) {
    throw new Error("Connect Steam before importing your library.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: { id: true, shareToken: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  const participant = parsed.data.participantId
    ? await prisma.participant.findFirst({
        where: { id: parsed.data.participantId, sessionId: session.id },
        select: { id: true },
      })
    : null;
  const owned = await getOwnedSteamGames(currentUser.steamAccount.steamId);
  const recent = await getRecentlyPlayedSteamGames(currentUser.steamAccount.steamId);

  await importSteamGamesForUser(currentUser.id, owned.games, recent);

  if (participant) {
    const importedGames = await prisma.userGame.findMany({
      where: { userId: currentUser.id },
      include: { game: true },
      orderBy: [{ recentlyPlayedAt: "desc" }, { playtimeMinutes: "desc" }],
      take: 40,
    });

    for (const userGame of importedGames) {
      await addGameToSession({
        sessionId: session.id,
        gameId: userGame.gameId,
        participantId: participant.id,
        userId: currentUser.id,
        source: "STEAM_MATCH",
        signal: "OWNED",
      });
    }
  }

  await prisma.steamAccount.update({
    where: { userId: currentUser.id },
    data: {
      lastImportAt: new Date(),
      lastImportStatus: owned.status,
    },
  });

  revalidatePath(`/s/${session.shareToken}`);
}
