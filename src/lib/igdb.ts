export type IgdbGameResult = {
  id: number;
  name: string;
  summary?: string;
  cover?: { url?: string };
  genres?: Array<{ name: string }>;
  platforms?: Array<{ name: string }>;
  game_modes?: Array<{ name: string }>;
  total_rating?: number;
  hypes?: number;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

const fields =
  "fields id,name,summary,cover.url,genres.name,platforms.name,game_modes.name,total_rating,hypes;";

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

  const response = await fetch(url, { method: "POST", cache: "no-store" });

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

  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    body,
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

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
  return queryIgdbGames(`${fields} where total_rating_count > 20; sort total_rating desc; limit 12;`);
}

export async function getTrendingIgdbGames() {
  return queryIgdbGames(`${fields} where hypes != null; sort hypes desc; limit 12;`);
}

export function mapIgdbGame(result: IgdbGameResult) {
  return {
    igdbId: result.id,
    title: result.name,
    coverUrl: result.cover?.url ? normalizeCoverUrl(result.cover.url) : null,
    summary: result.summary ?? null,
    genres: result.genres?.map((genre) => genre.name) ?? [],
    platforms: result.platforms?.map((platform) => platform.name) ?? [],
    gameModes: result.game_modes?.map((mode) => mode.name) ?? [],
    popularityScore: result.hypes ?? result.total_rating ?? null,
  };
}

function normalizeCoverUrl(url: string) {
  return url.startsWith("//") ? `https:${url}` : url;
}

function escapeIgdbString(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
