"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import {
  getCurrentUser,
  getHostParticipantId,
  resolveActingParticipantId,
  setParticipantIdentity,
} from "@/lib/auth";
import { announceLockedSessionToDiscord, normalizeReminderPreferences } from "@/lib/discord";
import { curatedGames, getCuratedGame } from "@/lib/curated-games";
import { mergeCuratedMetadata } from "@/lib/curated-metadata";
import { addGameToSession, importSteamGamesForUser, upsertGame } from "@/lib/games";
import { getIgdbGameById, mapIgdbGame } from "@/lib/igdb";
import { prisma } from "@/lib/prisma";
import { dateRangeFromPreset, generateCandidateWindows, generateHourlySlots, type DatePreset } from "@/lib/scheduling";
import { getOwnedSteamGames, getRecentlyPlayedSteamGames } from "@/lib/steam";
import { createShareToken } from "@/lib/tokens";

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(isValidTimeZone, { message: "Choose a valid timezone." });

// Confirms the caller holds the signed host cookie for this session. The public
// share token is not enough to perform host-only actions (lock, remove game,
// deal settings, price alerts) — otherwise anyone the link reaches could do them.
async function requireHostParticipant(sessionId: string) {
  const hostParticipantId = await getHostParticipantId(sessionId);

  if (hostParticipantId) {
    const host = await prisma.participant.findFirst({
      where: { id: hostParticipantId, sessionId, isHost: true },
      select: { id: true },
    });

    if (host) {
      return host.id;
    }
  }

  const currentUser = await getCurrentUser();
  if (currentUser) {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [
          { participants: { some: { userId: currentUser.id, isHost: true } } },
          { gameNight: { ownerUserId: currentUser.id } },
        ],
      },
      select: { participants: { where: { isHost: true }, select: { id: true }, take: 1 } },
    });
    if (session?.participants[0]) return session.participants[0].id;
  }

  throw new Error(
    "Only the session host can do this. Open the session on the device that created it.",
  );
}

const createSessionSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    hostName: z.string().trim().min(1).max(80),
    mode: z.enum(["ONLINE", "IN_PERSON"]),
    requiredDuration: z.coerce.number().int().min(1).max(8),
    minimumPlayerCount: z.coerce.number().int().min(2).max(30),
    datePreset: z.enum(["tonight", "this_week", "this_month", "custom"]),
    customStartDate: z.string().date().optional(),
    customEndDate: z.string().date().optional(),
    dailyStartHour: z.coerce.number().int().min(0).max(23),
    dailyEndHour: z.coerce.number().int().min(1).max(24),
    separateWeekendTimes: z.boolean().default(false),
    weekendStartHour: z.coerce.number().int().min(0).max(23).optional(),
    weekendEndHour: z.coerce.number().int().min(1).max(24).optional(),
    timezone: timezoneSchema,
    discordChannel: z.string().trim().max(120).optional(),
    reminders: z.array(z.string()).default([]),
    remindersEnabled: z.boolean().default(false),
    gameNightId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dailyEndHour - value.dailyStartHour < value.requiredDuration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Daily window must fit the session duration.",
        path: ["dailyEndHour"],
      });
    }

    if (value.datePreset === "custom") {
      if (!value.customStartDate || !value.customEndDate || value.customEndDate < value.customStartDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choose a valid custom date range.",
          path: ["customEndDate"],
        });
      }

      if (
        value.customStartDate &&
        value.customEndDate &&
        differenceInCalendarDays(parseISO(value.customEndDate), parseISO(value.customStartDate)) > 31
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Custom date ranges can cover at most 32 days.",
          path: ["customEndDate"],
        });
      }
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
  const currentUser = await getCurrentUser();
  const parsed = createSessionSchema.safeParse({
    title: formData.get("title"),
    hostName: formData.get("hostName"),
    mode: formData.get("mode"),
    requiredDuration: formData.get("requiredDuration"),
    minimumPlayerCount: formData.get("minimumPlayerCount"),
    datePreset: formData.get("datePreset"),
    customStartDate: formData.get("customStartDate") || undefined,
    customEndDate: formData.get("customEndDate") || undefined,
    dailyStartHour: formData.get("dailyStartHour"),
    dailyEndHour: formData.get("dailyEndHour"),
    separateWeekendTimes: formData.get("separateWeekendTimes") === "on",
    weekendStartHour: formData.get("weekendStartHour") || undefined,
    weekendEndHour: formData.get("weekendEndHour") || undefined,
    timezone: formData.get("timezone"),
    discordChannel: formData.get("discordChannel") || undefined,
    remindersEnabled: formData.get("remindersEnabled") === "on",
    reminders: [
      ...formData.getAll("reminders").map(String),
      formData.get("customReminderMinutes") ? `Custom:${formData.get("customReminderMinutes")}` : "",
    ].filter(Boolean),
    gameNightId: formData.get("gameNightId") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create the session.");
  }

  const values = parsed.data;
  if (currentUser) {
    await prisma.user.update({ where: { id: currentUser.id }, data: { timezone: values.timezone } });
  }
  if (values.gameNightId) {
    if (!currentUser) throw new Error("Sign in as the Game Night host to add Plan.");
    const target = await prisma.gameNight.findFirst({
      where: { id: values.gameNightId, ownerUserId: currentUser.id, workspaces: { none: { workspaceType: "PLAN" } } },
      select: { id: true },
    });
    if (!target) throw new Error("This Game Night cannot accept another Plan workspace.");
  }
  const dateRange = values.datePreset === "custom"
    ? { startsOn: values.customStartDate!, endsOn: values.customEndDate! }
    : dateRangeFromPreset(values.datePreset as DatePreset, values.timezone);
  const gameNightShareToken = createShareToken();
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
      reminderPreferences: normalizeReminderPreferences(values.remindersEnabled ? values.reminders : []),
      workspaceType: "PLAN",
      gameNight: values.gameNightId
        ? { connect: { id: values.gameNightId } }
        : {
            create: {
              title: values.title,
              shareToken: gameNightShareToken,
              ownerUserId: currentUser?.id,
            },
          },
      participants: {
        create: {
          name: values.hostName,
          userId: currentUser?.id,
          isHost: true,
        },
      },
    },
    include: {
      participants: true,
    },
  });

  const host = session.participants[0];
  await setParticipantIdentity(session.id, host.id, { isHost: true });
  redirect(`/s/${session.shareToken}?participant=${host.id}`);
}

const createPickSessionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  hostName: z.string().trim().min(1).max(80),
  timezone: timezoneSchema.default("Europe/London"),
  initialGameSlug: z.string().trim().max(120).optional(),
  gameNightId: z.string().min(1).optional(),
});

