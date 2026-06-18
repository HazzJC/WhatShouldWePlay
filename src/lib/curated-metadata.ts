import { curatedGames, type CuratedGame } from "@/lib/curated-games";
import { normalizeGameTitle, type GameInput } from "@/lib/games";
import { prisma } from "@/lib/prisma";

const syncTtlMs = 1000 * 60 * 30;
let lastSyncAt = 0;

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
    capabilitySource: "curated",
    capabilityConfidence: curatedGame.capabilityConfidence ?? 0.9,
  };
}

export async function syncCuratedGameMetadata({ force = false } = {}) {
  if (!force && Date.now() - lastSyncAt < syncTtlMs) {
    return;
  }

  lastSyncAt = Date.now();

  for (const curatedGame of curatedGames) {
    const normalizedTitle = normalizeGameTitle(curatedGame.title);
    const existing = await prisma.game.findFirst({
      where: {
        OR: [
          ...(curatedGame.steamAppId ? [{ steamAppId: curatedGame.steamAppId }] : []),
          { normalizedTitle },
        ],
      },
    });
    const capabilityData = curatedCapabilityData(curatedGame);

    if (existing) {
      const steamOwner = curatedGame.steamAppId ? await prisma.game.findUnique({ where: { steamAppId: curatedGame.steamAppId } }) : null;

      await prisma.game.update({
        where: { id: existing.id },
        data: {
          ...capabilityData,
          steamAppId: curatedGame.steamAppId && (!steamOwner || steamOwner.id === existing.id) ? curatedGame.steamAppId : undefined,
        },
      });
      continue;
    }

    await prisma.game.create({
      data: {
        title: curatedGame.title,
        normalizedTitle,
        steamAppId: curatedGame.steamAppId ?? null,
        summary: curatedGame.description,
        popularityScore: curatedGame.popularityScore ?? null,
        ...capabilityData,
      },
    });
  }
}

function mergeTextLists(primary?: string[], fallback?: string[]) {
  const merged = [...(primary ?? []), ...(fallback ?? [])].map((value) => value.trim()).filter(Boolean);
  return [...new Set(merged)];
}
