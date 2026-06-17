import { signalMeansHave } from "@/lib/games";

export type ScoreMode = "balanced" | "coop" | "backlog" | "cheap" | "familiar" | "fresh";
export type AlignmentLevel = "High" | "Medium" | "Low";
export type MatchCategory = "perfect" | "hiddenBacklog" | "oldFavourites" | "almostReady" | "saleOpportunity";

export type PreferenceProfile = {
  familiarVsNew: number;
  coOpVsCompetitive: number;
  priceImportance: number;
  genreImportance: number;
  ownershipImportance: number;
  backlogImportance: number;
  shortVsLong: number;
  chillVsIntense: number;
};

type ParticipantInput = {
  id: string;
  userId?: string | null;
  preference?: Partial<PreferenceProfile> | null;
  user?: { preference?: Partial<PreferenceProfile> | null } | null;
};

type GameScoreInput = {
  id: string;
  source: string;
  gameId: string;
  game: {
    id: string;
    title: string;
    popularityScore?: number | null;
    minPlayers?: number | null;
    maxPlayers?: number | null;
    onlineCoop?: boolean | null;
    localCoop?: boolean | null;
    steamStorePrice?: {
      discountPercent?: number | null;
      finalPrice?: number | null;
      status?: string | null;
    } | null;
  };
  signals: Array<{ participantId: string; signal: string }>;
  interests?: Array<{ participantId: string; interest: string }>;
};

type UserGameInput = {
  userId: string;
  gameId: string;
  playtimeMinutes?: number | null;
  recentlyPlayedAt?: Date | string | null;
};

export type ScoredGame = {
  sessionGameId: string;
  gameId: string;
  title: string;
  score: number;
  alignment: AlignmentLevel;
  reasons: string[];
  categories: MatchCategory[];
  factors: {
    ownership: number;
    playerCount: number;
    coopFit: number;
    playtime: number;
    freshness: number;
    interest: number;
    sale: number;
    popularity: number;
  };
  ownership: {
    have: number;
    missing: number;
    selected: number;
  };
  playtimeMinutes: number;
  discountPercent: number;
};

const defaultPreference: PreferenceProfile = {
  familiarVsNew: 50,
  coOpVsCompetitive: 75,
  priceImportance: 50,
  genreImportance: 50,
  ownershipImportance: 75,
  backlogImportance: 50,
  shortVsLong: 50,
  chillVsIntense: 50,
};

const modeWeights: Record<ScoreMode, Record<keyof ScoredGame["factors"], number>> = {
  balanced: { ownership: 0.28, playerCount: 0.16, coopFit: 0.12, playtime: 0.12, freshness: 0.1, interest: 0.12, sale: 0.04, popularity: 0.06 },
  coop: { ownership: 0.24, playerCount: 0.22, coopFit: 0.22, playtime: 0.08, freshness: 0.08, interest: 0.1, sale: 0.02, popularity: 0.04 },
  backlog: { ownership: 0.25, playerCount: 0.12, coopFit: 0.1, playtime: 0.24, freshness: 0.16, interest: 0.08, sale: 0.02, popularity: 0.03 },
  cheap: { ownership: 0.22, playerCount: 0.12, coopFit: 0.1, playtime: 0.08, freshness: 0.08, interest: 0.1, sale: 0.24, popularity: 0.06 },
  familiar: { ownership: 0.3, playerCount: 0.14, coopFit: 0.1, playtime: 0.22, freshness: 0.02, interest: 0.12, sale: 0.02, popularity: 0.08 },
  fresh: { ownership: 0.22, playerCount: 0.14, coopFit: 0.12, playtime: 0.04, freshness: 0.24, interest: 0.1, sale: 0.06, popularity: 0.08 },
};

export const scoreModeLabels: Record<ScoreMode, string> = {
  balanced: "Balanced",
  coop: "Co-op Night",
  backlog: "Backlog",
  cheap: "Cheap",
  familiar: "Familiar",
  fresh: "Fresh",
};

