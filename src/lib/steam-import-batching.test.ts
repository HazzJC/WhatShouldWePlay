import { beforeEach, describe, expect, it, vi } from "vitest";

const gameCreateMany = vi.fn(async () => ({ count: 0 }));
const gameFindMany = vi.fn(async () => []);
const userGameCreateMany = vi.fn(async () => ({ count: 0 }));
const userGameUpdate = vi.fn((args) => Promise.resolve(args));
const transaction = vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
    game: {
      createMany: gameCreateMany,
      findMany: gameFindMany,
    },
    userGame: {
      createMany: userGameCreateMany,
      update: userGameUpdate,
    },
  },
}));

describe("Steam import batching", () => {
  beforeEach(() => {
    vi.resetModules();
    gameCreateMany.mockClear();
    gameFindMany.mockReset();
    userGameCreateMany.mockClear();
    userGameUpdate.mockClear();
    transaction.mockClear();
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
          expect.objectContaining({ gameId: "game-1", source: "STEAM", playtimeMinutes: 600 }),
          expect.objectContaining({ gameId: "game-2", source: "STEAM", playtimeMinutes: 30 }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userGameUpdate).toHaveBeenCalledTimes(2);
    expect(result.gameIds).toEqual(["game-1", "game-2"]);
  });
});
