import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PickPanel } from "@/components/pick-panel";

vi.mock("@/app/actions", () => ({
  addSessionGameAction: vi.fn(),
  importSteamLibraryAction: vi.fn(),
  markGameInterestAction: vi.fn(),
  markGameAvailableAction: vi.fn(),
  removeSessionGameAction: vi.fn(),
  updatePreferenceAction: vi.fn(),
}));

const baseProps = {
  shareToken: "share",
  participantId: "p2",
  currentUser: null,
  searchResults: [],
  popularGames: [],
  trendingGames: [],
  commonGames: [],
  searchQuery: "",
  participants: [
    participant("p1", "Alex"),
    participant("p2", "Sam"),
  ],
  selectedParticipantIds: ["p1", "p2"],
  selectedPlayerCount: 2,
  scoreMode: "balanced" as const,
  scoredGames: [
    {
      sessionGameId: "sg1",
      gameId: "g1",
      title: "Portal 2",
      score: 91,
      alignment: "High" as const,
      reasons: ["2/2 selected players have it", "Supports the selected 2 player group"],
      categories: ["perfect" as const],
      factors: {
        ownership: 100,
        playerCount: 95,
        coopFit: 90,
        playtime: 60,
        freshness: 80,
        interest: 60,
        sale: 35,
        popularity: 80,
      },
      ownership: { have: 2, missing: 0, selected: 2 },
      playtimeMinutes: 40,
      discountPercent: 0,
    },
  ],
};

describe("PickPanel", () => {
  it("collapses existing games for a new participant", () => {
    render(
      <PickPanel
        {...baseProps}
        sessionGames={[sessionGame([{ participantId: "p1", signal: "OWNED" }])]}
        currentParticipantHasPickSignals={false}
      />,
    );

    expect(screen.getByText("Review games already added")).toBeInTheDocument();
    expect(screen.getByTestId("session-games-review")).not.toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Connect Steam" })).toBeInTheDocument();
  });

  it("expands the group list when the participant has game signals", () => {
    render(
      <PickPanel
        {...baseProps}
        sessionGames={[sessionGame([{ participantId: "p2", signal: "OWNED" }])]}
        currentParticipantHasPickSignals={true}
      />,
    );

    expect(screen.getByText("Best shared options")).toBeInTheDocument();
    expect(screen.getByTestId("session-games-review")).toHaveAttribute("open");
  });

  it("shows only have and don't have ownership actions", () => {
    render(
      <PickPanel
        {...baseProps}
        sessionGames={[sessionGame([{ participantId: "p2", signal: "AVAILABLE_TO_PLAY" }])]}
        currentParticipantHasPickSignals={true}
      />,
    );

    expect(screen.getByRole("button", { name: "Have" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Don't have" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Can play" })).not.toBeInTheDocument();
  });

  it("shows the group matching dashboard with scores and preset modes", () => {
    render(
      <PickPanel
        {...baseProps}
        sessionGames={[sessionGame([{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }])]}
        currentParticipantHasPickSignals={true}
      />,
    );

    expect(screen.getByText("Group matching")).toBeInTheDocument();
    expect(screen.getByText("Perfect matches")).toBeInTheDocument();
    expect(screen.getByText("Alignment: High")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Score mode" })).toBeInTheDocument();
  });
});

function participant(id: string, name: string) {
  return {
    id,
    sessionId: "s1",
    userId: null,
    name,
    isHost: id === "p1",
    createdAt: new Date(),
    preference: null,
    user: null,
  };
}

function sessionGame(signals: Array<{ participantId: string; signal: "OWNED" | "AVAILABLE_TO_PLAY" | "NOT_AVAILABLE" }>) {
  return {
    id: "sg1",
    sessionId: "s1",
    gameId: "g1",
    addedByParticipantId: "p1",
    addedByUserId: null,
    source: "MANUAL",
    createdAt: new Date(),
    updatedAt: new Date(),
    game: {
      id: "g1",
      title: "Portal 2",
      normalizedTitle: "portal 2",
      steamAppId: 620,
      igdbId: null,
      coverUrl: null,
      summary: null,
      genres: [],
      platforms: [],
      gameModes: [],
      popularityScore: null,
      minPlayers: null,
      maxPlayers: 2,
      onlineCoop: true,
      localCoop: true,
      capabilitySource: "test",
      capabilityConfidence: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      steamStorePrice: null,
    },
    signals: signals.map((signal, index) => ({
      id: `sig${index}`,
      sessionGameId: "sg1",
      participantId: signal.participantId,
      signal: signal.signal,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    interests: [],
  };
}
