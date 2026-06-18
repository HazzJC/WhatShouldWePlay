"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { mergeCuratedMetadata } from "@/lib/curated-metadata";
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

const createPickSessionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  hostName: z.string().trim().min(1).max(80),
  timezone: z.string().trim().min(1).max(80).default("Europe/London"),
});

export async function createPickSessionAction(formData: FormData) {
  const parsed = createPickSessionSchema.safeParse({
    title: formData.get("title"),
    hostName: formData.get("hostName"),
    timezone: formData.get("timezone") || "Europe/London",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create the pick session.");
  }

  const values = parsed.data;
  const dateRange = dateRangeFromPreset("this_week", values.timezone);
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

  redirect(`/s/${session.shareToken}?tab=pick&participant=${host.id}`);
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
    : await upsertGame(
        mergeCuratedMetadata({
          title: parsed.data.title,
          igdbId: parsed.data.igdbId,
          steamAppId: parsed.data.steamAppId,
          coverUrl: parsed.data.coverUrl,
          summary: parsed.data.summary,
          popularityScore: parsed.data.popularityScore,
          genres: parseStringList(parsed.data.genres),
          platforms: parseStringList(parsed.data.platforms),
          gameModes: parseStringList(parsed.data.gameModes),
          minPlayers: parsed.data.minPlayers,
          maxPlayers: parsed.data.maxPlayers,
          onlineCoop: parseOptionalBoolean(parsed.data.onlineCoop),
          localCoop: parseOptionalBoolean(parsed.data.localCoop),
          capabilitySource: parsed.data.capabilitySource,
          capabilityConfidence: parsed.data.capabilityConfidence,
        }),
      );

  await addGameToSession({
    sessionId: session.id,
    gameId: game.id,
    participantId: participant?.id,
    userId: currentUser?.id ?? participant?.userId,
    source: parsed.data.source,
    signal: "OWNED",
  });

  revalidatePath(`/s/${session.shareToken}`);
}

function parseStringList(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}

function parseOptionalBoolean(value?: "true" | "false") {
  if (value === undefined) {
    return undefined;
  }

  return value === "true";
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

  const participant = await prisma.participant.findFirst({
    where: { id: parsed.data.participantId, sessionId: sessionGame.sessionId },
    select: { id: true },
  });

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
  const currentUser = await getCurrentUser();

  if (currentUser) {
    await prisma.userPreference.upsert({
      where: { userId: currentUser.id },
      create: { userId: currentUser.id, ...values },
      update: values,
    });
  } else if (participantId) {
    const participant = await prisma.participant.findFirst({
      where: { id: participantId, session: { shareToken } },
      select: { id: true },
    });

    if (!participant) {
      throw new Error("Participant not found.");
    }

    await prisma.participantPreference.upsert({
      where: { participantId: participant.id },
      create: { participantId: participant.id, ...values },
      update: values,
    });
  }

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

  const participant = await prisma.participant.findFirst({
    where: { id: parsed.data.participantId, session: { shareToken: parsed.data.shareToken } },
    select: { id: true },
  });

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

    if (currentUser) {
      await prisma.userPreference.upsert({
        where: { userId: currentUser.id },
        create: {
          userId: currentUser.id,
          coOpVsCompetitive: values.coOpVsCompetitive ?? 75,
          familiarVsNew: values.familiarVsNew ?? 50,
        },
        update: values,
      });
    } else {
      await prisma.participantPreference.upsert({
        where: { participantId: participant.id },
        create: {
          participantId: participant.id,
          coOpVsCompetitive: values.coOpVsCompetitive ?? 75,
          familiarVsNew: values.familiarVsNew ?? 50,
        },
        update: values,
      });
    }
  }

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

  await prisma.session.update({
    where: { shareToken: parsed.data.shareToken },
    data: {
      dealCountry: parsed.data.dealCountry,
      dealCurrency: parsed.data.dealCurrency,
    },
  });

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
    select: { id: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  await prisma.priceAlertRule.create({
    data: {
      sessionId: session.id,
      createdByParticipantId: parsed.data.participantId ?? null,
      type: parsed.data.type,
      thresholdPrice: parsed.data.thresholdPrice ?? null,
      ownedCount: parsed.data.ownedCount ?? null,
      totalCount: parsed.data.totalCount ?? null,
      missingOnly: parsed.data.missingOnly,
    },
  });

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
    throw new Error("Sign in with Steam before creating friend invites.");
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
        select: { id: true, userId: true },
      })
    : null;

  if (participant && participant.userId !== currentUser.id) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { userId: currentUser.id },
    });
  }
  const [owned, recent] = await Promise.all([
    getOwnedSteamGames(currentUser.steamAccount.steamId),
    getRecentlyPlayedSteamGames(currentUser.steamAccount.steamId),
  ]);

  await importSteamGamesForUser(currentUser.id, owned.games, recent);

  if (participant) {
    const ownedGameIds = new Set(
      (
        await prisma.userGame.findMany({
          where: { userId: currentUser.id },
          select: { gameId: true },
        })
      ).map((userGame) => userGame.gameId),
    );
    const matchingSessionGames = await prisma.sessionGame.findMany({
      where: {
        sessionId: session.id,
        gameId: { in: Array.from(ownedGameIds) },
      },
      select: { id: true },
    });

    await Promise.all(
      matchingSessionGames.map((sessionGame) =>
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
      ),
    );

    const importedGames = await prisma.userGame.findMany({
      where: { userId: currentUser.id },
      include: { game: true },
      orderBy: [{ recentlyPlayedAt: "desc" }, { playtimeMinutes: "desc" }],
      take: 40,
    });

    await Promise.all(
      importedGames.map((userGame) =>
        addGameToSession({
          sessionId: session.id,
          gameId: userGame.gameId,
          participantId: participant.id,
          userId: currentUser.id,
          source: "STEAM_MATCH",
          signal: "OWNED",
        }),
      ),
    );
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
