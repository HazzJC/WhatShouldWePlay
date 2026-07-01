import type { Game } from "@prisma/client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { curatedCapabilityData, findCuratedGameForGame } from "@/lib/curated-metadata";
import { getIgdbGameById, getIgdbTimeToBeat, mapIgdbCapability, mapIgdbPlatformCapabilities, mapIgdbQuality, searchIgdbGames } from "@/lib/igdb";
import { prisma } from "@/lib/prisma";

const metadataTtlMs = 1000 * 60 * 60 * 24 * 30;

type SteamReviewSummary = {
  success?: number;
  query_summary?: {
    review_score?: number;
    review_score_desc?: string;
    total_positive?: number;
    total_negative?: number;
    total_reviews?: number;
  };
};

export async function refreshGameMetadata(
  gameIds: string[],
  { limit = 24, concurrency = 1 }: { limit?: number; concurrency?: number } = {},
) {
  const uniqueIds = [...new Set(gameIds)].filter(Boolean).slice(0, limit);

  if (uniqueIds.length === 0) {
    return { refreshed: 0 };
  }

  const games = await prisma.game.findMany({
    where: { id: { in: uniqueIds } },
  });
  const staleGames = games.filter(metadataIsStale);

  for (let index = 0; index < staleGames.length; index += concurrency) {
    await Promise.all(staleGames.slice(index, index + concurrency).map(refreshSingleGameMetadata));
  }

  return { refreshed: staleGames.length };
}

async function refreshSingleGameMetadata(game: Game) {
  const [steamQuality, igdbMetadata] = await Promise.all([
    game.steamAppId ? fetchSteamReviewSummary(game.steamAppId) : Promise.resolve(null),
    fetchIgdbMetadata(game),
  ]);

  const quality = steamQuality ?? igdbMetadata?.quality ?? null;
  const capability = igdbMetadata?.capability ?? null;
  const curatedGame = findCuratedGameForGame(game);
  const curatedCapability = curatedGame ? curatedCapabilityData(curatedGame) : null;
  const timeToBeat = igdbMetadata?.igdbId ? await getIgdbTimeToBeat(igdbMetadata.igdbId) : null;
  const normalMinutes = secondsToMinutes(timeToBeat?.normally);

  await prisma.game.update({
    where: { id: game.id },
    data: {
      popularityScore: quality?.popularityScore ?? game.popularityScore,
      steamReviewScore: steamQuality?.steamReviewScore ?? game.steamReviewScore,
      steamReviewPercent: steamQuality?.steamReviewPercent ?? game.steamReviewPercent,
      steamReviewTotal: steamQuality?.steamReviewTotal ?? igdbMetadata?.quality.steamReviewTotal ?? game.steamReviewTotal,
      steamReviewSummary: quality?.steamReviewSummary ?? game.steamReviewSummary,
      qualitySource: quality?.qualitySource ?? game.qualitySource ?? "metadata:unavailable",
      qualityFetchedAt: new Date(),
      igdbId: game.igdbId ?? igdbMetadata?.igdbId ?? undefined,
      minPlayers: curatedCapability?.minPlayers ?? game.minPlayers ?? capability?.minPlayers ?? undefined,
      maxPlayers: curatedCapability?.maxPlayers ?? game.maxPlayers ?? capability?.maxPlayers ?? undefined,
      onlineCoop: curatedCapability?.onlineCoop ?? game.onlineCoop ?? capability?.onlineCoop ?? undefined,
      localCoop: curatedCapability?.localCoop ?? game.localCoop ?? capability?.localCoop ?? undefined,
      onlineMultiplayer: curatedCapability?.onlineMultiplayer ?? game.onlineMultiplayer ?? capability?.onlineMultiplayer ?? undefined,
      localMultiplayer: curatedCapability?.localMultiplayer ?? game.localMultiplayer ?? capability?.localMultiplayer ?? undefined,
      campaignCoop: curatedCapability?.campaignCoop ?? game.campaignCoop ?? capability?.campaignCoop ?? undefined,
      capabilitySource: curatedCapability?.capabilitySource ?? game.capabilitySource ?? capability?.capabilitySource ?? undefined,
      capabilityConfidence: curatedCapability?.capabilityConfidence ?? game.capabilityConfidence ?? capability?.capabilityConfidence ?? undefined,
      genres: curatedCapability?.genres ?? (Array.isArray(game.genres) && game.genres.length > 0 ? undefined : igdbMetadata?.genres),
      platforms: curatedCapability?.platforms ?? (Array.isArray(game.platforms) && game.platforms.length > 0 ? undefined : igdbMetadata?.platforms),
      gameModes: curatedCapability?.gameModes ?? (Array.isArray(game.gameModes) && game.gameModes.length > 0 ? undefined : igdbMetadata?.gameModes),
      timeToBeatHastilyMinutes: secondsToMinutes(timeToBeat?.hastily) ?? game.timeToBeatHastilyMinutes,
      timeToBeatNormallyMinutes: normalMinutes ?? game.timeToBeatNormallyMinutes,
      timeToBeatCompletelyMinutes: secondsToMinutes(timeToBeat?.completely) ?? game.timeToBeatCompletelyMinutes,
      timeToBeatCount: timeToBeat?.count ?? game.timeToBeatCount,
      timeToBeatSource: timeToBeat ? "igdb:game_time_to_beats" : game.timeToBeatSource,
      timeToBeatFetchedAt: timeToBeat ? new Date() : game.timeToBeatFetchedAt,
      minimumSessionMinutes: curatedCapability?.minimumSessionMinutes ?? game.minimumSessionMinutes,
      commitmentTier: curatedCapability?.commitmentTier ?? game.commitmentTier ?? commitmentFromMinutes(normalMinutes),
    },
  });

  if (igdbMetadata?.platformCapabilities.length) {
    await Promise.all(
      igdbMetadata.platformCapabilities.map((platform) =>
        prisma.gameCapability.upsert({
          where: {
            gameId_platform_source: {
              gameId: game.id,
              platform: platform.platform,
              source: platform.source,
            },
          },
          create: {
            gameId: game.id,
            ...platform,
          },
          update: {
            ...platform,
            fetchedAt: new Date(),
          },
        }),
      ),
    );
  }
}

