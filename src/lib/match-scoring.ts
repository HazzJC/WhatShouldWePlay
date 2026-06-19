import { curatedGames } from "@/lib/curated-games";
import { normalizeGameTitle, signalMeansHave } from "@/lib/games";
import { formatMinorPrice } from "@/lib/itad";

export type ScoreMode = "balanced" | "coop" | "backlog" | "cheap" | "familiar" | "fresh";
export type AlignmentLevel = "High" | "Medium" | "Low";
export type MatchCategory = "perfect" | "hiddenBacklog" | "oldFavourites" | "almostReady" | "saleOpportunity";
export type PlayerCountStatus = "supported" | "unsupported" | "uncertain";
type FactorKey = keyof ScoredGame["factors"];

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
  addedByParticipantId?: string | null;
  addedByUserId?: string | null;
  game: {
    id: string;
    title: string;
    popularityScore?: number | null;
    minPlayers?: number | null;
    maxPlayers?: number | null;
    onlineCoop?: boolean | null;
    localCoop?: boolean | null;
    genres?: unknown;
    steamReviewPercent?: number | null;
    steamReviewTotal?: number | null;
    steamReviewSummary?: string | null;
    qualitySource?: string | null;
    capabilitySource?: string | null;
    deal?: {
      discountPercent?: number | null;
      finalPrice?: number | null;
      currentPrice?: number | null;
      historicalLow?: number | null;
      currency?: string | null;
      status?: string | null;
    } | null;
  };
  signals: Array<{ participantId: string; signal: string }>;
  interests?: Array<{ participantId: string; interest: string }>;
};

export const groupPlaytimeThresholds = {
  barelyPlayedMinutes: 120,
  heavilyPlayedMinutes: 600,
};

export function isBarelyPlayedGroupPick(playtimeMinutes: number) {
  return playtimeMinutes < groupPlaytimeThresholds.barelyPlayedMinutes;
}

