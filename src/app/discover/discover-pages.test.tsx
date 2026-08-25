import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DiscoverPage from "@/app/discover/page";
import DiscoverListPage from "@/app/discover/[slug]/page";
import GameDetailPage from "@/app/games/[slug]/page";

vi.mock("@/lib/curated-deals", () => ({
  enrichCuratedGamesWithDeals: vi.fn(async (games) =>
    games.map((game: { slug: string }) => ({
      ...game,
      deal:
        game.slug === "meccha-chameleon"
          ? { currentPrice: 499, currency: "GBP", discountPercent: 25 }
          : null,
    })),
  ),
  enrichedCuratedGame: vi.fn(async (slug: string) =>
    slug === "deep-rock-galactic"
      ? {
          slug,
          title: "Deep Rock Galactic",
          description: "Co-op mining chaos with strong 4-player teamwork.",
          tags: ["co-op", "shooter"],
          releaseStatus: "released",
          minPlayers: 1,
          maxPlayers: 4,
          onlineCoop: true,
          localCoop: false,
          caveat: null,
          moddedPlayersLabel: null,
          moddedSupportNote: null,
          moddedUnrestricted: false,
          deal: { currentPrice: 749, currency: "GBP", discountPercent: 50 },
        }
      : null,
  ),
  sortCuratedGamesForDiscovery: vi.fn((games) =>
    [...games].sort((a, b) => (b.deal?.discountPercent ?? 0) - (a.deal?.discountPercent ?? 0)),
  ),
  curatedPriceLabel: vi.fn((game) =>
    game.deal?.currentPrice !== null && game.deal?.currentPrice !== undefined ? `£${(game.deal.currentPrice / 100).toFixed(2)}` : "Price unavailable",
  ),
  curatedSaleLabel: vi.fn((game) => (game.deal?.discountPercent ? `${game.deal.discountPercent}% off` : null)),
}));

describe("curated discovery pages", () => {
  it("offers three distinct ways into the catalogue", async () => {
    render(await DiscoverPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Choose by group size")).toBeInTheDocument();
    expect(screen.getByText("Choose by difficulty")).toBeInTheDocument();
    expect(screen.getByText("Choose by duration")).toBeInTheDocument();
    expect(screen.getByText(/Overcooked! 2 and Minecraft/)).toBeInTheDocument();
    expect(screen.getByText(/Factorio \+ Space Exploration/)).toBeInTheDocument();
    expect(screen.queryByText("Best online co-op games")).not.toBeInTheDocument();
  });

  it("renders public curated categories", async () => {
    render(await DiscoverPage({ searchParams: Promise.resolve({ path: "players", minPlayers: "50" }) }));

    expect(screen.getByText("Best online co-op games")).toBeInTheDocument();
    expect(screen.getByText("More than 4?")).toBeInTheDocument();
    expect(screen.getByText("With mods")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Pick" })).toBeInTheDocument();
    expect(screen.getAllByText(/50\+ players/)[0]).toBeInTheDocument();
  });

  it("filters by learning difficulty", async () => {
    render(await DiscoverPage({ searchParams: Promise.resolve({ path: "difficulty", difficulty: "5" }) }));

    expect(screen.getByRole("heading", { name: "Brutal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GTFO" })).toBeInTheDocument();
    expect(screen.queryByText("Overcooked! 2")).not.toBeInTheDocument();
  });

  it("filters by overall commitment", async () => {
    render(await DiscoverPage({ searchParams: Promise.resolve({ path: "duration", duration: "epic" }) }));

    expect(screen.getByRole("heading", { name: "The long haul" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Factorio" })).toBeInTheDocument();
    expect(screen.getByText(/Space Exploration mod campaign/)).toBeInTheDocument();
  });

  it("renders a category list", async () => {
    render(await DiscoverListPage({ params: Promise.resolve({ slug: "more-than-4" }), searchParams: Promise.resolve({ minPlayers: "16" }) }));

    expect(screen.getByText("More than 4?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project Zomboid" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meccha Chameleon" })).toBeInTheDocument();
    expect(screen.getByText("£4.99")).toBeInTheDocument();
    expect(screen.getByText("25% off")).toBeInTheDocument();
  });

  it("renders modded multiplayer caveats in the with-mods list", async () => {
    render(await DiscoverListPage({ params: Promise.resolve({ slug: "with-mods" }), searchParams: Promise.resolve({ minPlayers: "8" }) }));

    expect(screen.getByText("With mods")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "RimWorld" })).toBeInTheDocument();
    expect(screen.getAllByText(/1 player, 2-8 with mods/)[0]).toBeInTheDocument();
    expect(screen.getAllByText("Modded setup")[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Solo by default/)[0]).toBeInTheDocument();
  });

  it("renders a curated game detail page", async () => {
    render(await GameDetailPage({ params: Promise.resolve({ slug: "deep-rock-galactic" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Deep Rock Galactic" })).toBeInTheDocument();
    expect(screen.getByText("£7.49")).toBeInTheDocument();
    expect(screen.getByText("50% off")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Put this on the shortlist" })).toHaveAttribute("href", "/sessions/pick?game=deep-rock-galactic");
  });
});