export async function createPickSessionAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser?.username || !currentUser.onboardingCompletedAt) {
    redirect("/account?returnTo=%2Fsessions%2Fpick");
  }

  const parsed = createPickSessionSchema.safeParse({
    title: formData.get("title"),
    hostName: formData.get("hostName"),
    timezone: formData.get("timezone") || "Europe/London",
    initialGameSlug: formData.get("initialGameSlug") || undefined,
    gameNightId: formData.get("gameNightId") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create the pick session.");
  }

  const values = parsed.data;
  await prisma.user.update({ where: { id: currentUser.id }, data: { timezone: values.timezone } });
  if (values.gameNightId) {
    const target = await prisma.gameNight.findFirst({
      where: { id: values.gameNightId, ownerUserId: currentUser.id, workspaces: { none: { workspaceType: "PICK" } } },
      select: { id: true },
    });
    if (!target) throw new Error("This Game Night cannot accept another Pick workspace.");
  }
  const dateRange = dateRangeFromPreset("this_week", values.timezone);
  const gameNightShareToken = createShareToken();
  const session = await prisma.session.create({
    data: {
      title: values.title,
      shareToken: createShareToken(),
      mode: "ONLINE",
      requiredDuration: 2,
      minimumPlayerCount: 2,
      dateRangeStart: fromZonedTime(`${dateRange.startsOn}T00:00:00`, values.timezone),
      dateRangeEnd: fromZonedTime(`${dateRange.endsOn}T00:00:00`, values.timezone),
      dailyStartHour: 18,
      dailyEndHour: 23,
      timezone: values.timezone,
      dealCountry: "GB",
      dealCurrency: "GBP",
      reminderPreferences: [],
      workspaceType: "PICK",
      gameNight: values.gameNightId
        ? { connect: { id: values.gameNightId } }
        : {
            create: {
              title: values.title,
              shareToken: gameNightShareToken,
              ownerUserId: currentUser.id,
            },
          },
      participants: {
        create: {
          name: currentUser.displayName,
          userId: currentUser.id,
          isHost: true,
        },
      },
    },
    include: {
      participants: true,
    },
  });
  const host = session.participants[0];
  await setParticipantIdentity(session.id, host.id, { isHost: true });
  const initialGame = values.initialGameSlug ? getCuratedGame(values.initialGameSlug) : null;

  if (initialGame) {
    const game = await upsertGame(mergeCuratedMetadata(initialGame));

    await addGameToSession({
      sessionId: session.id,
      gameId: game.id,
      participantId: host.id,
      userId: currentUser.id,
      source: "COMMON",
      signal: "OWNED",
    });
  }

  redirect(`/s/${session.shareToken}?tab=pick&participant=${host.id}`);
}

const submitAvailabilitySchema = z.object({
  shareToken: z.string().min(1),
  participantId: z.string().optional(),
  participantName: z.string().trim().min(1).max(80),
});

export async function submitAvailabilityAction(formData: FormData) {
  const currentUser = await getCurrentUser();
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
    select: {
      id: true,
      shareToken: true,
      workspaceType: true,
      dateRangeStart: true,
      dateRangeEnd: true,
      dailyStartHour: true,
      dailyEndHour: true,
      weekendStartHour: true,
      weekendEndHour: true,
      requiredDuration: true,
      minimumPlayerCount: true,
      timezone: true,
    },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  // Only let the caller edit a participant they actually own (proven by the
  // signed per-session cookie). A form-supplied id without a matching cookie is
  // ignored so a link-holder cannot overwrite someone else's availability.
  if (session.workspaceType !== "PLAN") {
    throw new Error("Availability can only be saved in a Plan workspace.");
  }

  const actingParticipantId = await resolveActingParticipantId(session.id, parsed.data.participantId);
  const existingParticipant = actingParticipantId
    ? await prisma.participant.findFirst({
        where: { id: actingParticipantId, sessionId: session.id },
      })
    : null;

  const participant = existingParticipant
    ? await prisma.participant.update({
        where: { id: existingParticipant.id },
        data: {
          name: parsed.data.participantName,
          userId: existingParticipant.userId ?? currentUser?.id,
        },
      })
    : await prisma.participant.create({
        data: {
          sessionId: session.id,
          name: parsed.data.participantName,
          userId: currentUser?.id,
        },
      });

  await setParticipantIdentity(session.id, participant.id);

  const allowedSlots = new Set(generateHourlySlots(session).map((slot) => slot.startsAt.toISOString()));
  const rawResponses = Array.from(formData.entries()).filter(([key]) => key.startsWith("status:"));
  if (rawResponses.length > allowedSlots.size || rawResponses.length > 800) {
    throw new Error("Too many availability slots were submitted.");
  }
  const seenSlots = new Set<string>();
  const responses = rawResponses.map(([key, value]) => {
    const slotKey = key.replace("status:", "");
    if (!allowedSlots.has(slotKey) || seenSlots.has(slotKey)) {
      throw new Error("Availability contained an invalid or duplicate time slot.");
    }
    seenSlots.add(slotKey);
    const status = String(value);
    if (!["AVAILABLE", "MAYBE", "UNAVAILABLE"].includes(status)) {
      throw new Error("Availability contained an invalid status.");
    }
    const slotStart = new Date(slotKey);
    return {
      slotStart,
      slotEnd: new Date(slotStart.getTime() + 60 * 60 * 1000),
      status: status as "AVAILABLE" | "MAYBE" | "UNAVAILABLE",
    };
  });

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
  await touchGameNight(session.id);

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

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);

  if (endsAt <= startsAt) {
    throw new Error("The session end time must be after the start time.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: {
      id: true,
      workspaceType: true,
      dateRangeStart: true,
      dateRangeEnd: true,
      dailyStartHour: true,
      dailyEndHour: true,
      weekendStartHour: true,
      weekendEndHour: true,
      requiredDuration: true,
      minimumPlayerCount: true,
      timezone: true,
    },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  if (session.workspaceType !== "PLAN") {
    throw new Error("Times can only be locked in a Plan workspace.");
  }

  await requireHostParticipant(session.id);
  const validCandidate = generateCandidateWindows(session).some(
    (candidate) => candidate.startsAt.getTime() === startsAt.getTime() && candidate.endsAt.getTime() === endsAt.getTime(),
  );
  if (!validCandidate) {
    throw new Error("Choose a valid time from this Plan workspace.");
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      lockedStartTime: startsAt,
      lockedEndTime: endsAt,
    },
  });
  await touchGameNight(session.id);

  await announceLockedSessionToDiscord(parsed.data.shareToken);

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
  genres: z.string().optional(),
  platforms: z.string().optional(),
  gameModes: z.string().optional(),
  minPlayers: z.coerce.number().int().positive().optional(),
  maxPlayers: z.coerce.number().int().positive().optional(),
  onlineCoop: z.enum(["true", "false"]).optional(),
  localCoop: z.enum(["true", "false"]).optional(),
  capabilitySource: z.string().trim().max(120).optional(),
  capabilityConfidence: z.coerce.number().min(0).max(1).optional(),
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
    genres: formData.get("genres") || undefined,
    platforms: formData.get("platforms") || undefined,
    gameModes: formData.get("gameModes") || undefined,
    minPlayers: formData.get("minPlayers") || undefined,
    maxPlayers: formData.get("maxPlayers") || undefined,
    onlineCoop: formData.get("onlineCoop") || undefined,
    localCoop: formData.get("localCoop") || undefined,
    capabilitySource: formData.get("capabilitySource") || undefined,
    capabilityConfidence: formData.get("capabilityConfidence") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not add game.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: { id: true, shareToken: true, workspaceType: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  if (session.workspaceType !== "PICK") {
    throw new Error("Games can only be added in a Pick workspace.");
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("Sign in to add games.");
  }
  const actingParticipantId = await resolveActingParticipantId(session.id, parsed.data.participantId);
  const participant = actingParticipantId
    ? await prisma.participant.findFirst({
        where: { id: actingParticipantId, sessionId: session.id, userId: currentUser.id },
        select: { id: true, userId: true },
      })
    : null;
  if (!participant) {
    throw new Error("Join this Pick workspace before adding games.");
  }

  const game = parsed.data.gameId
    ? await prisma.game.findUniqueOrThrow({ where: { id: parsed.data.gameId }, select: { id: true } })
    : await resolveCanonicalGame(parsed.data);

  await addGameToSession({
    sessionId: session.id,
    gameId: game.id,
    participantId: participant?.id,
    userId: currentUser.id,
    source: parsed.data.source,
    signal: "OWNED",
  });
  if (currentUser) {
    await prisma.userGame.upsert({
      where: { userId_gameId: { userId: currentUser.id, gameId: game.id } },
      create: {
        userId: currentUser.id,
        gameId: game.id,
        source: parsed.data.source === "IGDB_SEARCH" ? "IGDB" : "MANUAL",
        ownership: "HAVE",
      },
      update: { ownership: "HAVE" },
    });
  }
  await touchGameNight(session.id);

  revalidatePath(`/s/${session.shareToken}`);
}

