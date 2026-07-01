import { describe, expect, it } from "vitest";
import { findCuratedGameForGame, mergeCuratedMetadata } from "@/lib/curated-metadata";

describe("curated metadata", () => {
  it("finds curated player metadata by Steam app id", () => {
    const game = findCuratedGameForGame({ title: "Unknown title", steamAppId: 108600 });

    expect(game?.title).toBe("Project Zomboid");
    expect(game?.maxPlayers).toBe(32);
  });

  it("merges curated player metadata into sparse game inputs", () => {
    const game = mergeCuratedMetadata({ title: "Big Walk", steamAppId: 1478500 });

    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(12);
    expect(game.onlineCoop).toBe(true);
    expect(game.localCoop).toBe(false);
    expect(game.capabilitySource).toBe("curated");
  });

  it("overrides stale capability values for known curated games", () => {
    const baldursGate = mergeCuratedMetadata({
      title: "Baldur's Gate 3",
      steamAppId: 1086940,
      onlineCoop: false,
      localCoop: false,
      maxPlayers: 1,
    });
    const golf = mergeCuratedMetadata({
      title: "Golf With Your Friends",
      steamAppId: 431240,
      onlineCoop: true,
    });

    expect(baldursGate).toMatchObject({
      onlineCoop: true,
      campaignCoop: true,
      maxPlayers: 4,
    });
    expect(golf).toMatchObject({
      onlineCoop: false,
      onlineMultiplayer: true,
      maxPlayers: 12,
    });
  });
});
