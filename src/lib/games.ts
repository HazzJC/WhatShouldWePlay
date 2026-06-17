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
  minPlayers?: number | null;
  maxPlayers?: number | null;
  onlineCoop?: boolean | null;
  localCoop?: boolean | null;
  capabilitySource?: string | null;
  capabilityConfidence?: number | null;
};

export const defaultAddedGameSignal = "OWNED";

export const commonMultiplayerGames: GameInput[] = [
  { title: "Minecraft", platforms: ["PC", "Xbox", "PlayStation", "Switch", "Mobile"], gameModes: ["Multiplayer", "Co-op"], minPlayers: 1, maxPlayers: 8, onlineCoop: true, localCoop: true, capabilitySource: "curated", capabilityConfidence: 0.8 },
  { title: "League of Legends", platforms: ["PC"], gameModes: ["Multiplayer"], minPlayers: 2, maxPlayers: 5, onlineCoop: false, localCoop: false, capabilitySource: "curated", capabilityConfidence: 0.8 },
  { title: "Valorant", platforms: ["PC", "Console"], gameModes: ["Multiplayer"], minPlayers: 2, maxPlayers: 5, onlineCoop: false, localCoop: false, capabilitySource: "curated", capabilityConfidence: 0.8 },
  { title: "Fortnite", platforms: ["PC", "Xbox", "PlayStation", "Switch", "Mobile"], gameModes: ["Multiplayer", "Co-op"], minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false, capabilitySource: "curated", capabilityConfidence: 0.75 },
  { title: "Roblox", platforms: ["PC", "Xbox", "PlayStation", "Mobile"], gameModes: ["Multiplayer"], minPlayers: 1, maxPlayers: 8, onlineCoop: true, localCoop: false, capabilitySource: "curated", capabilityConfidence: 0.7 },
  { title: "World of Warcraft", platforms: ["PC"], gameModes: ["Massively Multiplayer", "Co-op"], minPlayers: 1, maxPlayers: 5, onlineCoop: true, localCoop: false, capabilitySource: "curated", capabilityConfidence: 0.8 },
  { title: "Final Fantasy XIV", platforms: ["PC", "PlayStation", "Xbox"], gameModes: ["Massively Multiplayer", "Co-op"], minPlayers: 1, maxPlayers: 8, onlineCoop: true, localCoop: false, capabilitySource: "curated", capabilityConfidence: 0.8 },
  { title: "Sea of Thieves", platforms: ["Game Pass", "Steam", "Xbox", "PlayStation"], gameModes: ["Co-op"], minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false, capabilitySource: "curated", capabilityConfidence: 0.85 },
  { title: "Rocket League", platforms: ["Epic Games Store", "PC", "Xbox", "PlayStation", "Switch"], gameModes: ["Multiplayer", "Co-op"], minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: true, capabilitySource: "curated", capabilityConfidence: 0.8 },
  { title: "Among Us", platforms: ["PC", "Mobile", "Console"], gameModes: ["Multiplayer"], minPlayers: 4, maxPlayers: 15, onlineCoop: true, localCoop: true, capabilitySource: "curated", capabilityConfidence: 0.8 },
];

export function normalizeGameTitle(title: string) {
  return title.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function excludeExistingGames(games: GameInput[], existingGames: Array<{ normalizedTitle: string }>) {
  const existingTitles = new Set(existingGames.map((game) => game.normalizedTitle));

  return games.filter((game) => !existingTitles.has(normalizeGameTitle(game.title)));
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
  signal = defaultAddedGameSignal,
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
    const aOwned = countHaveSignals(a);
    const bOwned = countHaveSignals(b);

    if (bOwned !== aOwned) {
      return bOwned - aOwned;
    }

    const aPopularity = a.game.popularityScore ?? 0;
    const bPopularity = b.game.popularityScore ?? 0;

    if (bPopularity !== aPopularity) {
      return bPopularity - aPopularity;
    }

    return a.game.title.localeCompare(b.game.title);
  });
}

export function countHaveSignals(sessionGame: { signals: Array<{ signal: string }> }) {
  return sessionGame.signals.filter((candidate) => candidate.signal === "OWNED" || candidate.signal === "AVAILABLE_TO_PLAY").length;
}

export function countDontHaveSignals(sessionGame: { signals: Array<{ signal: string }> }) {
  return sessionGame.signals.filter((candidate) => candidate.signal === "NOT_AVAILABLE").length;
}

export function signalMeansHave(signal?: string | null) {
  return signal === "OWNED" || signal === "AVAILABLE_TO_PLAY";
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
    minPlayers: input.minPlayers ?? null,
    maxPlayers: input.maxPlayers ?? inferMaxPlayers(input),
    onlineCoop: input.onlineCoop ?? inferOnlineCoop(input),
    localCoop: input.localCoop ?? inferLocalCoop(input),
    capabilitySource: input.capabilitySource ?? inferCapabilitySource(input),
    capabilityConfidence: input.capabilityConfidence ?? inferCapabilityConfidence(input),
  };
}

function inferOnlineCoop(input: GameInput) {
  const modes = (input.gameModes ?? []).join(" ").toLocaleLowerCase();
  return modes.includes("co-op") || modes.includes("cooperative") || modes.includes("multiplayer") || modes.includes("massively");
}

function inferLocalCoop(input: GameInput) {
  const modes = (input.gameModes ?? []).join(" ").toLocaleLowerCase();
  return modes.includes("split screen") || modes.includes("local");
}

function inferMaxPlayers(input: GameInput) {
  const modes = (input.gameModes ?? []).join(" ").toLocaleLowerCase();

  if (modes.includes("massively")) {
    return 8;
  }

  if (modes.includes("multiplayer") || modes.includes("co-op")) {
    return 4;
  }

  return null;
}

function inferCapabilitySource(input: GameInput) {
  if (input.capabilitySource) {
    return input.capabilitySource;
  }

  if ((input.gameModes?.length ?? 0) > 0) {
    return "metadata";
  }

  return null;
}

function inferCapabilityConfidence(input: GameInput) {
  if (input.capabilityConfidence !== undefined) {
    return input.capabilityConfidence;
  }

  if (input.capabilitySource === "curated") {
    return 0.8;
  }

  if ((input.gameModes?.length ?? 0) > 0) {
    return 0.45;
  }

  return null;
}