export function isHeavilyPlayedGroupPick(playtimeMinutes: number) {
  return playtimeMinutes >= groupPlaytimeThresholds.heavilyPlayedMinutes;
}

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
  alignmentReasons: string[];
  categories: MatchCategory[];
  factors: {
    ownership: number;
    playerCount: number;
    genreFit: number;
    availability: number;
    onlineCoop: number;
    localCoop: number;
    playtime: number;
    freshness: number;
    interest: number;
    price: number;
    historicalLow: number;
    popularity: number;
  };
  factorBreakdown: Array<{
    key: FactorKey;
    label: string;
    value: number;
    weight: number;
    points: number;
  }>;
  ownership: {
    have: number;
    missing: number;
    selected: number;
  };
  playtimeMinutes: number;
  discountPercent: number;
  currentPrice?: number | null;
  historicalLow?: number | null;
  playerCountStatus: PlayerCountStatus;
  qualitySource?: string | null;
  reviewSummary?: string | null;
  capabilitySource?: string | null;
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
  balanced: { ownership: 0.2, playerCount: 0.12, genreFit: 0.08, availability: 0.08, onlineCoop: 0.08, localCoop: 0.04, playtime: 0.1, freshness: 0.08, interest: 0.1, price: 0.04, historicalLow: 0.03, popularity: 0.05 },
  coop: { ownership: 0.18, playerCount: 0.16, genreFit: 0.06, availability: 0.06, onlineCoop: 0.18, localCoop: 0.1, playtime: 0.06, freshness: 0.05, interest: 0.08, price: 0.02, historicalLow: 0.01, popularity: 0.04 },
  backlog: { ownership: 0.18, playerCount: 0.1, genreFit: 0.07, availability: 0.05, onlineCoop: 0.06, localCoop: 0.03, playtime: 0.24, freshness: 0.14, interest: 0.07, price: 0.02, historicalLow: 0.01, popularity: 0.03 },
  cheap: { ownership: 0.14, playerCount: 0.1, genreFit: 0.05, availability: 0.05, onlineCoop: 0.06, localCoop: 0.03, playtime: 0.06, freshness: 0.05, interest: 0.07, price: 0.24, historicalLow: 0.1, popularity: 0.05 },
  familiar: { ownership: 0.24, playerCount: 0.11, genreFit: 0.08, availability: 0.06, onlineCoop: 0.06, localCoop: 0.03, playtime: 0.22, freshness: 0.02, interest: 0.09, price: 0.02, historicalLow: 0.01, popularity: 0.06 },
  fresh: { ownership: 0.14, playerCount: 0.1, genreFit: 0.08, availability: 0.05, onlineCoop: 0.07, localCoop: 0.03, playtime: 0.04, freshness: 0.24, interest: 0.08, price: 0.06, historicalLow: 0.04, popularity: 0.07 },
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
  const selectedUserIds = new Set(selectedParticipants.map((participant) => participant.userId).filter((userId): userId is string => Boolean(userId)));
  const selectedCount = Math.max(selectedParticipants.length, 1);
  const baseWeights = modeWeights[mode];

  return sessionGames
    .map((sessionGame) => {
      const game = withCuratedCapabilityFallback(sessionGame.game);
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
      const playerCountStatus = playerCountStatusFor(game, playerCount);
      const playerCountFit = playerCountFits(game, playerCount);
      const preference = averagePreference(selectedParticipants);
      const weights = preferenceAdjustedWeights(baseWeights, preference);
      const onlineCoop = coOpFit(game.onlineCoop, preference.coOpVsCompetitive);
      const localCoop = coOpFit(game.localCoop, preference.coOpVsCompetitive);
      const relevantUserIds = selectedUserIdsForSessionGame(sessionGame, selectedIds, selectedUserIds);
      const relevantUserGames = userGames.filter((userGame) => userGame.gameId === sessionGame.gameId && relevantUserIds.has(userGame.userId));
      const totalPlaytime = totalPlaytimeMinutes(relevantUserGames);
      const recentPlayCount = recentlyPlayedCount(relevantUserGames);
      const averagePlaytime = selectedCount > 0 ? totalPlaytime / selectedCount : 0;
      const playtime = mode === "backlog" || preference.backlogImportance >= 60 ? lowPlaytimeScore(averagePlaytime) : familiarPlaytimeScore(averagePlaytime);
      const freshness = freshnessScore(relevantUserGames);
      const interest = clampScore(60 + wantCount * 15 - notTonightCount * 45);
      const discountPercent = game.deal?.discountPercent ?? 0;
      const currentPrice = game.deal?.currentPrice ?? null;
      const historicalLow = game.deal?.historicalLow ?? null;
      const price = missing > 0 && discountPercent > 0 ? clampScore(45 + discountPercent) : 35;
      const historicalLowFactor = currentPrice && historicalLow ? clampScore(100 - Math.round(((currentPrice - historicalLow) / Math.max(historicalLow, 1)) * 100)) : 40;
      const popularity = qualitySignalScore(game.title, game.popularityScore, game.steamReviewPercent);
      const genreFit = genreFitScore(game.genres, preference.genreImportance);
      const availability = availabilityFit(selectedCount, missing, notAvailableIds.size);
      const sparseQualityBoost = game.popularityScore === null || game.popularityScore === undefined
        ? (popularity - 50) * 0.08
        : 0;
      const factors = {
        ownership: Math.round(ownership * 100),
        playerCount: playerCountFit,
        genreFit,
        availability,
        onlineCoop,
        localCoop,
        playtime,
        freshness,
        interest,
        price,
        historicalLow: historicalLowFactor,
        popularity,
      };
      const preferenceMismatches = preferenceMismatchReasons(selectedParticipants, game, missing, discountPercent);
      const preferenceBoost = preference.priceImportance > 65 && discountPercent > 0 ? 4 : 0;
      const factorBreakdown = factorBreakdownFor(factors, weights);
      const rawScore = factorBreakdown.reduce((total, factor) => total + factor.points, preferenceBoost + sparseQualityBoost);
      const alignment = alignmentLevel({
        ownership,
        notAvailableCount: notAvailableIds.size,
        notTonightCount,
        playerCountFit,
        playerCountStatus,
        strongMismatchCount: preferenceMismatches.length,
      });
      const alignmentReasons = alignmentReasonsFor({
        alignment,
        ownership,
        missing,
        selectedCount,
        notAvailableCount: notAvailableIds.size,
        notTonightCount,
        playerCountStatus,
        preferenceMismatches,
      });
      const categories = categoriesFor({ ownership, missing, selectedCount, playerCountFit, totalPlaytime, discountPercent });
      const reasons = reasonsFor({
        have,
        selectedCount,
        missing,
        playerCount,
        averagePlaytime,
        discountPercent,
        currentPrice,
        historicalLow,
        notTonightCount,
        wantCount,
        onlineCoop: game.onlineCoop,
        playerCountStatus,
        mode,
        totalPlaytime,
        recentPlayCount,
        currency: game.deal?.currency,
      });

      return {
        sessionGameId: sessionGame.id,
        gameId: sessionGame.gameId,
        title: game.title,
        score: clampScore(Math.round(rawScore)),
        alignment,
        reasons,
        alignmentReasons,
        categories,
        factors,
        factorBreakdown,
        ownership: { have, missing, selected: selectedCount },
        playtimeMinutes: totalPlaytime,
        discountPercent,
        currentPrice,
        historicalLow,
        playerCountStatus,
        qualitySource: game.qualitySource ?? null,
        reviewSummary: game.steamReviewSummary ?? null,
        capabilitySource: game.capabilitySource ?? null,
      };
    })
    .filter((game) => game.playerCountStatus !== "unsupported")
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

