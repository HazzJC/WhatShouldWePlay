import { afterEach, describe, expect, it, vi } from "vitest";
import { mapIgdbGame } from "@/lib/igdb";

describe("igdb helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.IGDB_CLIENT_ID;
    delete process.env.IGDB_CLIENT_SECRET;
  });

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

  it("caches popular discovery results during the server TTL", async () => {
    process.env.IGDB_CLIENT_ID = "client-id";
    process.env.IGDB_CLIENT_SECRET = "client-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 }),
    ).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 1, name: "Deep Rock Galactic" }]), { status: 200 }),
    );
    const { getPopularIgdbGames } = await import("@/lib/igdb");

    await expect(getPopularIgdbGames()).resolves.toEqual([{ id: 1, name: "Deep Rock Galactic" }]);
    await expect(getPopularIgdbGames()).resolves.toEqual([{ id: 1, name: "Deep Rock Galactic" }]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
