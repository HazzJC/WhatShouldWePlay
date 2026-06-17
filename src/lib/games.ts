import type { Game, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SteamOwnedGame, SteamRecentlyPlayedGame } from "@/lib/steam";

export type GameInput = {
  title: string;
  steamAppId?: number | null;
  igdbId?: number | null;
  coverUrl?: string | null;
  summary?: string | null;
  genres?: string[];
  platforms?: string[];
  gameModes?: string[];
  popularityScore?: number | null;
};

export const commonMultiplayerGames: GameInput[] = [
  { title: "Minecraft", platforms: ["PC", "Xbox", "PlayStation", "Switch", "Mobile"], gameModes: ["Multiplayer"] },
  { title: "League of Legends", platforms: ["PC"], gameModes: ["Multiplayer"] },
  { title: "Valorant", platforms: ["PC", "Console"], gameModes: ["Multiplayer"] },
  { title: "Fortnite", platforms: ["PC", "Xbox", "PlayStation", "Switch", "Mobile"], gameModes: ["Multiplayer"] },
  { title: "Roblox", platforms: ["PC", "Xbox", "PlayStation", "Mobile"], gameModes: ["Multiplayer"] },
  { title: "World of Warcraft", platforms: ["PC"], gameModes: ["Massively Multiplayer"] },
  { title: "Final Fantasy XIV", platforms: ["PC", "PlayStation", "Xbox"], gameModes: ["Massively Multiplayer"] },
  { title: "Sea of Thieves", platforms: ["Game Pass", "Steam", "Xbox", "PlayStation"], gameModes: ["Co-op"] },
  { title: "Rocket League", platforms: ["Epic Games Store", "PC", "Xbox", "PlayStation", "Switch"], gameModes: ["Multiplayer"] },
  { title: "Among Us", platforms: ["PC", "Mobile", "Console"], gameModes: ["Multiplayer"] },
];

export function normalizeGameTitle(title: string) {
  return title.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function upsertGame(input: GameInput) {
  const data = gameInputToData(input);

  if (input.steamAppId) {
    return prisma.game.upsert({
      where: { steamAppId: input.steamAppId },
      create: data,
      update: data,
    });
  }

  if (input.igdbId) {
    return prisma.game.upsert({
      where: { igdbId: input.igdbId },
      create: data,
      update: data,
    });
  }

  const existing = await prisma.game.findFirst({
    where: { normalizedTitle: normalizeGameTitle(input.title) },
  });

  if (existing) {
    return prisma.game.update({ where: { id: existing.id }, data });
  }

  return prisma.game.create({ data });
}

export async function addGameToSession({
  sessionId,
  gameId,
  participantId,
  userId,
  source,
  signal = "AVAILABLE_TO_PLAY",
}: {
  sessionId: string;
  gameId: string;
  participantId?: string | null;
  userId?: string | null;
  source: Prisma.SessionGameCreateInput["source"];
  signal?: Prisma.SessionGameSignalCreateInput["signal"];
}) {
  const sessionGame = await prisma.sessionGame.upsert({
    where: { sessionId_gameId: { sessionId, gameId } },
    create: {
      sessionId,
      gameId,
      addedByParticipantId: participantId ?? null,
      addedByUserId: userId ?? null,
      source,
    },
    update: {},
  });

  if (participantId) {
    await prisma.sessionGameSignal.upsert({
      where: { sessionGameId_participantId: { sessionGameId: sessionGame.id, participantId } },
      create: {
        sessionGameId: sessionGame.id,
        participantId,
        signal,
      },
      update: { signal },
    });
  }

  return sessionGame;
}

export async function importSteamGamesForUser(userId: string, games: SteamOwnedGame[], recentGames: SteamRecentlyPlayedGame[]) {
  const recentAppIds = new Set(recentGames.map((game) => game.appid));
  const recentPlaytime = new Map(recentGames.map((game) => [game.appid, game.playtime_2weeks ?? 0]));
  const now = new Date();

  for (const steamGame of games) {
    if (!steamGame.name) {
      continue;
    }

    const game = await upsertGame({
      title: steamGame.name,
      steamAppId: steamGame.appid,
    });

    await prisma.userGame.upsert({
      where: { userId_gameId: { userId, gameId: game.id } },
      create: {
        userId,
        gameId: game.id,
        source: "STEAM",
        playtimeMinutes: steamGame.playtime_forever ?? 0,
        recentlyPlayedAt: recentAppIds.has(steamGame.appid) ? now : null,
        lastImportedAt: now,
      },
      update: {
        source: "STEAM",
        playtimeMinutes: steamGame.playtime_forever ?? 0,
        recentlyPlayedAt: recentAppIds.has(steamGame.appid) && (recentPlaytime.get(steamGame.appid) ?? 0) > 0 ? now : undefined,
        lastImportedAt: now,
      },
    });
  }
}

export function rankSessionGames<
  T extends {
    game: Game;
    source: string;
    signals: Array<{ signal: string }>;
  },
>(sessionGames: T[]) {
  return [...sessionGames].sort((a, b) => {
    const aOwned = countSignals(a, "OWNED");
    const bOwned = countSignals(b, "OWNED");

    if (bOwned !== aOwned) {
      return bOwned - aOwned;
    }

    const aAvailable = countSignals(a, "AVAILABLE_TO_PLAY");
    const bAvailable = countSignals(b, "AVAILABLE_TO_PLAY");

    if (bAvailable !== aAvailable) {
      return bAvailable - aAvailable;
    }

    const aPopularity = a.game.popularityScore ?? 0;
    const bPopularity = b.game.popularityScore ?? 0;

    if (bPopularity !== aPopularity) {
      return bPopularity - aPopularity;
    }

    return a.game.title.localeCompare(b.game.title);
  });
}

function countSignals(sessionGame: { signals: Array<{ signal: string }> }, signal: string) {
  return sessionGame.signals.filter((candidate) => candidate.signal === signal).length;
}

function gameInputToData(input: GameInput) {
  return {
    title: input.title.trim(),
    normalizedTitle: normalizeGameTitle(input.title),
    steamAppId: input.steamAppId ?? null,
    igdbId: input.igdbId ?? null,
    coverUrl: input.coverUrl ?? null,
    summary: input.summary ?? null,
    genres: input.genres ?? [],
    platforms: input.platforms ?? [],
    gameModes: input.gameModes ?? [],
    popularityScore: input.popularityScore ?? null,
  };
}
