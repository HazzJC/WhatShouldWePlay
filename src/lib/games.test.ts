import { describe, expect, it } from "vitest";
import { countHaveSignals, defaultAddedGameSignal, excludeExistingGames, normalizeGameTitle, rankSessionGames } from "@/lib/games";

describe("game helpers", () => {
  it("normalizes titles for manual game matching", () => {
    expect(normalizeGameTitle("  Deep Rock: Galactic! ")).toBe("deep rock galactic");
  });

  it("ranks shared ownership above popularity", () => {
    const ranked = rankSessionGames([
      {
        source: "POPULAR",
        game: game("Popular Solo", 100),
        signals: [{ signal: "AVAILABLE_TO_PLAY" }],
      },
      {
        source: "STEAM_MATCH",
        game: game("Shared Owned", 5),
        signals: [{ signal: "OWNED" }, { signal: "OWNED" }],
      },
    ]);

    expect(ranked[0].game.title).toBe("Shared Owned");
  });

  it("treats legacy available-to-play signals as have", () => {
    expect(countHaveSignals({ signals: [{ signal: "AVAILABLE_TO_PLAY" }, { signal: "OWNED" }] })).toBe(2);
  });

  it("defaults added games to owned", () => {
    expect(defaultAddedGameSignal).toBe("OWNED");
  });

  it("excludes games already present in the session", () => {
    expect(
      excludeExistingGames(
        [{ title: "Minecraft" }, { title: "Valorant" }],
        [{ normalizedTitle: "minecraft" }],
      ),
    ).toEqual([{ title: "Valorant" }]);
  });
});

function game(title: string, popularityScore: number) {
  return {
    id: title,
    title,
    normalizedTitle: normalizeGameTitle(title),
    steamAppId: null,
    igdbId: null,
    coverUrl: null,
    summary: null,
    genres: [],
    platforms: [],
    gameModes: [],
    popularityScore,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
