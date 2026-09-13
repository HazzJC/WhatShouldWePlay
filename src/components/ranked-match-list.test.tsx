import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RankedMatchList } from "@/components/ranked-match-list";
import type { ScoredGame } from "@/lib/match-scoring";

describe("RankedMatchList", () => {
  it("keeps the full score and ownership evidence available while revealing later matches", () => {
    const games = Array.from({ length: 17 }, (_, index) => scoredGame(index + 1));

    render(
      <RankedMatchList
        games={games}
        provisional={false}
        selectedProfiles={2}
        requestedPlayers={2}
        getDetailHref={(game) => `/games/${game.gameId}`}
        renderActions={(game) => <button type="button">Shortlist {game.title}</button>}
      />,
    );

    expect(screen.getByText("Game 16")).toBeInTheDocument();
    expect(screen.queryByText("Game 17")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Ownership breakdown")[0]).toHaveTextContent("1 have, 0 don't have, 1 unknown, 1 missing profile");
    expect(screen.getAllByText("Historical low")).toHaveLength(16);
    expect(screen.getAllByRole("link", { name: "Inspect details" })[0]).toHaveAttribute("href", "/games/g1");
    expect(screen.getByRole("button", { name: "Shortlist Game 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 1 more matches" }));

    expect(screen.getByText("Game 17")).toBeInTheDocument();
  });
});

function scoredGame(number: number): ScoredGame {
  return {
    sessionGameId: `sg${number}`,
    gameId: `g${number}`,
    title: `Game ${number}`,
    score: 90,
    alignment: "High",
    reasons: ["A complete explanation", "No hidden reason"],
    alignmentReasons: ["No selected player has a veto or strong mismatch"],
    categories: ["perfect"],
    factors: {
      ownership: 100, playerCount: 95, genreFit: 80, availability: 100, onlineCoop: 90, localCoop: 90, playtime: 60, freshness: 80,
      interest: 60, price: 35, historicalLow: 40, popularity: 80, multiplayerFit: 95, durationFit: 90, personalRating: 85,
    },
    factorBreakdown: [
      { key: "ownership", label: "Ownership", value: 100, weight: 0.2, points: 20 },
      { key: "historicalLow", label: "Historical low", value: 40, weight: 0.1, points: 4 },
      { key: "personalRating", label: "Personal rating", value: 85, weight: 0.1, points: 8.5 },
    ],
    ownership: { have: 1, dontHave: 0, unknown: 1, missing: 1, selected: 2 },
    playtimeMinutes: 40,
    discountPercent: 0,
    currentPrice: null,
    historicalLow: null,
    playerCountStatus: "supported",
  };
}