export function scoreSessionGames({
  sessionGames,
  participants,
  userGames,
  selectedParticipantIds,
  playerCount,
  mode = "balanced",
}: {
  sessionGames: GameScoreInput[];
  participants: ParticipantInput[];
  userGames: UserGameInput[];
  selectedParticipantIds?: string[];
  playerCount: number;
  mode?: ScoreMode;
}) {
  const selectedIds = selectedParticipantIds?.length ? selectedParticipantIds : participants.map((participant) => participant.id);
  const selectedParticipants = participants.filter((participant) => selectedIds.includes(participant.id));
  const selectedUserIds = new Set(selectedParticipants.map((participant) => participant.userId).filter(Boolean));
  const selectedCount = Math.max(selectedParticipants.length, 1);
  const weights = modeWeights[mode];

  return sessionGames
    .map((sessionGame) => {
      const haveParticipantIds = new Set(
        sessionGame.signals
          .filter((signal) => selectedIds.includes(signal.participantId) && signalMeansHave(signal.signal))
          .map((signal) => signal.participantId),
      );
      const notAvailableIds = new Set(
        sessionGame.signals
          .filter((signal) => selectedIds.includes(signal.participantId) && signal.signal === "NOT_AVAILABLE")
          .map((signal) => signal.participantId),
      );
      const interests = sessionGame.interests ?? [];
      const wantCount = interests.filter((interest) => selectedIds.includes(interest.participantId) && interest.interest === "WANT_TO_PLAY").length;
      const notTonightCount = interests.filter((interest) => selectedIds.includes(interest.participantId) && interest.interest === "NOT_TONIGHT").length;
      const have = haveParticipantIds.size;
      const missing = Math.max(selectedCount - have, 0);
      const ownership = have / selectedCount;
      const playerCountFit = playerCountFits(sessionGame.game, playerCount);
      const preference = averagePreference(selectedParticipants);
      const coopFit = coOpFit(sessionGame.game, preference.coOpVsCompetitive);
      const relevantUserGames = userGames.filter((userGame) => userGame.gameId === sessionGame.gameId && selectedUserIds.has(userGame.userId));
      const totalPlaytime = relevantUserGames.reduce((total, userGame) => total + (userGame.playtimeMinutes ?? 0), 0);
      const averagePlaytime = selectedCount > 0 ? totalPlaytime / selectedCount : 0;
      const playtime = mode === "backlog" || preference.backlogImportance >= 60 ? lowPlaytimeScore(averagePlaytime) : familiarPlaytimeScore(averagePlaytime);
      const freshness = freshnessScore(relevantUserGames);
      const interest = clampScore(60 + wantCount * 15 - notTonightCount * 45);
      const discountPercent = sessionGame.game.steamStorePrice?.discountPercent ?? 0;
      const sale = missing > 0 && discountPercent > 0 ? clampScore(45 + discountPercent) : 35;
      const popularity = clampScore(sessionGame.game.popularityScore ?? 45);
      const factors = {
        ownership: Math.round(ownership * 100),
        playerCount: playerCountFit,
        coopFit,
        playtime,
        freshness,
        interest,
        sale,
        popularity,
      };
      const preferenceBoost = preference.priceImportance > 65 && discountPercent > 0 ? 4 : 0;
      const rawScore = Object.entries(factors).reduce(
        (total, [factor, value]) => total + value * weights[factor as keyof typeof factors],
        preferenceBoost,
      );
      const alignment = alignmentLevel({ ownership, notAvailableCount: notAvailableIds.size, notTonightCount, playerCountFit });
      const categories = categoriesFor({ ownership, missing, selectedCount, playerCountFit, averagePlaytime, discountPercent });
      const reasons = reasonsFor({
        have,
        selectedCount,
        missing,
        playerCount,
        playerCountFit,
        averagePlaytime,
        discountPercent,
        notTonightCount,
        wantCount,
        onlineCoop: sessionGame.game.onlineCoop,
      });

      return {
        sessionGameId: sessionGame.id,
        gameId: sessionGame.gameId,
        title: sessionGame.game.title,
        score: clampScore(Math.round(rawScore)),
        alignment,
        reasons,
        categories,
        factors,
        ownership: { have, missing, selected: selectedCount },
        playtimeMinutes: totalPlaytime,
        discountPercent,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (a.alignment !== b.alignment) {
        return alignmentRank(b.alignment) - alignmentRank(a.alignment);
      }

      return a.title.localeCompare(b.title);
    });
}

function averagePreference(participants: ParticipantInput[]) {
  const profiles = participants.map((participant) => ({
    ...defaultPreference,
    ...(participant.user?.preference ?? {}),
    ...(participant.preference ?? {}),
  }));

  if (profiles.length === 0) {
    return defaultPreference;
  }

  return Object.fromEntries(
    Object.keys(defaultPreference).map((key) => [
      key,
      Math.round(profiles.reduce((total, profile) => total + profile[key as keyof PreferenceProfile], 0) / profiles.length),
    ]),
  ) as PreferenceProfile;
}

function playerCountFits(game: GameScoreInput["game"], playerCount: number) {
  if (game.maxPlayers && game.maxPlayers < playerCount) {
    return 25;
  }

  if (game.minPlayers && game.minPlayers > playerCount) {
    return 45;
  }

  if (game.maxPlayers || game.minPlayers) {
    return 95;
  }

  return 65;
}

function coOpFit(game: GameScoreInput["game"], coOpPreference: number) {
  if (coOpPreference < 45) {
    return 60;
  }

  if (game.onlineCoop || game.localCoop) {
    return 90;
  }

  if (game.onlineCoop === false && game.localCoop === false) {
    return 35;
  }

  return 60;
}

function familiarPlaytimeScore(averagePlaytime: number) {
  if (averagePlaytime >= 1200) {
    return 95;
  }
  if (averagePlaytime >= 240) {
    return 80;
  }
  if (averagePlaytime > 0) {
    return 60;
  }
  return 45;
}

function lowPlaytimeScore(averagePlaytime: number) {
  if (averagePlaytime === 0) {
    return 75;
  }
  if (averagePlaytime < 120) {
    return 95;
  }
  if (averagePlaytime < 600) {
    return 70;
  }
  return 45;
}

function freshnessScore(userGames: UserGameInput[]) {
  const recentlyPlayed = userGames.some((userGame) => {
    if (!userGame.recentlyPlayedAt) {
      return false;
    }

    return Date.now() - new Date(userGame.recentlyPlayedAt).getTime() < 1000 * 60 * 60 * 24 * 21;
  });

  return recentlyPlayed ? 45 : 80;
}

function alignmentLevel({
  ownership,
  notAvailableCount,
  notTonightCount,
  playerCountFit,
}: {
  ownership: number;
  notAvailableCount: number;
  notTonightCount: number;
  playerCountFit: number;
}): AlignmentLevel {
  if (notTonightCount > 0 || notAvailableCount > 0 || playerCountFit < 40) {
    return "Low";
  }

  if (ownership < 0.75 || playerCountFit < 70) {
    return "Medium";
  }

  return "High";
}

function categoriesFor({
  ownership,
  missing,
  selectedCount,
  playerCountFit,
  averagePlaytime,
  discountPercent,
}: {
  ownership: number;
  missing: number;
  selectedCount: number;
  playerCountFit: number;
  averagePlaytime: number;
  discountPercent: number;
}) {
  const categories: MatchCategory[] = [];

  if (ownership === 1 && playerCountFit >= 70) {
    categories.push("perfect");
  }
  if (ownership === 1 && averagePlaytime < 120) {
    categories.push("hiddenBacklog");
  }
  if (ownership === 1 && averagePlaytime >= 600) {
    categories.push("oldFavourites");
  }
  if (selectedCount > 1 && missing === 1) {
    categories.push("almostReady");
  }
  if (missing > 0 && discountPercent > 0) {
    categories.push("saleOpportunity");
  }

  return categories;
}

function reasonsFor({
  have,
  selectedCount,
  missing,
  playerCount,
  playerCountFit,
  averagePlaytime,
  discountPercent,
  notTonightCount,
  wantCount,
  onlineCoop,
}: {
  have: number;
  selectedCount: number;
  missing: number;
  playerCount: number;
  playerCountFit: number;
  averagePlaytime: number;
  discountPercent: number;
  notTonightCount: number;
  wantCount: number;
  onlineCoop?: boolean | null;
}) {
  const reasons = [`${have}/${selectedCount} selected players have it`];

  if (playerCountFit >= 70) {
    reasons.push(`Supports the selected ${playerCount} player group`);
  } else {
    reasons.push(`Player-count fit is uncertain for ${playerCount} players`);
  }

  if (notTonightCount > 0) {
    reasons.push(`${notTonightCount} player${notTonightCount === 1 ? "" : "s"} marked not tonight`);
  } else if (wantCount > 0) {
    reasons.push(`${wantCount} player${wantCount === 1 ? "" : "s"} want to play`);
  } else if (averagePlaytime < 120) {
    reasons.push("Low group playtime makes it a backlog candidate");
  } else if (averagePlaytime >= 600) {
    reasons.push("High group playtime makes it an old favourite");
  }

  if (missing > 0 && discountPercent > 0) {
    reasons.push(`${discountPercent}% off for missing players`);
  } else if (onlineCoop) {
    reasons.push("Online co-op friendly");
  }

  return reasons.slice(0, 4);
}

function alignmentRank(alignment: AlignmentLevel) {
  return { Low: 0, Medium: 1, High: 2 }[alignment];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}