async function resolveCanonicalGame(input: z.infer<typeof addSessionGameSchema>) {
  if (input.igdbId) {
    const result = await getIgdbGameById(input.igdbId);
    if (!result) throw new Error("That IGDB game could not be verified.");
    return upsertGame(mergeCuratedMetadata(mapIgdbGame(result)));
  }

  if (input.steamAppId) {
    const existing = await prisma.game.findUnique({
      where: { steamAppId: input.steamAppId },
      select: { id: true },
    });
    if (!existing) throw new Error("Import or search for that Steam game before adding it.");
    return existing;
  }

  if (input.source !== "MANUAL") {
    const curated = curatedGames.find((candidate) => candidate.title === input.title);
    if (!curated) throw new Error("Choose a verified catalog game.");
    return upsertGame(mergeCuratedMetadata(curated));
  }

  return upsertGame({ title: input.title });
}

async function touchGameNight(sessionId: string) {
  await prisma.gameNight.updateMany({
    where: { workspaces: { some: { id: sessionId } } },
    data: { lastActivityAt: new Date() },
  });
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

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: { id: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  await requireHostParticipant(session.id);

  await prisma.sessionGame.deleteMany({
    where: {
      id: parsed.data.sessionGameId,
      sessionId: session.id,
    },
  });
  await touchGameNight(session.id);

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const markGameAvailableSchema = z.object({
  shareToken: z.string().min(1),
  sessionGameId: z.string().min(1),
  participantId: z.string().min(1),
  signal: z.enum(["OWNED", "NOT_AVAILABLE"]),
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
    select: { id: true, sessionId: true, gameId: true },
  });

  if (!sessionGame) {
    throw new Error("Game not found.");
  }

  const actingParticipantId = await resolveActingParticipantId(
    sessionGame.sessionId,
    parsed.data.participantId,
  );
  const participant = actingParticipantId
    ? await prisma.participant.findFirst({
        where: { id: actingParticipantId, sessionId: sessionGame.sessionId },
        select: { id: true, userId: true },
      })
    : null;

  if (!participant) {
    throw new Error("Participant not found.");
  }

  const currentUser = await getCurrentUser();

  if (!currentUser || participant.userId !== currentUser.id) {
    throw new Error("Sign in as this participant to update persistent ownership.");
  }

  await prisma.$transaction([
    prisma.sessionGameSignal.upsert({
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
    }),
    prisma.userGame.upsert({
      where: {
        userId_gameId: {
          userId: currentUser.id,
          gameId: sessionGame.gameId,
        },
      },
      create: {
        userId: currentUser.id,
        gameId: sessionGame.gameId,
        source: "MANUAL",
        ownership: parsed.data.signal === "OWNED" ? "HAVE" : "DONT_HAVE",
      },
      update: {
        ownership: parsed.data.signal === "OWNED" ? "HAVE" : "DONT_HAVE",
      },
    }),
  ]);
  await touchGameNight(sessionGame.sessionId);

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const markGameInterestSchema = z.object({
  shareToken: z.string().min(1),
  sessionGameId: z.string().min(1),
  participantId: z.string().min(1),
  interest: z.enum(["WANT_TO_PLAY", "NEUTRAL", "NOT_TONIGHT"]),
});

export async function markGameInterestAction(formData: FormData) {
  const parsed = markGameInterestSchema.safeParse({
    shareToken: formData.get("shareToken"),
    sessionGameId: formData.get("sessionGameId"),
    participantId: formData.get("participantId"),
    interest: formData.get("interest"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not update game interest.");
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

  const actingParticipantId = await resolveActingParticipantId(
    sessionGame.sessionId,
    parsed.data.participantId,
  );
  const participant = actingParticipantId
    ? await prisma.participant.findFirst({
        where: { id: actingParticipantId, sessionId: sessionGame.sessionId },
        select: { id: true },
      })
    : null;

  if (!participant) {
    throw new Error("Participant not found.");
  }

  await prisma.sessionGameInterest.upsert({
    where: {
      sessionGameId_participantId: {
        sessionGameId: sessionGame.id,
        participantId: participant.id,
      },
    },
    create: {
      sessionGameId: sessionGame.id,
      participantId: participant.id,
      interest: parsed.data.interest,
    },
    update: { interest: parsed.data.interest },
  });
  await touchGameNight(sessionGame.sessionId);

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const preferenceSchema = z.object({
  shareToken: z.string().min(1),
  participantId: z.string().optional(),
  familiarVsNew: z.coerce.number().int().min(0).max(100),
  coOpVsCompetitive: z.coerce.number().int().min(0).max(100),
  priceImportance: z.coerce.number().int().min(0).max(100),
  genreImportance: z.coerce.number().int().min(0).max(100),
  ownershipImportance: z.coerce.number().int().min(0).max(100),
  backlogImportance: z.coerce.number().int().min(0).max(100),
  shortVsLong: z.coerce.number().int().min(0).max(100),
  chillVsIntense: z.coerce.number().int().min(0).max(100),
});

export async function updatePreferenceAction(formData: FormData) {
  const parsed = preferenceSchema.safeParse({
    shareToken: formData.get("shareToken"),
    participantId: formData.get("participantId") || undefined,
    familiarVsNew: formData.get("familiarVsNew"),
    coOpVsCompetitive: formData.get("coOpVsCompetitive"),
    priceImportance: formData.get("priceImportance"),
    genreImportance: formData.get("genreImportance"),
    ownershipImportance: formData.get("ownershipImportance"),
    backlogImportance: formData.get("backlogImportance"),
    shortVsLong: formData.get("shortVsLong"),
    chillVsIntense: formData.get("chillVsIntense"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not save preferences.");
  }

  const { shareToken, participantId, ...values } = parsed.data;
  const session = await prisma.session.findUnique({ where: { shareToken }, select: { id: true } });
  if (!session) throw new Error("Session not found.");

  const actingParticipantId = await resolveActingParticipantId(session.id, participantId);
  const participant = actingParticipantId
    ? await prisma.participant.findFirst({
        where: { id: actingParticipantId, sessionId: session.id },
        select: { id: true, userId: true },
      })
    : null;
  if (!participant) throw new Error("Participant identity could not be verified.");

  const currentUser = await getCurrentUser();
  if (currentUser && participant.userId === currentUser.id) {
    await prisma.userPreference.upsert({
      where: { userId: currentUser.id },
      create: { userId: currentUser.id, ...values },
      update: values,
    });
  } else if (!participant.userId) {
    await prisma.participantPreference.upsert({
      where: { participantId: participant.id },
      create: { participantId: participant.id, ...values },
      update: values,
    });
  } else {
    throw new Error("Sign in as this participant to update preferences.");
  }
  await touchGameNight(session.id);

  revalidatePath(`/s/${shareToken}`);
}

const quickPreferenceSchema = z.object({
  shareToken: z.string().min(1),
  participantId: z.string().min(1),
  coOpVsCompetitive: z.coerce.number().int().min(0).max(100).optional(),
  familiarVsNew: z.coerce.number().int().min(0).max(100).optional(),
  dismiss: z.boolean().default(false),
});

export async function updateQuickPreferenceAction(formData: FormData) {
  const parsed = quickPreferenceSchema.safeParse({
    shareToken: formData.get("shareToken"),
    participantId: formData.get("participantId"),
    coOpVsCompetitive: formData.get("coOpVsCompetitive") || undefined,
    familiarVsNew: formData.get("familiarVsNew") || undefined,
    dismiss: formData.get("dismiss") === "true",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not save quick preferences.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: { id: true },
  });
  if (!session) throw new Error("Session not found.");
  const actingParticipantId = await resolveActingParticipantId(session.id, parsed.data.participantId);
  const participant = actingParticipantId
    ? await prisma.participant.findFirst({
        where: { id: actingParticipantId, sessionId: session.id },
        select: { id: true, userId: true },
      })
    : null;

  if (!participant) {
    throw new Error("Participant not found.");
  }

  if (parsed.data.dismiss) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { preferenceNudgeDismissedAt: new Date() },
    });
  } else {
    const currentUser = await getCurrentUser();
    const values = {
      coOpVsCompetitive: parsed.data.coOpVsCompetitive,
      familiarVsNew: parsed.data.familiarVsNew,
    };

    if (currentUser && participant.userId === currentUser.id) {
      await prisma.userPreference.upsert({
        where: { userId: currentUser.id },
        create: {
          userId: currentUser.id,
          coOpVsCompetitive: values.coOpVsCompetitive ?? 75,
          familiarVsNew: values.familiarVsNew ?? 50,
        },
        update: values,
      });
    } else if (!participant.userId) {
      await prisma.participantPreference.upsert({
        where: { participantId: participant.id },
        create: {
          participantId: participant.id,
          coOpVsCompetitive: values.coOpVsCompetitive ?? 75,
          familiarVsNew: values.familiarVsNew ?? 50,
        },
        update: values,
      });
    } else {
      throw new Error("Sign in as this participant to update preferences.");
    }
  }
  await touchGameNight(session.id);

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const dealSettingsSchema = z.object({
  shareToken: z.string().min(1),
  dealCountry: z.string().trim().length(2),
  dealCurrency: z.string().trim().min(3).max(3),
});

export async function updateDealSettingsAction(formData: FormData) {
  const parsed = dealSettingsSchema.safeParse({
    shareToken: formData.get("shareToken"),
    dealCountry: String(formData.get("dealCountry") ?? "").toUpperCase(),
    dealCurrency: String(formData.get("dealCurrency") ?? "").toUpperCase(),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not save deal settings.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: { id: true, workspaceType: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  if (session.workspaceType !== "PICK") {
    throw new Error("Deal settings belong to a Pick workspace.");
  }
  await requireHostParticipant(session.id);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      dealCountry: parsed.data.dealCountry,
      dealCurrency: parsed.data.dealCurrency,
    },
  });
  await touchGameNight(session.id);

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const priceAlertSchema = z.object({
  shareToken: z.string().min(1),
  participantId: z.string().optional(),
  type: z.enum(["UNDER_PRICE", "GROUP_ON_SALE", "MISSING_PLAYERS_ONLY", "HISTORICAL_LOW", "OWNED_COUNT_DISCOUNTED"]),
  thresholdPrice: z.coerce.number().int().min(0).optional(),
  ownedCount: z.coerce.number().int().min(1).optional(),
  totalCount: z.coerce.number().int().min(1).optional(),
  missingOnly: z.boolean().default(false),
});

export async function createPriceAlertRuleAction(formData: FormData) {
  const parsed = priceAlertSchema.safeParse({
    shareToken: formData.get("shareToken"),
    participantId: formData.get("participantId") || undefined,
    type: formData.get("type"),
    thresholdPrice: formData.get("thresholdPrice") ? Math.round(Number(formData.get("thresholdPrice")) * 100) : undefined,
    ownedCount: formData.get("ownedCount") || undefined,
    totalCount: formData.get("totalCount") || undefined,
    missingOnly: formData.get("missingOnly") === "on",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create price alert.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: { id: true, workspaceType: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }
  if (session.workspaceType !== "PICK") {
    throw new Error("Price alerts belong to a Pick workspace.");
  }

  const hostParticipantId = await requireHostParticipant(session.id);

  await prisma.priceAlertRule.create({
    data: {
      sessionId: session.id,
      createdByParticipantId: hostParticipantId,
      type: parsed.data.type,
      thresholdPrice: parsed.data.thresholdPrice ?? null,
      ownedCount: parsed.data.ownedCount ?? null,
      totalCount: parsed.data.totalCount ?? null,
      missingOnly: parsed.data.missingOnly,
    },
  });
  await touchGameNight(session.id);

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const friendInviteSchema = z.object({
  redirectTo: z.string().min(1).default("/"),
});

export async function createFriendInviteAction(formData: FormData) {
  const parsed = friendInviteSchema.safeParse({
    redirectTo: formData.get("redirectTo") || "/",
  });
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Sign in with Google before creating friend invites.");
  }

  await prisma.friendInvite.create({
    data: {
      token: createShareToken(),
      inviterId: currentUser.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });

  revalidatePath(parsed.success ? parsed.data.redirectTo : "/");
}

const createFriendGroupFromSessionSchema = z.object({
  shareToken: z.string().min(1),
  name: z.string().trim().min(2).max(80),
});

export async function createFriendGroupFromSessionAction(formData: FormData) {
  const parsed = createFriendGroupFromSessionSchema.safeParse({
    shareToken: formData.get("shareToken"),
    name: formData.get("name"),
  });
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Sign in with Google to save reusable friend groups.");
  }

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not save friend group.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    include: { participants: { orderBy: [{ isHost: "desc" }, { createdAt: "asc" }] } },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  const membership = await prisma.participant.findUnique({
    where: { sessionId_userId: { sessionId: session.id, userId: currentUser.id } },
    select: { id: true },
  });
  if (!membership) {
    throw new Error("Join this session before creating a saved group.");
  }

  const group = await prisma.friendGroup.create({
    data: {
      ownerId: currentUser.id,
      name: parsed.data.name,
      members: {
        create: {
          userId: currentUser.id,
          displayName: currentUser.displayName,
          status: "ACCEPTED",
        },
      },
    },
  });

  revalidatePath(`/s/${session.shareToken}`);
  redirect(`/groups/${group.id}`);
}

const createFriendGroupInviteSchema = z.object({
  groupId: z.string().min(1),
  redirectTo: z.string().min(1).default("/groups"),
});

export async function createFriendGroupInviteAction(formData: FormData) {
  const parsed = createFriendGroupInviteSchema.safeParse({
    groupId: formData.get("groupId"),
    redirectTo: formData.get("redirectTo") || "/groups",
  });
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Sign in with Google to invite group members.");
  }

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create group invite.");
  }

  const group = await prisma.friendGroup.findFirst({
    where: { id: parsed.data.groupId, ownerId: currentUser.id },
    select: { id: true },
  });

  if (!group) {
    throw new Error("Friend group not found.");
  }

  await prisma.friendGroupInvite.create({
    data: {
      token: createShareToken(),
      groupId: group.id,
      inviterId: currentUser.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });

  revalidatePath(parsed.data.redirectTo);
}

const acceptFriendGroupInviteSchema = z.object({
  token: z.string().min(1),
});

export async function acceptFriendGroupInviteAction(formData: FormData) {
  const parsed = acceptFriendGroupInviteSchema.safeParse({
    token: formData.get("token"),
  });
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Sign in with Google to join this group.");
  }

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not accept invite.");
  }

  const groupId = await prisma.$transaction(async (tx) => {
    const invite = await tx.friendGroupInvite.findFirst({
      where: { token: parsed.data.token, acceptedAt: null, expiresAt: { gt: new Date() } },
      include: { group: true },
    });
    if (!invite || invite.group.ownerId === currentUser.id) {
      throw new Error("This group invite is no longer available.");
    }

    const blocked = await tx.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: currentUser.id, blockedId: invite.group.ownerId },
          { blockerId: invite.group.ownerId, blockedId: currentUser.id },
        ],
      },
      select: { id: true },
    });
    if (blocked) throw new Error("This group invite is not available.");

    const consumed = await tx.friendGroupInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedById: currentUser.id, acceptedAt: new Date() },
    });
    if (consumed.count !== 1) throw new Error("This group invite has already been used.");

    const placeholder = await tx.friendGroupMember.findFirst({
      where: { groupId: invite.groupId, userId: null, status: "PENDING", displayName: currentUser.displayName },
      orderBy: { createdAt: "asc" },
    });
    if (placeholder) {
      await tx.friendGroupMember.update({
        where: { id: placeholder.id },
        data: { userId: currentUser.id, displayName: currentUser.displayName, status: "ACCEPTED" },
      });
    } else {
      await tx.friendGroupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId: currentUser.id } },
        create: { groupId: invite.groupId, userId: currentUser.id, displayName: currentUser.displayName, status: "ACCEPTED" },
        update: { displayName: currentUser.displayName, status: "ACCEPTED" },
      });
    }

    return invite.groupId;
  });

  redirect(`/groups/${groupId}`);
}

