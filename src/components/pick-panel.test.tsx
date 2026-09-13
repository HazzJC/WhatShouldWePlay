import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PickPanel, type ParticipantView, type SessionGameView } from "@/components/pick-panel";
import { parsePickQuery } from "@/lib/pick/query";

vi.mock("@/app/actions", () => ({
  addSessionParticipantsAsFriendsAction: vi.fn(),
  addSessionGameAction: vi.fn(),
  createFriendInviteAction: vi.fn(),
  createFriendGroupFromSessionAction: vi.fn(),
  createFriendGroupInviteAction: vi.fn(),
  createPriceAlertRuleAction: vi.fn(),
  importSteamLibraryAction: vi.fn(),
  markGameInterestAction: vi.fn(),
  markGameAvailableAction: vi.fn(),
  removeSessionGameAction: vi.fn(),
  startPickSessionFromFriendGroupAction: vi.fn(),
  updateDealSettingsAction: vi.fn(),
  updatePreferenceAction: vi.fn(),
  updateQuickPreferenceAction: vi.fn(),
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
  selectedSessionMinutes: 120,
  selectedCommitment: "any" as const,
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
      alignmentReasons: ["No selected player has a veto or strong mismatch"],
      factors: {
        ownership: 100,
        playerCount: 95,
        genreFit: 80,
        availability: 100,
        onlineCoop: 90,
        localCoop: 90,
        playtime: 60,
        freshness: 80,
        interest: 60,
        price: 35,
        historicalLow: 40,
        popularity: 80,
        multiplayerFit: 95,
        durationFit: 90,
        personalRating: 85,
      },
      factorBreakdown: [
        { key: "ownership" as const, label: "Ownership", value: 100, weight: 0.2, points: 20 },
        { key: "playerCount" as const, label: "Player count", value: 95, weight: 0.12, points: 11.4 },
        { key: "onlineCoop" as const, label: "Online co-op", value: 90, weight: 0.08, points: 7.2 },
      ],
      ownership: { have: 2, dontHave: 0, unknown: 0, missing: 0, selected: 2 },
      playtimeMinutes: 40,
      discountPercent: 0,
      currentPrice: null,
      historicalLow: null,
      playerCountStatus: "supported" as const,
      qualitySource: "steam:appreviews",
      reviewSummary: "Very Positive, 95% positive from 100,000 reviews",
      capabilitySource: "igdb:multiplayer_modes",
    },
  ],
  dealCountry: "GB",
  dealCurrency: "GBP",
  priceAlertEvents: [],
  groupBuyFilters: {
    budget: 1500,
    genre: "",
    playerCount: 2,
    mode: "online" as const,
    sessionLength: "any" as const,
    platform: "PC",
    avoidOwned: true,
    saleOnly: false,
  },
  groupBuyRecommendations: [],
  dealLookupConfigured: true,
  friendInviteUrl: null,
  savedFriends: [],
  friendGroups: [],
  libraryConnectionSummary: { connected: 0, total: 2 },
};