export async function fetchSteamReviewSummary(steamAppId: number) {
  try {
    const url = new URL(`https://store.steampowered.com/appreviews/${steamAppId}`);
    url.searchParams.set("json", "1");
    url.searchParams.set("language", "all");
    url.searchParams.set("purchase_type", "all");
    url.searchParams.set("num_per_page", "0");

    const response = await fetchWithTimeout(url, { cache: "no-store", timeoutMs: 4000 });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as SteamReviewSummary;
    const summary = payload.query_summary;
    const totalReviews = summary?.total_reviews ?? (summary ? (summary.total_positive ?? 0) + (summary.total_negative ?? 0) : 0);

    if (!summary || totalReviews <= 0) {
      return null;
    }

    const positive = summary.total_positive ?? 0;
    const percent = totalReviews > 0 ? Math.round((positive / totalReviews) * 100) : null;

    return {
      popularityScore: percent,
      steamReviewScore: summary.review_score ?? null,
      steamReviewPercent: percent,
      steamReviewTotal: totalReviews,
      steamReviewSummary: `${summary.review_score_desc ?? "Steam reviews"}${percent !== null ? `, ${percent}% positive` : ""} from ${totalReviews.toLocaleString()} review${totalReviews === 1 ? "" : "s"}`,
      qualitySource: "steam:appreviews",
    };
  } catch {
    return null;
  }
}

async function fetchIgdbMetadata(game: Game) {
  const result = game.igdbId ? await getIgdbGameById(game.igdbId) : (await searchIgdbGames(game.title))[0] ?? null;

  if (!result) {
    return null;
  }

  const capability = mapIgdbCapability(result);
  const quality = mapIgdbQuality(result);

  return {
    igdbId: result.id,
    genres: result.genres?.map((genre) => genre.name) ?? undefined,
    platforms: result.platforms?.map((platform) => platform.name) ?? undefined,
    gameModes: result.game_modes?.map((mode) => mode.name) ?? undefined,
    capability,
    platformCapabilities: mapIgdbPlatformCapabilities(result),
    quality: {
      popularityScore: quality.popularityScore,
      steamReviewScore: null,
      steamReviewPercent: null,
      steamReviewTotal: quality.reviewTotal,
      steamReviewSummary: quality.summary,
      qualitySource: quality.qualitySource,
    },
  };
}

function secondsToMinutes(seconds?: number | null) {
  return typeof seconds === "number" && seconds > 0 ? Math.round(seconds / 60) : null;
}

function commitmentFromMinutes(minutes?: number | null) {
  if (!minutes) return undefined;
  if (minutes <= 240) return "ONE_SESSION" as const;
  if (minutes < 600) return "UNDER_10_HOURS" as const;
  if (minutes < 1800) return "HOURS_10_TO_30" as const;
  if (minutes < 6000) return "HOURS_30_TO_100" as const;
  if (minutes < 60_000) return "HOURS_100_TO_1000" as const;
  return "HOURS_1000_PLUS" as const;
}

function metadataIsStale(game: Game) {
  if (!game.qualityFetchedAt) {
    return true;
  }

  if (!game.qualitySource || game.qualitySource === "metadata:unavailable") {
    return true;
  }

  return Date.now() - game.qualityFetchedAt.getTime() > metadataTtlMs;
}