const startPickSessionFromFriendGroupSchema = z.object({
  groupId: z.string().min(1),
  timezone: timezoneSchema.default("Europe/London"),
});

export async function startPickSessionFromFriendGroupAction(formData: FormData) {
  const parsed = startPickSessionFromFriendGroupSchema.safeParse({
    groupId: formData.get("groupId"),
    timezone: formData.get("timezone") || "Europe/London",
  });
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Sign in with Google to start from a saved group.");
  }

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not start Pick session.");
  }

  const group = await prisma.friendGroup.findFirst({
    where: { id: parsed.data.groupId, ownerId: currentUser.id },
    include: { members: { orderBy: { createdAt: "asc" } } },
  });

  if (!group) {
    throw new Error("Friend group not found.");
  }

  const dateRange = dateRangeFromPreset("this_week", parsed.data.timezone);
  await prisma.user.update({ where: { id: currentUser.id }, data: { timezone: parsed.data.timezone } });
  const acceptedMembers = group.members.filter((member) => member.status === "ACCEPTED" && member.userId && member.userId !== currentUser.id);
  const gameNightShareToken = createShareToken();
  const session = await prisma.session.create({
    data: {
      title: `${group.name} picks`,
      shareToken: createShareToken(),
      mode: "ONLINE",
      requiredDuration: 2,
      minimumPlayerCount: Math.max(2, acceptedMembers.length + 1),
      dateRangeStart: fromZonedTime(`${dateRange.startsOn}T00:00:00`, parsed.data.timezone),
      dateRangeEnd: fromZonedTime(`${dateRange.endsOn}T00:00:00`, parsed.data.timezone),
      dailyStartHour: 18,
      dailyEndHour: 23,
      timezone: parsed.data.timezone,
      dealCountry: "GB",
      dealCurrency: "GBP",
      reminderPreferences: [],
      workspaceType: "PICK",
      gameNight: {
        create: {
          title: `${group.name} picks`,
          shareToken: gameNightShareToken,
          ownerUserId: currentUser.id,
        },
      },
      participants: {
        create: [
          {
            name: currentUser.displayName,
            userId: currentUser.id,
            isHost: true,
          },
          ...acceptedMembers.map((member) => ({
            name: member.displayName,
            userId: member.userId,
          })),
        ],
      },
    },
    include: { participants: true },
  });
  const host = session.participants.find((participant) => participant.isHost) ?? session.participants[0];

  await setParticipantIdentity(session.id, host.id, { isHost: true });
  redirect(`/s/${session.shareToken}?tab=pick&participant=${host.id}`);
}