describe("PickPanel", () => {
  it("keeps canonical Pick state when match, search, or group-buy forms submit", () => {
    const query = parsePickQuery({
      selectedParticipantIds: ["p1", "p2"],
      selectionExplicit: "true",
      playerCount: "5",
      mode: "local",
      setup: "modded",
      scoreMode: "coop",
      sessionMinutes: "180",
      commitment: "10-30",
      search: "wizards",
      groupBudget: "12.34",
      groupGenre: "rpg",
      groupMode: "online",
      groupLength: "campaign",
      groupPlatform: "PC",
      avoidOwned: "false",
      saleOnly: "true",
    }, { allowedParticipantIds: ["p1", "p2"] });

    const { container } = render(
      <PickPanel {...baseProps} query={query} sessionGames={[]} currentParticipantHasPickSignals={false} />,
    );

    const matchForm = screen.getByRole("button", { name: "Update match" }).closest("form");
    const searchForm = screen.getByPlaceholderText("Search games...").closest("form");
    const groupBuyForm = screen.getByRole("button", { name: "Update group buy" }).closest("form");
    expect(matchForm).not.toBeNull();
    expect(searchForm).not.toBeNull();
    expect(groupBuyForm).not.toBeNull();

    const matchData = new FormData(matchForm!);
    expect(matchData.get("selectionExplicit")).toBe("true");
    expect(matchData.getAll("selectedParticipantIds")).toEqual(["p1", "p2"]);
    expect(matchData.get("mode")).toBe("local");
    expect(matchData.get("groupBudget")).toBe("12.34");
    expect(matchData.get("avoidOwned")).toBe("false");
    expect(container.querySelector('input[name="playerCount"]')).toHaveAttribute("max", "50");
    expect(screen.getByRole("combobox", { name: "Setup" })).toHaveValue("modded");

    const searchData = new FormData(searchForm!);
    expect(searchData.get("setup")).toBe("modded");
    expect(searchData.get("groupMode")).toBe("online");
    expect(searchData.get("search")).toBe("wizards");

    const groupBuyData = new FormData(groupBuyForm!);
    expect(groupBuyData.getAll("selectedParticipantIds")).toEqual(["p1", "p2"]);
    expect(groupBuyData.get("search")).toBe("wizards");
    expect(groupBuyData.get("avoidOwned")).toBe("false");
    expect(groupBuyData.get("saleOnly")).toBe("true");
  });

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

  it("shows player metadata on session games", () => {
    render(
      <PickPanel
        {...baseProps}
        sessionGames={[sessionGame([{ participantId: "p2", signal: "OWNED" }])]}
        currentParticipantHasPickSignals={true}
      />,
    );

    expect(screen.getByText("Up to 2 players · online + local")).toBeInTheDocument();
    expect(screen.getByText("Player data: test")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /Best overall/ })).toBeInTheDocument();
    expect(screen.getByText("High alignment")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Score mode" })).toBeInTheDocument();
  });

  it("marks matches as provisional while fewer profiles are selected than requested players", () => {
    render(
      <PickPanel
        {...baseProps}
        participants={[participant("p1", "Alex")]}
        selectedParticipantIds={["p1"]}
        selectedPlayerCount={2}
        scoredGames={[{
          ...baseProps.scoredGames[0],
          categories: [],
          ownership: { have: 1, dontHave: 0, unknown: 0, missing: 0, selected: 1 },
        }]}
        sessionGames={[sessionGame([{ participantId: "p1", signal: "OWNED" }])]}
        currentParticipantHasPickSignals
      />,
    );

    expect(screen.getByText("Your early matches")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Matching 1 of the requested 2 players");
    expect(screen.queryByText("Perfect matches")).not.toBeInTheDocument();
  });

  it("keeps selections and explains a player-count conflict", () => {
    render(
      <PickPanel
        {...baseProps}
        selectedPlayerCount={1}
        sessionGames={[sessionGame([])]}
        currentParticipantHasPickSignals
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("cannot be smaller than the 2 selected people");
  });

  it("shows Steam library coverage guidance", () => {
    render(
      <PickPanel
        {...baseProps}
        sessionGames={[]}
        currentParticipantHasPickSignals={false}
      />,
    );

    expect(screen.getByText("No one has connected Steam yet. You can still plan a time. Connect Steam later to find games everyone owns.")).toBeInTheDocument();
  });

  it("shows partial Steam library coverage guidance", () => {
    render(
      <PickPanel
        {...baseProps}
        libraryConnectionSummary={{ connected: 1, total: 2 }}
        sessionGames={[]}
        currentParticipantHasPickSignals={false}
      />,
    );

    expect(screen.getByText("1 of 2 libraries connected. Recommendations will improve as more people connect.")).toBeInTheDocument();
  });

  it("shows close alternatives when no perfect matches exist", () => {
    render(
      <PickPanel
        {...baseProps}
        scoredGames={[
          {
            ...baseProps.scoredGames[0],
            sessionGameId: "sg-close",
            title: "Almost Shared",
            categories: ["almostReady" as const],
            ownership: { have: 1, dontHave: 0, unknown: 1, missing: 1, selected: 2 },
            reasons: ["1/2 selected players have it"],
          },
        ]}
        sessionGames={[sessionGame([{ participantId: "p1", signal: "OWNED" }])]}
        currentParticipantHasPickSignals={true}
      />,
    );

    expect(screen.getAllByText("Almost Shared")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Almost ready/ })).toBeInTheDocument();
  });

  it("gives a profile-only match an inspect link and shortlist control", () => {
    render(
      <PickPanel
        {...baseProps}
        scoredGames={[{ ...baseProps.scoredGames[0], sessionGameId: "profile:g1" }]}
        sessionGames={[]}
        currentParticipantHasPickSignals={false}
      />,
    );

    expect(screen.getByRole("link", { name: "Inspect details" })).toHaveAttribute("href", "/games/id/g1");
    expect(screen.getByRole("button", { name: "Add to shortlist" })).toBeInTheDocument();
  });

  it("separates games with uncertain player-count metadata from compatible recommendations", () => {
    render(
      <PickPanel
        {...baseProps}
        scoredGames={[
          {
            ...baseProps.scoredGames[0],
            sessionGameId: "sg-uncertain",
            title: "Mystery Multiplayer",
            playerCountStatus: "uncertain" as const,
            categories: [],
          },
        ]}
        sessionGames={[sessionGame([{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }])]}
        currentParticipantHasPickSignals={true}
      />,
    );

    expect(screen.getByText("Needs player-count metadata")).toBeInTheDocument();
    expect(screen.getAllByText("Mystery Multiplayer")).not.toHaveLength(0);
  });
});

function participant(id: string, name: string): ParticipantView {
  return {
    id,
    sessionId: "s1",
    userId: null,
    name,
    isHost: id === "p1",
    createdAt: new Date(),
    preference: null,
    user: null,
  } as unknown as ParticipantView;
}

function sessionGame(signals: Array<{ participantId: string; signal: "OWNED" | "AVAILABLE_TO_PLAY" | "NOT_AVAILABLE" }>): SessionGameView {
  return {
    id: "sg1",
    sessionId: "s1",
    gameId: "g1",
    addedByParticipantId: "p1",
    addedByUserId: null,
    source: "MANUAL" as const,
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
      deal: null,
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
  } as unknown as SessionGameView;
}
