import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export type SteamOwnedGame = {
  appid: number;
  name?: string;
  img_icon_url?: string;
  playtime_forever?: number;
};

export type SteamRecentlyPlayedGame = {
  appid: number;
  playtime_2weeks?: number;
  playtime_forever?: number;
};

const steamOpenIdEndpoint = "https://steamcommunity.com/openid/login";
const steamClaimedIdPrefix = "https://steamcommunity.com/openid/id/";
const steamApiBase = "https://api.steampowered.com";

export function extractSteamIdFromClaimedId(claimedId: string | null) {
  if (!claimedId?.startsWith(steamClaimedIdPrefix)) {
    return null;
  }

  const steamId = claimedId.slice(steamClaimedIdPrefix.length);
  return /^\d{17}$/.test(steamId) ? steamId : null;
}

export function buildSteamOpenIdUrl(returnTo: string, realm: string) {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  return `${steamOpenIdEndpoint}?${params.toString()}`;
}

export async function verifySteamOpenIdCallback(searchParams: URLSearchParams) {
  const claimedId = searchParams.get("openid.claimed_id");
  const steamId = extractSteamIdFromClaimedId(claimedId);

  if (!steamId) {
    return null;
  }

  const verifyParams = new URLSearchParams(searchParams);
  verifyParams.set("openid.mode", "check_authentication");

  let body: string;

  try {
    const response = await fetchWithTimeout(steamOpenIdEndpoint, {
      method: "POST",
      body: verifyParams,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    });
    body = await response.text();
  } catch {
    return null;
  }

  return body.includes("is_valid:true") ? steamId : null;
}

export async function getOwnedSteamGames(steamId: string, apiKey = process.env.STEAM_WEB_API_KEY) {
  if (!apiKey) {
    return getOwnedSteamGamesFromCommunityXml(steamId, "missing_key_xml");
  }

  const url = new URL("/IPlayerService/GetOwnedGames/v1/", steamApiBase);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "true");
  url.searchParams.set("include_played_free_games", "true");

  let response: Response;

  try {
    response = await fetchWithTimeout(url, { cache: "no-store", timeoutMs: 8000 });
  } catch {
    return getOwnedSteamGamesFromCommunityXml(steamId, "network_error_xml");
  }

  if (!response.ok) {
    return getOwnedSteamGamesFromCommunityXml(steamId, `http_${response.status}_xml`);
  }

  let payload: { response?: { games?: SteamOwnedGame[]; game_count?: number } };

  try {
    payload = (await response.json()) as { response?: { games?: SteamOwnedGame[]; game_count?: number } };
  } catch {
    return { games: [] as SteamOwnedGame[], status: "malformed_response" };
  }

  const games = payload.response?.games ?? [];

  return { games, status: games.length > 0 ? `imported:${games.length}` : "private_or_empty" };
}

export async function getOwnedSteamGamesFromCommunityXml(steamId: string, statusPrefix = "xml") {
  const url = `https://steamcommunity.com/profiles/${steamId}/games?tab=all&xml=1`;

  let response: Response;

  try {
    response = await fetchWithTimeout(url, { cache: "no-store", timeoutMs: 8000 });
  } catch {
    return { games: [] as SteamOwnedGame[], status: `${statusPrefix}_network_error` };
  }

  if (!response.ok) {
    return { games: [] as SteamOwnedGame[], status: `${statusPrefix}_http_${response.status}` };
  }

  const xml = await response.text();
  const games = parseSteamCommunityGamesXml(xml);

  return {
    games,
    status: games.length > 0 ? `${statusPrefix}_imported:${games.length}` : `${statusPrefix}_private_or_empty`,
  };
}

export async function getRecentlyPlayedSteamGames(steamId: string, apiKey = process.env.STEAM_WEB_API_KEY) {
  if (!apiKey) {
    return [] as SteamRecentlyPlayedGame[];
  }

  const url = new URL("/IPlayerService/GetRecentlyPlayedGames/v1/", steamApiBase);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("count", "0");

  try {
    const response = await fetchWithTimeout(url, { cache: "no-store", timeoutMs: 8000 });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { response?: { games?: SteamRecentlyPlayedGame[] } };
    return payload.response?.games ?? [];
  } catch {
    return [];
  }
}

export function parseSteamCommunityGamesXml(xml: string): SteamOwnedGame[] {
  const gameBlocks = xml.match(/<game>[\s\S]*?<\/game>/g) ?? [];
  const games: SteamOwnedGame[] = [];

  for (const block of gameBlocks) {
    const appid = Number(readXmlTag(block, "appID"));
    const name = decodeXml(readXmlTag(block, "name") ?? "");
    const hoursOnRecord = Number(readXmlTag(block, "hoursOnRecord") ?? "0");

    if (!appid || !name) {
      continue;
    }

    games.push({
      appid,
      name,
      playtime_forever: Number.isFinite(hoursOnRecord) ? Math.round(hoursOnRecord * 60) : 0,
    });
  }

  return games;
}

function readXmlTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${tag}>`));
  return match?.[1]?.trim() ?? null;
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
