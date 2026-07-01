import { curatedGames, type CuratedGame } from "@/lib/curated-games";
import { normalizeGameTitle, type GameInput } from "@/lib/games";

export function findCuratedGameForGame(game: Pick<GameInput, "title" | "steamAppId">) {
  const steamAppId = game.steamAppId ?? null;

  if (steamAppId) {
    const bySteam = curatedGames.find((curatedGame) => curatedGame.steamAppId === steamAppId);

    if (bySteam) {
      return bySteam;
    }
  }

  const normalizedTitle = normalizeGameTitle(game.title);
  return curatedGames.find((curatedGame) => normalizeGameTitle(curatedGame.title) === normalizedTitle) ?? null;
}

export function mergeCuratedMetadata(input: GameInput): GameInput {
  const curatedGame = findCuratedGameForGame(input);

  if (!curatedGame) {
    return input;
  }

  return {
    ...input,
    steamAppId: input.steamAppId ?? curatedGame.steamAppId ?? null,
    genres: mergeTextLists(input.genres, curatedGame.genres),
    platforms: mergeTextLists(input.platforms, curatedGame.platforms),
    gameModes: mergeTextLists(input.gameModes, curatedGame.gameModes),
    minPlayers: curatedGame.minPlayers ?? input.minPlayers ?? null,
    maxPlayers: curatedGame.maxPlayers ?? input.maxPlayers ?? null,
    onlineCoop: curatedGame.onlineCoop ?? input.onlineCoop ?? null,
    localCoop: curatedGame.localCoop ?? input.localCoop ?? null,
    onlineMultiplayer: curatedGame.onlineMultiplayer ?? input.onlineMultiplayer ?? null,
    localMultiplayer: curatedGame.localMultiplayer ?? input.localMultiplayer ?? null,
    campaignCoop: curatedGame.campaignCoop ?? input.campaignCoop ?? null,
    minimumSessionMinutes: curatedGame.minimumSessionMinutes ?? input.minimumSessionMinutes ?? null,
    commitmentTier: curatedGame.commitmentTier ?? input.commitmentTier ?? null,
    capabilitySource: "curated",
    capabilityConfidence: curatedGame.capabilityConfidence ?? input.capabilityConfidence ?? 0.9,
  };
}

export function curatedCapabilityData(curatedGame: CuratedGame) {
  return {
    genres: curatedGame.genres ?? [],
    platforms: curatedGame.platforms ?? [],
    gameModes: curatedGame.gameModes ?? [],
    minPlayers: curatedGame.minPlayers,
    maxPlayers: curatedGame.maxPlayers,
    onlineCoop: curatedGame.onlineCoop,
    localCoop: curatedGame.localCoop,
    onlineMultiplayer: curatedGame.onlineMultiplayer,
    localMultiplayer: curatedGame.localMultiplayer,
    campaignCoop: curatedGame.campaignCoop,
    minimumSessionMinutes: curatedGame.minimumSessionMinutes,
    commitmentTier: curatedGame.commitmentTier,
    capabilitySource: "curated",
    capabilityConfidence: curatedGame.capabilityConfidence ?? 0.9,
  };
}

function mergeTextLists(primary?: string[], fallback?: string[]) {
  const merged = [...(primary ?? []), ...(fallback ?? [])].map((value) => value.trim()).filter(Boolean);
  return [...new Set(merged)];
}
