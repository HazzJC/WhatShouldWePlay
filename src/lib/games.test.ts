import { describe, expect, it } from "vitest";
import { normalizeGameTitle, rankSessionGames } from "@/lib/games";

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