function preferenceAdjustedWeights(baseWeights: Record<FactorKey, number>, preference: PreferenceProfile) {
  const weights = { ...baseWeights };

  weights.ownership *= scaleAroundDefault(preference.ownershipImportance, 0.55, 1.55);
  weights.price *= scaleAroundDefault(preference.priceImportance, 0.45, 1.9);
  weights.historicalLow *= scaleAroundDefault(preference.priceImportance, 0.5, 1.7);
  weights.genreFit *= scaleAroundDefault(preference.genreImportance, 0.55, 1.6);
  weights.playtime *= scaleAroundDefault(preference.backlogImportance, 0.7, 1.45);

  if (preference.coOpVsCompetitive >= 65) {
    weights.onlineCoop *= 1.25;
    weights.localCoop *= 1.2;
  } else if (preference.coOpVsCompetitive <= 35) {
    weights.onlineCoop *= 0.75;
    weights.localCoop *= 0.75;
  }

  if (preference.familiarVsNew >= 65) {
    weights.freshness *= 1.55;
    weights.playtime *= 0.85;
  } else if (preference.familiarVsNew <= 35) {
    weights.playtime *= 1.35;
    weights.freshness *= 0.75;
  }

  if (preference.shortVsLong <= 35) {
    weights.freshness *= 1.15;
    weights.playerCount *= 1.1;
  } else if (preference.shortVsLong >= 65) {
    weights.playtime *= 1.15;
  }

  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

  return Object.fromEntries(
    Object.entries(weights).map(([key, weight]) => [key, weight / total]),
  ) as Record<FactorKey, number>;
}

function selectedUserIdsForSessionGame(
  sessionGame: Pick<GameScoreInput, "addedByParticipantId" | "addedByUserId">,
  selectedIds: string[],
  selectedUserIds: Set<string>,
) {
  const relevantUserIds = new Set(selectedUserIds);

  if (sessionGame.addedByUserId && sessionGame.addedByParticipantId && selectedIds.includes(sessionGame.addedByParticipantId)) {
    relevantUserIds.add(sessionGame.addedByUserId);
  }

  return relevantUserIds;
}

function totalPlaytimeMinutes(userGames: UserGameInput[]) {
  return userGames.reduce((total, userGame) => total + Math.max(0, userGame.playtimeMinutes ?? 0), 0);
}

