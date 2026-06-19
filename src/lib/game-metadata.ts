import type { Game } from "@prisma/client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { curatedCapabilityData, findCuratedGameForGame } from "@/lib/curated-metadata";
import { getIgdbGameById, mapIgdbCapability, mapIgdbQuality, searchIgdbGames } from "@/lib/igdb";
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

export async function refreshGameMetadata(gameIds: string[]) {
  const uniqueIds = [...new Set(gameIds)].filter(Boolean).slice(0, 24);

  if (uniqueIds.length === 0) {
    return;
  }

  const games = await prisma.game.findMany({
    where: { id: { in: uniqueIds } },
  });

  for (const game of games) {
    if (!metadataIsStale(game)) {
      continue;
    }

    await refreshSingleGameMetadata(game);
  }
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
      capabilitySource: curatedCapability?.capabilitySource ?? game.capabilitySource ?? capability?.capabilitySource ?? undefined,
      capabilityConfidence: curatedCapability?.capabilityConfidence ?? game.capabilityConfidence ?? capability?.capabilityConfidence ?? undefined,
      genres: curatedCapability?.genres ?? (Array.isArray(game.genres) && game.genres.length > 0 ? undefined : igdbMetadata?.genres),
      platforms: curatedCapability?.platforms ?? (Array.isArray(game.platforms) && game.platforms.length > 0 ? undefined : igdbMetadata?.platforms),
      gameModes: curatedCapability?.gameModes ?? (Array.isArray(game.gameModes) && game.gameModes.length > 0 ? undefined : igdbMetadata?.gameModes),
    },
  });
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

function metadataIsStale(game: Game) {
  if (!game.qualityFetchedAt) {
    return true;
  }

  if (!game.qualitySource || game.qualitySource === "metadata:unavailable") {
    return true;
  }

  return Date.now() - game.qualityFetchedAt.getTime() > metadataTtlMs;
}
