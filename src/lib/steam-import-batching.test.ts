import { beforeEach, describe, expect, it, vi } from "vitest";

const gameCreateMany = vi.fn(async () => ({ count: 0 }));
const gameFindMany = vi.fn(async (): Promise<Array<{ id: string; steamAppId: number | null }>> => []);
const userGameCreateMany = vi.fn(async () => ({ count: 0 }));
const userGameUpdateMany = vi.fn(async () => ({ count: 0 }));
const executeRaw = vi.fn(async () => 2);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: executeRaw,
    game: {
      createMany: gameCreateMany,
      findMany: gameFindMany,
    },
    userGame: {
      createMany: userGameCreateMany,
      updateMany: userGameUpdateMany,
    },
  },
}));

describe("Steam import batching", () => {
  beforeEach(() => {
    vi.resetModules();
    gameCreateMany.mockClear();
    gameFindMany.mockReset();
    userGameCreateMany.mockClear();
    userGameUpdateMany.mockClear();
    executeRaw.mockClear();
  });

  it("preserves unified game and user ownership writes in batches", async () => {
    gameFindMany.mockResolvedValueOnce([
      { id: "game-1", steamAppId: 1 },
      { id: "game-2", steamAppId: 2 },
    ]);
    const { importSteamGamesForUser } = await import("@/lib/games");

    const result = await importSteamGamesForUser(
      "user-1",
      [
        { appid: 1, name: "Deep Rock Galactic", playtime_forever: 600 },
        { appid: 1, name: "Deep Rock Galactic duplicate", playtime_forever: 200 },
        { appid: 2, name: "Valheim", playtime_forever: 30 },
      ],
      [{ appid: 1, name: "Deep Rock Galactic", playtime_2weeks: 45 }],
    );

    expect(gameCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ steamAppId: 1, title: "Deep Rock Galactic" }),
          expect.objectContaining({ steamAppId: 2, title: "Valheim" }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(userGameCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ gameId: "game-1", source: "STEAM", platforms: ["PC"], playtimeMinutes: 600 }),
          expect.objectContaining({ gameId: "game-2", source: "STEAM", platforms: ["PC"], playtimeMinutes: 30 }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(userGameUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        source: "STEAM",
        ownership: "HAVE",
        gameId: { notIn: ["game-1", "game-2"] },
      },
      data: expect.objectContaining({ ownership: "UNKNOWN" }),
    });
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(result.gameIds).toEqual(["game-1", "game-2"]);
  });
});