function scaleAroundDefault(value: number, min: number, max: number) {
  return min + (Math.max(0, Math.min(100, value)) / 100) * (max - min);
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

function playerCountStatusFor(game: GameScoreInput["game"], playerCount: number): PlayerCountStatus {
  if (game.maxPlayers && game.maxPlayers < playerCount) {
    return "unsupported";
  }

  if (game.minPlayers && game.minPlayers > playerCount) {
    return "unsupported";
  }

  if (game.maxPlayers || game.minPlayers) {
    return "supported";
  }

  return "uncertain";
}

function playerCountFits(game: GameScoreInput["game"], playerCount: number) {
  const status = playerCountStatusFor(game, playerCount);

  if (status === "unsupported") {
    return 0;
  }

  if (status === "supported") {
    return 95;
  }

  return 48;
}

function coOpFit(supportsCoop: boolean | null | undefined, coOpPreference: number) {
  if (coOpPreference < 45) {
    return 60;
  }

  if (supportsCoop) {
    return 90;
  }

  if (supportsCoop === false) {
    return 35;
  }

  return 60;
}

function genreFitScore(genres: unknown, genreImportance: number) {
  const genreList = Array.isArray(genres) ? genres.map(String) : [];

  if (genreImportance < 45) {
    return 65;
  }

  if (genreList.some((genre) => /co-op|survival|party|rpg|shooter|campaign|chill/i.test(genre))) {
    return 82;
  }

  return 60;
}

function availabilityFit(selectedCount: number, missing: number, notAvailableCount: number) {
  if (notAvailableCount > 0) {
    return 20;
  }

  return Math.round(((selectedCount - missing) / Math.max(selectedCount, 1)) * 100);
}

function preferenceMismatchReasons(
  participants: ParticipantInput[],
  game: GameScoreInput["game"],
  missing: number,
  discountPercent: number,
) {
  const genres = Array.isArray(game.genres) ? game.genres.map((genre) => String(genre).toLocaleLowerCase()) : [];
  const text = `${game.title} ${genres.join(" ")}`.toLocaleLowerCase();
  const mismatches: string[] = [];

  participants.forEach((participant) => {
    const preference = {
      ...defaultPreference,
      ...(participant.user?.preference ?? {}),
      ...(participant.preference ?? {}),
    };

    if (preference.coOpVsCompetitive >= 85 && game.onlineCoop === false && game.localCoop === false) {
      mismatches.push("A selected player strongly prefers co-op, but this does not look co-op friendly");
    }

    if (preference.chillVsIntense <= 20 && /horror|hardcore|intense|shooter|fighting/.test(text)) {
      mismatches.push("A selected player strongly prefers chill games, but this looks intense");
    }

    if (preference.priceImportance >= 85 && missing > 0 && discountPercent <= 0) {
      mismatches.push("A selected player cares strongly about price, and missing players do not have a deal");
    }
  });

  return [...new Set(mismatches)].slice(0, 3);
}

function factorBreakdownFor(factors: ScoredGame["factors"], weights: Record<FactorKey, number>) {
  const labels: Record<FactorKey, string> = {
    ownership: "Ownership",
    playerCount: "Player count",
    genreFit: "Genre",
    availability: "Availability",
    onlineCoop: "Online co-op",
    localCoop: "Local co-op",
    playtime: "Playtime",
    freshness: "Freshness",
    interest: "Interest",
    price: "Sale price",
    historicalLow: "Historical low",
    popularity: "Reviews",
  };

  return (Object.keys(factors) as FactorKey[])
    .map((key) => ({
      key,
      label: labels[key],
      value: factors[key],
      weight: weights[key],
      points: factors[key] * weights[key],
    }))
    .sort((a, b) => b.points - a.points);
}

function qualitySignalScore(title: string, popularityScore?: number | null, steamReviewPercent?: number | null) {
  if (steamReviewPercent !== null && steamReviewPercent !== undefined) {
    return clampScore(steamReviewPercent);
  }

  if (popularityScore !== null && popularityScore !== undefined) {
    return clampScore(popularityScore);
  }

  const hash = Array.from(normalizeGameTitle(title)).reduce((total, char) => ((total << 5) - total + char.charCodeAt(0)) | 0, 0);
  return 25 + (Math.abs(hash) % 66);
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
  const recentlyPlayed = userGames.some(wasRecentlyPlayed);

  return recentlyPlayed ? 45 : 80;
}

function recentlyPlayedCount(userGames: UserGameInput[]) {
  return userGames.filter(wasRecentlyPlayed).length;
}

function wasRecentlyPlayed(userGame: UserGameInput) {
  if (!userGame.recentlyPlayedAt) {
    return false;
  }

  return Date.now() - new Date(userGame.recentlyPlayedAt).getTime() < 1000 * 60 * 60 * 24 * 21;
}

function formatPlaytime(minutes: number) {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }

  return `${Math.round(minutes / 60)}h`;
}

function formatPriceOrUnavailable(value?: number | null, currency?: string | null) {
  return formatMinorPrice(value, currency ?? "GBP") ?? "price unavailable";
}

