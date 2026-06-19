import type { Game, Prisma } from "@prisma/client";
import { mapIgdbGame, searchIgdbGames } from "@/lib/igdb";
import { prisma } from "@/lib/prisma";
import type { SteamOwnedGame, SteamRecentlyPlayedGame } from "@/lib/steam";

export type GameInput = {
  gameId?: string;
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
  steamReviewScore?: number | null;
  steamReviewPercent?: number | null;
  steamReviewTotal?: number | null;
  steamReviewSummary?: string | null;
  qualitySource?: string | null;
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

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

// Maps a persisted Game row to the GameInput shape used by the add-game UI,
// carrying the existing `gameId` so adding it references the saved row directly
// (no re-upsert, no metadata re-fetch).
export function gameRecordToInput(game: Game): GameInput {
  return {
    gameId: game.id,
    title: game.title,
    steamAppId: game.steamAppId,
    igdbId: game.igdbId,
    coverUrl: game.coverUrl,
    summary: game.summary,
    genres: toStringList(game.genres),
    platforms: toStringList(game.platforms),
    gameModes: toStringList(game.gameModes),
    popularityScore: game.popularityScore,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    onlineCoop: game.onlineCoop,
    localCoop: game.localCoop,
    capabilitySource: game.capabilitySource,
    capabilityConfidence: game.capabilityConfidence,
    steamReviewScore: game.steamReviewScore,
    steamReviewPercent: game.steamReviewPercent,
    steamReviewTotal: game.steamReviewTotal,
    steamReviewSummary: game.steamReviewSummary,
    qualitySource: game.qualitySource,
  };
}

function gameInputKey(game: GameInput) {
  if (game.steamAppId) {
    return `steam:${game.steamAppId}`;
  }
  if (game.igdbId) {
    return `igdb:${game.igdbId}`;
  }
  return `title:${normalizeGameTitle(game.title)}`;
}

function dedupeGameInputs(games: GameInput[]) {
  const seen = new Set<string>();
  const unique: GameInput[] = [];

  for (const game of games) {
    const key = gameInputKey(game);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(game);
  }

  return unique;
}

// Searches the games we have already saved across every group. Because games
// are deduplicated server-side, anything any group has added or imported before
// is found here instantly and for free (no external API call).
export async function searchLocalGames(query: string, limit = 8): Promise<GameInput[]> {
  const normalized = normalizeGameTitle(query);

  if (normalized.length < 2) {
    return [];
  }

  // `contains` (LIKE '%term%') is served by the GIN trigram index on
  // normalizedTitle (see migration 20260619180000), so this stays fast as the
  // catalog grows. Nulls last keeps games with known reviews/popularity above
  // freshly-imported rows that have no metadata yet.
  const games = await prisma.game.findMany({
    where: { normalizedTitle: { contains: normalized } },
    orderBy: [
      { steamReviewTotal: { sort: "desc", nulls: "last" } },
      { popularityScore: { sort: "desc", nulls: "last" } },
      { title: "asc" },
    ],
    take: limit,
  });

  return games.map(gameRecordToInput);
}

// Catalog-first search: surface previously-seen games immediately, and only
// reach out to IGDB when the local catalog can't satisfy the query. This makes
// the catalog richer and faster the more the app is used, and cuts external
// API calls for games we already know.
export async function searchGamesCatalog(query: string, localLimit = 8): Promise<GameInput[]> {
  const localResults = await searchLocalGames(query, localLimit);

  if (localResults.length >= 5) {
    return localResults;
  }

  const igdbResults = (await searchIgdbGames(query)).map(mapIgdbGame);

  return dedupeGameInputs([...localResults, ...igdbResults]);
}

export async function upsertGame(input: GameInput) {
  const createData = gameInputToData(input, "create");
  const updateData = gameInputToData(input, "update");

  if (input.steamAppId) {
    return prisma.game.upsert({
      where: { steamAppId: input.steamAppId },
      create: createData,
      update: updateData,
    });
  }

  if (input.igdbId) {
    return prisma.game.upsert({
      where: { igdbId: input.igdbId },
      create: createData,
      update: updateData,
    });
  }

  const existing = await prisma.game.findFirst({
    where: { normalizedTitle: normalizeGameTitle(input.title) },
  });

  if (existing) {
    return prisma.game.update({ where: { id: existing.id }, data: updateData });
  }

  return prisma.game.create({ data: createData });
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

  if (participantId && userId && (!sessionGame.addedByParticipantId || sessionGame.addedByParticipantId === participantId) && !sessionGame.addedByUserId) {
    await prisma.sessionGame.update({
      where: { id: sessionGame.id },
      data: {
        addedByParticipantId: sessionGame.addedByParticipantId ?? participantId,
        addedByUserId: userId,
      },
    });
  }

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
  const importableGames = uniqueSteamGames(games.filter((steamGame) => steamGame.name && steamGame.appid));

  if (importableGames.length === 0) {
    return { gameIds: [] as string[] };
  }

  for (const chunk of chunks(importableGames, 500)) {
    await prisma.game.createMany({
      data: chunk.map((steamGame) => ({
        title: steamGame.name!,
        normalizedTitle: normalizeGameTitle(steamGame.name!),
        steamAppId: steamGame.appid,
      })),
      skipDuplicates: true,
    });
  }

  const importedGames = await prisma.game.findMany({
    where: { steamAppId: { in: importableGames.map((steamGame) => steamGame.appid) } },
    select: { id: true, steamAppId: true },
  });
  const gameIdBySteamAppId = new Map(importedGames.map((game) => [game.steamAppId, game.id]));
  const userGameRows = importableGames
    .map((steamGame) => {
      const gameId = gameIdBySteamAppId.get(steamGame.appid);

      if (!gameId) {
        return null;
      }

      return {
        userId,
        gameId,
        source: "STEAM" as const,
        playtimeMinutes: steamGame.playtime_forever ?? 0,
        recentlyPlayedAt: recentAppIds.has(steamGame.appid) ? now : null,
        lastImportedAt: now,
        steamAppId: steamGame.appid,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  for (const chunk of chunks(userGameRows, 500)) {
    await prisma.userGame.createMany({
      data: chunk.map((row) => ({
        userId: row.userId,
        gameId: row.gameId,
        source: row.source,
        playtimeMinutes: row.playtimeMinutes,
        recentlyPlayedAt: row.recentlyPlayedAt,
        lastImportedAt: row.lastImportedAt,
      })),
      skipDuplicates: true,
    });
  }

  for (const chunk of chunks(userGameRows, 50)) {
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.userGame.update({
          where: { userId_gameId: { userId, gameId: row.gameId } },
          data: {
            source: "STEAM",
            playtimeMinutes: row.playtimeMinutes,
            recentlyPlayedAt: recentAppIds.has(row.steamAppId) && (recentPlaytime.get(row.steamAppId) ?? 0) > 0 ? now : undefined,
            lastImportedAt: now,
          },
        }),
      ),
    );
  }

  return { gameIds: userGameRows.map((row) => row.gameId) };
}

function uniqueSteamGames(games: SteamOwnedGame[]) {
  const seen = new Set<number>();
  const unique: SteamOwnedGame[] = [];

  for (const game of games) {
    if (seen.has(game.appid)) {
      continue;
    }

    seen.add(game.appid);
    unique.push(game);
  }

  return unique;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
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

function gameInputToData(input: GameInput, mode: "create" | "update") {
  const absent = mode === "update" ? undefined : null;
  const absentArray = mode === "update" ? undefined : [];

  return {
    title: input.title.trim(),
    normalizedTitle: normalizeGameTitle(input.title),
    steamAppId: input.steamAppId ?? absent,
    igdbId: input.igdbId ?? absent,
    coverUrl: input.coverUrl ?? absent,
    summary: input.summary ?? absent,
    genres: input.genres ?? absentArray,
    platforms: input.platforms ?? absentArray,
    gameModes: input.gameModes ?? absentArray,
    popularityScore: input.popularityScore ?? absent,
    steamReviewScore: input.steamReviewScore ?? absent,
    steamReviewPercent: input.steamReviewPercent ?? absent,
    steamReviewTotal: input.steamReviewTotal ?? absent,
    steamReviewSummary: input.steamReviewSummary ?? absent,
    qualitySource: input.qualitySource ?? absent,
    qualityFetchedAt: input.qualitySource ? new Date() : absent,
    minPlayers: input.minPlayers ?? absent,
    maxPlayers: input.maxPlayers ?? inferMaxPlayers(input) ?? absent,
    onlineCoop: input.onlineCoop ?? inferOnlineCoop(input) ?? absent,
    localCoop: input.localCoop ?? inferLocalCoop(input) ?? absent,
    capabilitySource: input.capabilitySource ?? inferCapabilitySource(input) ?? absent,
    capabilityConfidence: input.capabilityConfidence ?? inferCapabilityConfidence(input) ?? absent,
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