const createCombinedGameNightSchema = z.object({
  title: z.string().trim().min(2).max(120),
  hostName: z.string().trim().min(1).max(80),
  timezone: timezoneSchema.default("Europe/London"),
  mode: z.enum(["ONLINE", "IN_PERSON"]),
  requiredDuration: z.coerce.number().int().min(1).max(8),
  minimumPlayerCount: z.coerce.number().int().min(2).max(30),
  datePreset: z.enum(["tonight", "this_week", "this_month"]),
  dailyStartHour: z.coerce.number().int().min(0).max(23),
  dailyEndHour: z.coerce.number().int().min(1).max(24),
}).superRefine((value, ctx) => {
  if (value.dailyEndHour - value.dailyStartHour < value.requiredDuration) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The time window must fit the session duration.", path: ["dailyEndHour"] });
  }
});

export async function createCombinedGameNightAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.username || !currentUser.onboardingCompletedAt) {
    redirect("/account?returnTo=%2Fgame-nights%2Fnew");
  }

  const parsed = createCombinedGameNightSchema.safeParse({
    title: formData.get("title"),
    hostName: formData.get("hostName"),
    timezone: formData.get("timezone") || "Europe/London",
    mode: formData.get("mode"),
    requiredDuration: formData.get("requiredDuration"),
    minimumPlayerCount: formData.get("minimumPlayerCount"),
    datePreset: formData.get("datePreset"),
    dailyStartHour: formData.get("dailyStartHour"),
    dailyEndHour: formData.get("dailyEndHour"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Could not create the Game Night.");

  const values = parsed.data;
  await prisma.user.update({ where: { id: currentUser.id }, data: { timezone: values.timezone } });
  const dateRange = dateRangeFromPreset(values.datePreset, values.timezone);
  const gameNight = await prisma.gameNight.create({
    data: {
      title: values.title,
      shareToken: createShareToken(),
      ownerUserId: currentUser.id,
      workspaces: {
        create: [
          {
            title: values.title,
            shareToken: createShareToken(),
            workspaceType: "PLAN",
            mode: values.mode,
            requiredDuration: values.requiredDuration,
            minimumPlayerCount: values.minimumPlayerCount,
            dateRangeStart: fromZonedTime(`${dateRange.startsOn}T00:00:00`, values.timezone),
            dateRangeEnd: fromZonedTime(`${dateRange.endsOn}T00:00:00`, values.timezone),
            dailyStartHour: values.dailyStartHour,
            dailyEndHour: values.dailyEndHour,
            timezone: values.timezone,
            reminderPreferences: [],
            participants: { create: { name: values.hostName, userId: currentUser.id, isHost: true } },
          },
          {
            title: values.title,
            shareToken: createShareToken(),
            workspaceType: "PICK",
            mode: values.mode,
            requiredDuration: values.requiredDuration,
            minimumPlayerCount: values.minimumPlayerCount,
            dateRangeStart: fromZonedTime(`${dateRange.startsOn}T00:00:00`, values.timezone),
            dateRangeEnd: fromZonedTime(`${dateRange.endsOn}T00:00:00`, values.timezone),
            dailyStartHour: values.dailyStartHour,
            dailyEndHour: values.dailyEndHour,
            timezone: values.timezone,
            reminderPreferences: [],
            participants: { create: { name: values.hostName, userId: currentUser.id, isHost: true } },
          },
        ],
      },
    },
    include: { workspaces: { include: { participants: true } } },
  });

  for (const workspace of gameNight.workspaces) {
    const host = workspace.participants[0];
    if (host) await setParticipantIdentity(workspace.id, host.id, { isHost: true });
  }

  redirect(`/n/${gameNight.shareToken}`);
}

const addSessionParticipantsAsFriendsSchema = z.object({
  shareToken: z.string().min(1),
});

export async function addSessionParticipantsAsFriendsAction(formData: FormData) {
  const parsed = addSessionParticipantsAsFriendsSchema.safeParse({
    shareToken: formData.get("shareToken"),
  });
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Sign in with Google to add friends.");
  }

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not add friends.");
  }

  const session = await prisma.session.findUnique({
    where: { shareToken: parsed.data.shareToken },
    select: { id: true, workspaceType: true },
  });
  if (!session) throw new Error("Session not found.");
  if (session.workspaceType !== "PICK") throw new Error("Friend requests belong to a Pick workspace.");
  const membership = await prisma.participant.findUnique({
    where: { sessionId_userId: { sessionId: session.id, userId: currentUser.id } },
    select: { id: true },
  });
  if (!membership) throw new Error("Join this session before sending friend requests.");

  const participants = await prisma.participant.findMany({
    where: {
      sessionId: session.id,
      userId: { not: null },
    },
    select: { userId: true },
  });
  const friendIds = [
    ...new Set(
      participants
        .map((participant) => participant.userId)
        .filter((userId): userId is string => Boolean(userId) && userId !== currentUser.id),
    ),
  ];

  const [blocked, friends] = await Promise.all([
    prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: currentUser.id, blockedId: { in: friendIds } },
          { blockedId: currentUser.id, blockerId: { in: friendIds } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.userFriend.findMany({
      where: { userId: currentUser.id, friendId: { in: friendIds } },
      select: { friendId: true },
    }),
  ]);
  const excluded = new Set([
    ...friends.map((friend) => friend.friendId),
    ...blocked.flatMap((block) => [block.blockerId, block.blockedId]),
  ]);
  await prisma.$transaction(
    friendIds
      .filter((friendId) => !excluded.has(friendId))
      .map((recipientId) =>
        prisma.friendRequest.upsert({
          where: { senderId_recipientId: { senderId: currentUser.id, recipientId } },
          create: { senderId: currentUser.id, recipientId },
          update: { status: "PENDING", createdAt: new Date() },
        }),
      ),
  );

  revalidatePath(`/s/${parsed.data.shareToken}`);
}

