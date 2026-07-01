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
    platform?: { name?: string };
    campaigncoop?: boolean;
    dropin?: boolean;
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

export type IgdbTimeToBeatResult = {
  game_id: number;
  hastily?: number;
  normally?: number;
  completely?: number;
  count?: number;
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
  "fields id,name,summary,cover.url,genres.name,platforms.name,game_modes.name,multiplayer_modes.platform.name,multiplayer_modes.campaigncoop,multiplayer_modes.dropin,multiplayer_modes.onlinecoop,multiplayer_modes.offlinecoop,multiplayer_modes.onlinecoopmax,multiplayer_modes.offlinecoopmax,multiplayer_modes.onlinemax,multiplayer_modes.offlinemax,multiplayer_modes.splitscreen,total_rating,total_rating_count,aggregated_rating,aggregated_rating_count,rating,rating_count,hypes;";

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
  return queryIgdbEndpoint<IgdbGameResult>("games", body);
}

async function queryIgdbEndpoint<T>(endpoint: string, body: string) {
  const clientId = process.env.IGDB_CLIENT_ID;
  const token = await getIgdbAccessToken();

  if (!clientId || !token) {
    return [] as T[];
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(`https://api.igdb.com/v4/${endpoint}`, {
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

  return (await response.json()) as T[];
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

export async function getIgdbTimeToBeat(gameId: number) {
  const [result] = await queryIgdbEndpoint<IgdbTimeToBeatResult>(
    "game_time_to_beats",
    `fields game_id,hastily,normally,completely,count; where game_id = ${gameId}; limit 1;`,
  );
  return result ?? null;
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
    onlineMultiplayer: capability.onlineMultiplayer,
    localMultiplayer: capability.localMultiplayer,
    campaignCoop: capability.campaignCoop,
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
  const onlineMultiplayer = modes.some((mode) => (mode.onlinemax ?? 0) > 1 || mode.onlinecoop) || undefined;
  const localMultiplayer = modes.some((mode) => (mode.offlinemax ?? 0) > 1 || mode.offlinecoop || mode.splitscreen) || undefined;
  const campaignCoop = modes.some((mode) => mode.campaigncoop) || undefined;

  if (maxPlayers || onlineCoop !== undefined || localCoop !== undefined || onlineMultiplayer !== undefined || localMultiplayer !== undefined) {
    return {
      minPlayers: 1,
      maxPlayers: maxPlayers ?? null,
      onlineCoop: onlineCoop ?? null,
      localCoop: localCoop ?? null,
      onlineMultiplayer: onlineMultiplayer ?? null,
      localMultiplayer: localMultiplayer ?? null,
      campaignCoop: campaignCoop ?? null,
      capabilitySource: "igdb:multiplayer_modes",
      capabilityConfidence: maxPlayers ? 0.9 : 0.65,
    };
  }

  return {
    minPlayers: null,
    maxPlayers: null,
    onlineCoop: null,
    localCoop: null,
    onlineMultiplayer: null,
    localMultiplayer: null,
    campaignCoop: null,
    capabilitySource: null,
    capabilityConfidence: null,
  };
}

export function mapIgdbPlatformCapabilities(result: IgdbGameResult) {
  return (result.multiplayer_modes ?? []).map((mode) => ({
    platform: mode.platform?.name ?? "Unknown",
    minPlayers: 1,
    maxPlayers: maxNumber([
      mode.onlinecoopmax,
      mode.offlinecoopmax,
      mode.onlinemax,
      mode.offlinemax,
    ]),
    onlineMultiplayer: (mode.onlinemax ?? 0) > 1 || Boolean(mode.onlinecoop),
    localMultiplayer: (mode.offlinemax ?? 0) > 1 || Boolean(mode.offlinecoop || mode.splitscreen),
    onlineCoop: Boolean(mode.onlinecoop),
    localCoop: Boolean(mode.offlinecoop || mode.splitscreen),
    campaignCoop: Boolean(mode.campaigncoop),
    source: "igdb:multiplayer_modes",
    confidence: 0.9,
  }));
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
