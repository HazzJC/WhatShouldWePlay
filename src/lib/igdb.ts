import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export type IgdbGameResult = {
  id: number;
  name: string;
  summary?: string;
  cover?: { url?: string };
  genres?: Array<{ name: string }>;
  platforms?: Array<{ name: string }>;
  game_modes?: Array<{ name: string }>;
  multiplayer_modes?: Array<{
    onlinecoop?: boolean;
    offlinecoop?: boolean;
    onlinecoopmax?: number;
    offlinecoopmax?: number;
    onlinemax?: number;
    offlinemax?: number;
    splitscreen?: boolean;
  }>;
  total_rating?: number;
  total_rating_count?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  rating?: number;
  rating_count?: number;
  hypes?: number;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;
let popularCache: { expiresAt: number; games: IgdbGameResult[] } | null = null;
let trendingCache: { expiresAt: number; games: IgdbGameResult[] } | null = null;
const discoveryCacheMs = 1000 * 60 * 30;

const fields =
  "fields id,name,summary,cover.url,genres.name,platforms.name,game_modes.name,multiplayer_modes.onlinecoop,multiplayer_modes.offlinecoop,multiplayer_modes.onlinecoopmax,multiplayer_modes.offlinecoopmax,multiplayer_modes.onlinemax,multiplayer_modes.offlinemax,multiplayer_modes.splitscreen,total_rating,total_rating_count,aggregated_rating,aggregated_rating_count,rating,rating_count,hypes;";

export async function getIgdbAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  let response: Response;

  try {
    response = await fetchWithTimeout(url, { method: "POST", cache: "no-store" });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };

  return tokenCache.token;
}

export async function queryIgdbGames(body: string) {
  const clientId = process.env.IGDB_CLIENT_ID;
  const token = await getIgdbAccessToken();

  if (!clientId || !token) {
    return [] as IgdbGameResult[];
  }

  let response: Response;

  try {
    response = await fetchWithTimeout("https://api.igdb.com/v4/games", {
      method: "POST",
      body,
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as IgdbGameResult[];
}

export async function searchIgdbGames(query: string) {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [] as IgdbGameResult[];
  }

  return queryIgdbGames(`${fields} search "${escapeIgdbString(trimmed)}"; limit 12;`);
}

export async function getPopularIgdbGames() {
  if (popularCache && popularCache.expiresAt > Date.now()) {
    return popularCache.games;
  }

  const games = await queryIgdbGames(`${fields} where total_rating_count > 20; sort total_rating desc; limit 12;`);
  popularCache = { games, expiresAt: Date.now() + discoveryCacheMs };
  return games;
}

export async function getTrendingIgdbGames() {
  if (trendingCache && trendingCache.expiresAt > Date.now()) {
    return trendingCache.games;
  }

  const games = await queryIgdbGames(`${fields} where hypes != null; sort hypes desc; limit 12;`);
  trendingCache = { games, expiresAt: Date.now() + discoveryCacheMs };
  return games;
}

export async function getIgdbGameById(id: number) {
  const [game] = await queryIgdbGames(`${fields} where id = ${id}; limit 1;`);
  return game ?? null;
}

export function mapIgdbGame(result: IgdbGameResult) {
  const capability = mapIgdbCapability(result);
  const quality = mapIgdbQuality(result);

  return {
    igdbId: result.id,
    title: result.name,
    coverUrl: result.cover?.url ? normalizeCoverUrl(result.cover.url) : null,
    summary: result.summary ?? null,
    genres: result.genres?.map((genre) => genre.name) ?? [],
    platforms: result.platforms?.map((platform) => platform.name) ?? [],
    gameModes: result.game_modes?.map((mode) => mode.name) ?? [],
    popularityScore: quality.popularityScore,
    minPlayers: capability.minPlayers,
    maxPlayers: capability.maxPlayers,
    onlineCoop: capability.onlineCoop,
    localCoop: capability.localCoop,
    capabilitySource: capability.capabilitySource,
    capabilityConfidence: capability.capabilityConfidence,
    steamReviewScore: null,
    steamReviewPercent: null,
    steamReviewTotal: quality.reviewTotal,
    steamReviewSummary: quality.summary,
    qualitySource: quality.qualitySource,
  };
}

export function mapIgdbCapability(result: IgdbGameResult) {
  const modes = result.multiplayer_modes ?? [];
  const onlineMax = maxNumber(modes.map((mode) => mode.onlinecoopmax ?? mode.onlinemax));
  const offlineMax = maxNumber(modes.map((mode) => mode.offlinecoopmax ?? mode.offlinemax));
  const maxPlayers = maxNumber([onlineMax, offlineMax]);
  const onlineCoop = modes.some((mode) => mode.onlinecoop) || undefined;
  const localCoop = modes.some((mode) => mode.offlinecoop || mode.splitscreen) || undefined;

  if (maxPlayers || onlineCoop !== undefined || localCoop !== undefined) {
    return {
      minPlayers: 1,
      maxPlayers: maxPlayers ?? null,
      onlineCoop: onlineCoop ?? null,
      localCoop: localCoop ?? null,
      capabilitySource: "igdb:multiplayer_modes",
      capabilityConfidence: maxPlayers ? 0.9 : 0.65,
    };
  }

  return {
    minPlayers: null,
    maxPlayers: null,
    onlineCoop: null,
    localCoop: null,
    capabilitySource: null,
    capabilityConfidence: null,
  };
}

export function mapIgdbQuality(result: IgdbGameResult) {
  const rating = result.total_rating ?? result.aggregated_rating ?? result.rating ?? null;
  const count = result.total_rating_count ?? result.aggregated_rating_count ?? result.rating_count ?? null;

  return {
    popularityScore: result.hypes ?? rating ?? null,
    reviewTotal: count,
    summary: rating ? `IGDB rating ${Math.round(rating)}/100${count ? ` from ${count} rating${count === 1 ? "" : "s"}` : ""}` : null,
    qualitySource: rating ? "igdb:rating" : result.hypes ? "igdb:hypes" : null,
  };
}

function normalizeCoverUrl(url: string) {
  return url.startsWith("//") ? `https:${url}` : url;
}

function escapeIgdbString(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function maxNumber(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => typeof value === "number" && value > 0);
  return present.length ? Math.max(...present) : null;
}