const selectFinalGameSchema = z.object({
  shareToken: z.string().min(1),
  sessionGameId: z.string().min(1),
});

export async function selectFinalGameAction(formData: FormData) {
  const parsed = selectFinalGameSchema.safeParse({
    shareToken: formData.get("shareToken"),
    sessionGameId: formData.get("sessionGameId"),
  });
  if (!parsed.success) throw new Error("Choose a shortlisted game.");

  const sessionGame = await prisma.sessionGame.findFirst({
    where: {
      id: parsed.data.sessionGameId,
      session: { shareToken: parsed.data.shareToken, workspaceType: "PICK", gameNightId: { not: null } },
    },
    select: { sessionId: true, session: { select: { gameNightId: true } } },
  });
  if (!sessionGame?.session.gameNightId) throw new Error("Shortlisted game not found.");

  await requireHostParticipant(sessionGame.sessionId);
  await prisma.gameNight.update({
    where: { id: sessionGame.session.gameNightId },
    data: { selectedSessionGameId: parsed.data.sessionGameId, lastActivityAt: new Date() },
  });
  revalidatePath(`/s/${parsed.data.shareToken}`);
}

export async function updateGameNightStatusAction(formData: FormData) {
  const gameNightId = String(formData.get("gameNightId") ?? "");
  const status = z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).parse(formData.get("status"));
  const currentUser = await getCurrentUser();
  if (!currentUser || !gameNightId) throw new Error("Sign in as the Game Night owner.");
  const updated = await prisma.gameNight.updateMany({
    where: { id: gameNightId, ownerUserId: currentUser.id },
    data: { status, lastActivityAt: new Date() },
  });
  if (updated.count !== 1) throw new Error("Game Night not found.");
  revalidatePath("/game-nights");
}

