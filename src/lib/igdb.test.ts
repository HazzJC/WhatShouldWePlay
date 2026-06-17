import { describe, expect, it } from "vitest";
import { mapIgdbGame } from "@/lib/igdb";

describe("igdb helpers", () => {
  it("maps IGDB search results into unified game input", () => {
    expect(
      mapIgdbGame({
        id: 42,
        name: "Deep Rock Galactic",
        summary: "Space mining.",
        cover: { url: "//images.igdb.com/cover.jpg" },
        genres: [{ name: "Shooter" }],
        platforms: [{ name: "PC" }],
        game_modes: [{ name: "Co-operative" }],
        total_rating: 90,
      }),
    ).toMatchObject({
      igdbId: 42,
      title: "Deep Rock Galactic",
      coverUrl: "https://images.igdb.com/cover.jpg",
      genres: ["Shooter"],
      platforms: ["PC"],
      gameModes: ["Co-operative"],
      popularityScore: 90,
    });
  });
});
