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
const steamApiBase = "https://partner.steam-api.com";

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

  const response = await fetch(steamOpenIdEndpoint, {
    method: "POST",
    body: verifyParams,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
  });
  const body = await response.text();

  return body.includes("is_valid:true") ? steamId : null;
}

export async function getOwnedSteamGames(steamId: string, apiKey = process.env.STEAM_WEB_API_KEY) {
  if (!apiKey) {
    return { games: [] as SteamOwnedGame[], status: "missing_key" };
  }

  const url = new URL("/IPlayerService/GetOwnedGames/v1/", steamApiBase);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "true");
  url.searchParams.set("include_played_free_games", "true");

  let response: Response;

  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return { games: [] as SteamOwnedGame[], status: "network_error" };
  }

  if (!response.ok) {
    return { games: [] as SteamOwnedGame[], status: `http_${response.status}` };
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

export async function getRecentlyPlayedSteamGames(steamId: string, apiKey = process.env.STEAM_WEB_API_KEY) {
  if (!apiKey) {
    return [] as SteamRecentlyPlayedGame[];
  }

  const url = new URL("/IPlayerService/GetRecentlyPlayedGames/v1/", steamApiBase);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("count", "0");

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { response?: { games?: SteamRecentlyPlayedGame[] } };
  return payload.response?.games ?? [];
}