const removeFriendGroupMemberSchema = z.object({
  groupId: z.string().min(1),
  memberId: z.string().min(1),
});

export async function removeFriendGroupMemberAction(formData: FormData) {
  const parsed = removeFriendGroupMemberSchema.safeParse({
    groupId: formData.get("groupId"),
    memberId: formData.get("memberId"),
  });
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Sign in with Google to manage groups.");
  }

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not remove group member.");
  }

  const group = await prisma.friendGroup.findFirst({
    where: { id: parsed.data.groupId, ownerId: currentUser.id },
    select: { id: true },
  });

  if (!group) {
    throw new Error("Friend group not found.");
  }

  await prisma.friendGroupMember.deleteMany({
    where: { id: parsed.data.memberId, groupId: parsed.data.groupId },
  });

  revalidatePath(`/groups/${parsed.data.groupId}`);
}

const addFriendToGroupSchema = z.object({
  groupId: z.string().min(1),
  friendId: z.string().min(1),
});

export async function addFriendToGroupAction(formData: FormData) {
  const parsed = addFriendToGroupSchema.safeParse({
    groupId: formData.get("groupId"),
    friendId: formData.get("friendId"),
  });
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Sign in with Google to manage groups.");
  }

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not add friend to group.");
  }

  const [group, friendship] = await Promise.all([
    prisma.friendGroup.findFirst({
      where: { id: parsed.data.groupId, ownerId: currentUser.id },
      select: { id: true },
    }),
    prisma.userFriend.findUnique({
      where: { userId_friendId: { userId: currentUser.id, friendId: parsed.data.friendId } },
      include: { friend: true },
    }),
  ]);

  if (!group || !friendship) {
    throw new Error("Friend group or friend not found.");
  }

  await prisma.friendGroupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: friendship.friendId } },
    create: {
      groupId: group.id,
      userId: friendship.friendId,
      displayName: friendship.friend.displayName,
      status: "ACCEPTED",
    },
    update: {
      displayName: friendship.friend.displayName,
      status: "ACCEPTED",
    },
  });

  revalidatePath(`/groups/${group.id}`);
}

const importSteamLibrarySchema = z.object({
  shareToken: z.string().min(1),
  participantId: z.string().optional(),
});

