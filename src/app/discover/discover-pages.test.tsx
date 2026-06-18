import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DiscoverPage from "@/app/discover/page";
import DiscoverListPage from "@/app/discover/[slug]/page";
import GameDetailPage from "@/app/games/[slug]/page";

describe("curated discovery pages", () => {
  it("renders public curated categories", async () => {
    render(await DiscoverPage({ searchParams: Promise.resolve({ minPlayers: "50" }) }));

    expect(screen.getByText("Best online co-op games")).toBeInTheDocument();
    expect(screen.getByText("More than 4?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Pick" })).toBeInTheDocument();
    expect(screen.getAllByText(/50\+ players/)[0]).toBeInTheDocument();
  });

  it("renders a category list", async () => {
    render(await DiscoverListPage({ params: Promise.resolve({ slug: "more-than-4" }), searchParams: Promise.resolve({ minPlayers: "16" }) }));

    expect(screen.getByText("More than 4?")).toBeInTheDocument();
    expect(screen.getByText("Project Zomboid")).toBeInTheDocument();
    expect(screen.getByText("Meccha Chameleon")).toBeInTheDocument();
  });

  it("renders a curated game detail page", async () => {
    render(await GameDetailPage({ params: Promise.resolve({ slug: "deep-rock-galactic" }) }));

    expect(screen.getByText("Deep Rock Galactic")).toBeInTheDocument();
    expect(screen.getByText("Start a Pick shortlist")).toBeInTheDocument();
  });
});