function modeReason({
  mode,
  averagePlaytime,
  totalPlaytime,
  recentPlayCount,
  currentPrice,
  historicalLow,
  discountPercent,
  onlineCoop,
  playerCountStatus,
  currency,
}: {
  mode: ScoreMode;
  averagePlaytime: number;
  totalPlaytime: number;
  recentPlayCount: number;
  currentPrice?: number | null;
  historicalLow?: number | null;
  discountPercent: number;
  onlineCoop?: boolean | null;
  playerCountStatus: PlayerCountStatus;
  currency?: string | null;
}) {
  switch (mode) {
    case "cheap":
      if (currentPrice !== null && currentPrice !== undefined) {
        const price = formatPriceOrUnavailable(currentPrice, currency);
        if (discountPercent > 0) {
          return `Cheap mode: current price is ${price} with ${discountPercent}% off`;
        }
        if (historicalLow && currentPrice <= Math.round(historicalLow * 1.1)) {
          return `Cheap mode: current price is ${price}, close to its historical low`;
        }
        return `Cheap mode: current price is ${price}`;
      }
      return "Cheap mode: no live price found yet";

    case "familiar":
      if (recentPlayCount > 0) {
        return `Familiar mode: ${recentPlayCount} selected player${recentPlayCount === 1 ? "" : "s"} played it recently`;
      }
      if (totalPlaytime >= 600) {
        return `Familiar mode: ${formatPlaytime(totalPlaytime)} total group playtime`;
      }
      if (totalPlaytime > 0) {
        return `Familiar mode: ${formatPlaytime(totalPlaytime)} known group playtime`;
      }
      return "Familiar mode: no imported playtime yet";

    case "backlog":
      if (averagePlaytime < 120) {
        return `Backlog mode: only ${formatPlaytime(totalPlaytime)} total group playtime`;
      }
      return `Backlog mode: ${formatPlaytime(totalPlaytime)} total group playtime makes it less hidden`;

    case "coop":
      if (onlineCoop) {
        return "Co-op Night mode: online co-op support is confirmed";
      }
      return "Co-op Night mode: co-op support is not confirmed yet";

    case "fresh":
      if (recentPlayCount > 0) {
        return "Fresh mode: recent group play lowers the freshness fit";
      }
      if (totalPlaytime > 0) {
        return `Fresh mode: not played recently despite ${formatPlaytime(totalPlaytime)} known playtime`;
      }
      return "Fresh mode: no recent imported playtime found";

    case "balanced":
      if (playerCountStatus === "uncertain") {
        return "Balanced mode: player-count support still needs metadata";
      }
      return null;
  }
}

function alignmentLevel({
  ownership,
  notAvailableCount,
  notTonightCount,
  playerCountFit,
  playerCountStatus,
  strongMismatchCount,
}: {
  ownership: number;
  notAvailableCount: number;
  notTonightCount: number;
  playerCountFit: number;
  playerCountStatus: PlayerCountStatus;
  strongMismatchCount: number;
}): AlignmentLevel {
  if (notTonightCount > 0 || notAvailableCount > 0 || playerCountStatus === "unsupported" || strongMismatchCount > 0) {
    return "Low";
  }

  if (ownership < 0.75 || playerCountStatus === "uncertain" || playerCountFit < 70) {
    return "Medium";
  }

  return "High";
}

function alignmentReasonsFor({
  alignment,
  ownership,
  missing,
  selectedCount,
  notAvailableCount,
  notTonightCount,
  playerCountStatus,
  preferenceMismatches,
}: {
  alignment: AlignmentLevel;
  ownership: number;
  missing: number;
  selectedCount: number;
  notAvailableCount: number;
  notTonightCount: number;
  playerCountStatus: PlayerCountStatus;
  preferenceMismatches: string[];
}) {
  const reasons: string[] = [];

  if (notTonightCount > 0) {
    reasons.push(`${notTonightCount} selected player${notTonightCount === 1 ? "" : "s"} marked Not tonight`);
  }

  if (notAvailableCount > 0) {
    reasons.push(`${notAvailableCount} selected player${notAvailableCount === 1 ? "" : "s"} marked Don't have`);
  }

  reasons.push(...preferenceMismatches);

  if (playerCountStatus === "uncertain") {
    reasons.push("Player-count support is not confirmed yet");
  }

  if (missing > 0) {
    reasons.push(`${missing}/${selectedCount} selected player${missing === 1 ? "" : "s"} missing ownership`);
  }

  if (alignment === "High" && ownership === 1 && reasons.length === 0) {
    reasons.push("No selected player has a veto or strong mismatch");
  }

  return reasons.slice(0, 3);
}