export async function importSteamLibraryAction(formData: FormData) {
  const importStartedAt = Date.now();
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
    select: { id: true, shareToken: true, workspaceType: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }
  if (session.workspaceType !== "PICK") {
    throw new Error("Steam imports belong to a Pick workspace.");
  }

  // Resolve which slot to import into. Only adopt a requested slot if it is
  // unlinked or already this user's — never steal a slot linked to someone else.
  const requestedId = await resolveActingParticipantId(session.id, parsed.data.participantId);
  const requested = requestedId
    ? await prisma.participant.findFirst({
        where: { id: requestedId, sessionId: session.id },
        select: { id: true, userId: true },
      })
    : null;

  let participant =
    requested && (requested.userId === null || requested.userId === currentUser.id)
      ? requested
      : null;

  if (!participant) {
    participant =
      (await prisma.participant.findFirst({
        where: { sessionId: session.id, userId: currentUser.id },
        select: { id: true, userId: true },
      })) ??
      (await prisma.participant.create({
        data: {
          sessionId: session.id,
          userId: currentUser.id,
          name: currentUser.displayName,
        },
        select: { id: true, userId: true },
      }));
  }

  if (participant.userId !== currentUser.id) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { userId: currentUser.id },
    });
    participant = { ...participant, userId: currentUser.id };
  }

  await setParticipantIdentity(session.id, participant.id);
  const [owned, recent] = await Promise.all([
    getOwnedSteamGames(currentUser.steamAccount.steamId),
    getRecentlyPlayedSteamGames(currentUser.steamAccount.steamId),
  ]);
  console.info("[steam-import] fetched steam library", {
    userId: currentUser.id,
    ownedCount: owned.games.length,
    recentCount: recent.length,
    status: owned.status,
    elapsedMs: Date.now() - importStartedAt,
  });

  const imported = await importSteamGamesForUser(currentUser.id, owned.games, recent);
  console.info("[steam-import] saved steam library", {
    userId: currentUser.id,
    ownedCount: owned.games.length,
    elapsedMs: Date.now() - importStartedAt,
  });

  if (participant) {
    const ownedGameIds = new Set(imported.gameIds);
    const matchingSessionGames = await prisma.sessionGame.findMany({
      where: {
        sessionId: session.id,
        gameId: { in: Array.from(ownedGameIds) },
      },
      select: { id: true },
    });

    await runInChunks(
      matchingSessionGames,
      (sessionGame) =>
        prisma.sessionGameSignal.upsert({
          where: {
            sessionGameId_participantId: {
              sessionGameId: sessionGame.id,
              participantId: participant.id,
            },
          },
          create: {
            sessionGameId: sessionGame.id,
            participantId: participant.id,
            signal: "OWNED",
          },
          update: { signal: "OWNED" },
        }),
    );
    console.info("[steam-import] marked existing shortlist ownership", {
      userId: currentUser.id,
      participantId: participant.id,
      matchingCount: matchingSessionGames.length,
      elapsedMs: Date.now() - importStartedAt,
    });

    const linkedParticipants = await prisma.participant.findMany({
      where: {
        sessionId: session.id,
        userId: { not: null },
      },
      select: { id: true, userId: true },
    });
    const otherUserIds = linkedParticipants
      .map((linkedParticipant) => linkedParticipant.userId)
      .filter((userId): userId is string => Boolean(userId) && userId !== currentUser.id);
    const sharedImportedGames =
      otherUserIds.length > 0
        ? await prisma.userGame.findMany({
            where: {
              userId: currentUser.id,
              ownership: "HAVE",
              game: {
                userGames: {
                  some: {
                    userId: { in: otherUserIds },
                    ownership: "HAVE",
                  },
                },
              },
            },
            select: { gameId: true },
            orderBy: [{ recentlyPlayedAt: "desc" }, { playtimeMinutes: "desc" }],
            take: 200,
          })
        : [];
    const importedGames = await prisma.userGame.findMany({
      where: { userId: currentUser.id, ownership: "HAVE" },
      select: { gameId: true },
      orderBy: [{ recentlyPlayedAt: "desc" }, { playtimeMinutes: "desc" }],
      take: 100,
    });
    const shortlistImports = uniqueUserGames([...sharedImportedGames, ...importedGames]);

    await runInChunks(
      shortlistImports,
      (userGame) =>
        addGameToSession({
          sessionId: session.id,
          gameId: userGame.gameId,
          participantId: participant.id,
          userId: currentUser.id,
          source: "STEAM_MATCH",
          signal: "OWNED",
        }),
      20,
    );
    console.info("[steam-import] added top imported games to session", {
      userId: currentUser.id,
      participantId: participant.id,
      addedCount: shortlistImports.length,
      sharedCount: sharedImportedGames.length,
      elapsedMs: Date.now() - importStartedAt,
    });

    const participantByUserId = new Map(
      linkedParticipants
        .filter((linkedParticipant): linkedParticipant is { id: string; userId: string } => Boolean(linkedParticipant.userId))
        .map((linkedParticipant) => [linkedParticipant.userId, linkedParticipant.id]),
    );
    const sessionShortlist = await prisma.sessionGame.findMany({
      where: { sessionId: session.id },
      select: { id: true, gameId: true },
    });
    const sessionGameByGameId = new Map(sessionShortlist.map((sessionGame) => [sessionGame.gameId, sessionGame.id]));
    const ownershipRows = await prisma.userGame.findMany({
      where: {
        userId: { in: Array.from(participantByUserId.keys()) },
        gameId: { in: sessionShortlist.map((sessionGame) => sessionGame.gameId) },
        ownership: "HAVE",
      },
      select: { userId: true, gameId: true },
    });

    await runInChunks(
      ownershipRows,
      (ownership) => {
        const ownerParticipantId = participantByUserId.get(ownership.userId);
        const sessionGameId = sessionGameByGameId.get(ownership.gameId);

        if (!ownerParticipantId || !sessionGameId) {
          return Promise.resolve();
        }

        return prisma.sessionGameSignal.upsert({
          where: {
            sessionGameId_participantId: {
              sessionGameId,
              participantId: ownerParticipantId,
            },
          },
          create: {
            sessionGameId,
            participantId: ownerParticipantId,
            signal: "OWNED",
          },
          update: { signal: "OWNED" },
        });
      },
      50,
    );
    await prisma.sessionGameSignal.deleteMany({
      where: {
        participantId: participant.id,
        signal: "OWNED",
        sessionGame: {
          sessionId: session.id,
          game: {
            userGames: { none: { userId: currentUser.id, ownership: "HAVE" } },
          },
        },
      },
    });
    console.info("[steam-import] synced linked participant ownership", {
      userId: currentUser.id,
      participantCount: participantByUserId.size,
      signalCount: ownershipRows.length,
      elapsedMs: Date.now() - importStartedAt,
    });
  }

  await prisma.steamAccount.update({
    where: { userId: currentUser.id },
    data: {
      lastImportAt: new Date(),
      lastImportStatus: owned.status,
    },
  });
  await touchGameNight(session.id);

  revalidatePath(`/s/${session.shareToken}`);
  console.info("[steam-import] complete", {
    userId: currentUser.id,
    ownedCount: owned.games.length,
    elapsedMs: Date.now() - importStartedAt,
  });
  redirect(
    `/s/${session.shareToken}?tab=pick&participant=${participant.id}&imported=${owned.games.length}`,
  );
}

function uniqueUserGames<T extends { gameId: string }>(userGames: T[]) {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const userGame of userGames) {
    if (seen.has(userGame.gameId)) {
      continue;
    }

    seen.add(userGame.gameId);
    unique.push(userGame);
  }

  return unique;
}

async function runInChunks<T>(items: T[], worker: (item: T) => Promise<unknown>, chunkSize = 50) {
  for (let index = 0; index < items.length; index += chunkSize) {
    await Promise.all(items.slice(index, index + chunkSize).map(worker));
  }
}