function categoriesFor({
  ownership,
  missing,
  selectedCount,
  playerCountFit,
  totalPlaytime,
  discountPercent,
}: {
  ownership: number;
  missing: number;
  selectedCount: number;
  playerCountFit: number;
  totalPlaytime: number;
  discountPercent: number;
}) {
  const categories: MatchCategory[] = [];

  if (ownership === 1 && playerCountFit >= 70) {
    categories.push("perfect");
  }
  if (ownership === 1 && isBarelyPlayedGroupPick(totalPlaytime)) {
    categories.push("hiddenBacklog");
  }
  if (ownership === 1 && isHeavilyPlayedGroupPick(totalPlaytime)) {
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
  averagePlaytime,
  discountPercent,
  currentPrice,
  historicalLow,
  notTonightCount,
  wantCount,
  onlineCoop,
  playerCountStatus,
  mode,
  totalPlaytime,
  recentPlayCount,
  currency,
}: {
  have: number;
  selectedCount: number;
  missing: number;
  playerCount: number;
  averagePlaytime: number;
  totalPlaytime: number;
  recentPlayCount: number;
  discountPercent: number;
  currentPrice?: number | null;
  historicalLow?: number | null;
  notTonightCount: number;
  wantCount: number;
  onlineCoop?: boolean | null;
  playerCountStatus: PlayerCountStatus;
  mode: ScoreMode;
  currency?: string | null;
}) {
  const reasons = [`${have}/${selectedCount} selected players have it`];

  if (playerCountStatus === "supported") {
    reasons.push(`Supports the selected ${playerCount} player group`);
  } else if (playerCountStatus === "unsupported") {
    reasons.push(`Does not support ${playerCount} players`);
  } else {
    reasons.push(`Needs player-count metadata for ${playerCount} players`);
  }

  if (notTonightCount > 0) {
    reasons.push(`${notTonightCount} player${notTonightCount === 1 ? "" : "s"} marked not tonight`);
  } else if (wantCount > 0) {
    reasons.push(`${wantCount} player${wantCount === 1 ? "" : "s"} want to play`);
  } else {
    const modeSpecificReason = modeReason({
      mode,
      averagePlaytime,
      totalPlaytime,
      recentPlayCount,
      currentPrice,
      historicalLow,
      discountPercent,
      onlineCoop,
      playerCountStatus,
      currency,
    });

    if (modeSpecificReason) {
      reasons.push(modeSpecificReason);
    } else if (averagePlaytime < 120) {
      reasons.push("Low group playtime makes it a backlog candidate");
    } else if (averagePlaytime >= 600) {
      reasons.push("High group playtime makes it an old favourite");
    }
  }

  if (missing > 0 && discountPercent > 0) {
    reasons.push(`${discountPercent}% off for missing players`);
  } else if (currentPrice && historicalLow && currentPrice <= Math.round(historicalLow * 1.1)) {
    reasons.push("Close to its historical low");
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

function withCuratedCapabilityFallback(game: GameScoreInput["game"]): GameScoreInput["game"] {
  const hasKnownCapability =
    Boolean(game.maxPlayers) ||
    Boolean(game.minPlayers) ||
    (game.onlineCoop !== null && game.onlineCoop !== undefined) ||
    (game.localCoop !== null && game.localCoop !== undefined);

  if (hasKnownCapability) {
    return game;
  }

  const curated = curatedGames.find((candidate) => normalizeGameTitle(candidate.title) === normalizeGameTitle(game.title));

  if (!curated) {
    return game;
  }

  return {
    ...game,
    minPlayers: curated.minPlayers ?? game.minPlayers,
    maxPlayers: curated.maxPlayers ?? game.maxPlayers,
    onlineCoop: curated.onlineCoop ?? game.onlineCoop,
    localCoop: curated.localCoop ?? game.localCoop,
    genres: Array.isArray(game.genres) && game.genres.length > 0 ? game.genres : curated.genres,
  };
}
