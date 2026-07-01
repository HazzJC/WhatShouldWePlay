import { describe, expect, it } from "vitest";
import { scoreSessionGames } from "@/lib/match-scoring";

const participants = [
  { id: "p1", userId: "u1", preference: null, user: { preference: null } },
  { id: "p2", userId: "u2", preference: null, user: { preference: null } },
];

describe("match scoring", () => {
  it("prioritizes shared ownership and selected player-count support", () => {
    const [best] = scoreSessionGames({
      participants,
      selectedParticipantIds: ["p1", "p2"],
      playerCount: 2,
      userGames: [],
      sessionGames: [
        sessionGame("sg1", "Two Player Co-op", [{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }], 2),
        sessionGame("sg2", "Solo Hit", [{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }], 1),
      ],
    });

    expect(best.title).toBe("Two Player Co-op");
  });

  it("does not call a one-person result perfect when the requested group has two players", () => {
    const [game] = scoreSessionGames({
      participants: [participants[0]],
      selectedParticipantIds: ["p1"],
      playerCount: 2,
      userGames: [],
      sessionGames: [
        sessionGame("sg1", "Two Player Co-op", [{ participantId: "p1", signal: "OWNED" }], 2),
      ],
    });

    expect(game.categories).not.toContain("perfect");
  });

  it("drops alignment to low when a player marks not tonight", () => {
    const [game] = scoreSessionGames({
      participants,
      selectedParticipantIds: ["p1", "p2"],
      playerCount: 2,
      userGames: [],
      sessionGames: [
        {
          ...sessionGame("sg1", "Deep Rock Galactic", [{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }], 4),
          interests: [{ participantId: "p2", interest: "NOT_TONIGHT" }],
        },
      ],
    });

    expect(game.alignment).toBe("Low");
  });

  it("assigns backlog, old favourite, almost ready, and sale categories", () => {
    const scored = scoreSessionGames({
      participants,
      selectedParticipantIds: ["p1", "p2"],
      playerCount: 2,
      userGames: [
        { userId: "u1", gameId: "g-old", playtimeMinutes: 900 },
        { userId: "u2", gameId: "g-old", playtimeMinutes: 900 },
      ],
      sessionGames: [
        sessionGame("sg-backlog", "Backlog", [{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }], 4, "g-backlog"),
        sessionGame("sg-old", "Old", [{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }], 4, "g-old"),
        sessionGame("sg-sale", "Sale", [{ participantId: "p1", signal: "OWNED" }], 4, "g-sale", 40),
      ],
    });

    expect(scored.find((game) => game.title === "Backlog")?.categories).toContain("hiddenBacklog");
    expect(scored.find((game) => game.title === "Old")?.categories).toContain("oldFavourites");
    expect(scored.find((game) => game.title === "Sale")?.categories).toEqual(expect.arrayContaining(["almostReady", "saleOpportunity"]));
  });

  it("does not treat a game with high selected-user Steam playtime as low group playtime", () => {
    const [game] = scoreSessionGames({
      participants: [{ id: "p1", userId: "u1", preference: null, user: { preference: null } }],
      selectedParticipantIds: ["p1"],
      playerCount: 2,
      userGames: [{ userId: "u1", gameId: "g-cs", playtimeMinutes: 60_000 }],
      sessionGames: [sessionGame("sg-cs", "Counter-Strike 2", [{ participantId: "p1", signal: "OWNED" }], 20, "g-cs")],
    });

    expect(game.playtimeMinutes).toBe(60_000);
    expect(game.categories).toContain("oldFavourites");
    expect(game.categories).not.toContain("hiddenBacklog");
  });

  it("uses session-game user attribution as a playtime fallback for imported games", () => {
    const [game] = scoreSessionGames({
      participants: [{ id: "p1", userId: null, preference: null, user: { preference: null } }],
      selectedParticipantIds: ["p1"],
      playerCount: 2,
      userGames: [{ userId: "u-steam", gameId: "g-cs", playtimeMinutes: 60_000 }],
      sessionGames: [
        {
          ...sessionGame("sg-cs", "Counter-Strike 2", [{ participantId: "p1", signal: "OWNED" }], 20, "g-cs"),
          addedByParticipantId: "p1",
          addedByUserId: "u-steam",
        },
      ],
    });

    expect(game.playtimeMinutes).toBe(60_000);
    expect(game.categories).toContain("oldFavourites");
    expect(game.categories).not.toContain("hiddenBacklog");
  });

  it("explains cheap mode with current live price data", () => {
    const [game] = scoreSessionGames({
      participants,
      selectedParticipantIds: ["p1", "p2"],
      playerCount: 2,
      mode: "cheap",
      userGames: [],
      sessionGames: [sessionGame("sg-sale", "Discounted", [{ participantId: "p1", signal: "OWNED" }], 4, "g-sale", 40)],
    });

    expect(game.reasons).toEqual(expect.arrayContaining(["Cheap mode: current price is £9.99 with 40% off"]));
  });

  it("explains familiar mode with recent-play and total playtime signals", () => {
    const [game] = scoreSessionGames({
      participants,
      selectedParticipantIds: ["p1", "p2"],
      playerCount: 2,
      mode: "familiar",
      userGames: [
        { userId: "u1", gameId: "g-familiar", playtimeMinutes: 1_200, recentlyPlayedAt: new Date() },
        { userId: "u2", gameId: "g-familiar", playtimeMinutes: 900 },
      ],
      sessionGames: [
        sessionGame("sg-familiar", "Familiar Pick", [{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }], 4, "g-familiar"),
      ],
    });

    expect(game.reasons).toEqual(expect.arrayContaining(["Familiar mode: 1 selected player played it recently"]));
  });

  it("lets account and participant preferences influence scores", () => {
    const [cheap] = scoreSessionGames({
      participants: [
        { id: "p1", userId: "u1", preference: { priceImportance: 100 }, user: { preference: null } },
        { id: "p2", userId: "u2", preference: null, user: { preference: { priceImportance: 100 } } },
      ],
      selectedParticipantIds: ["p1", "p2"],
      playerCount: 2,
      mode: "cheap",
      userGames: [],
      sessionGames: [
        sessionGame("sg-sale", "Discounted", [{ participantId: "p1", signal: "OWNED" }], 4, "g-sale", 60),
        sessionGame("sg-full", "Full Price", [{ participantId: "p1", signal: "OWNED" }], 4, "g-full", 0),
      ],
    });

    expect(cheap.title).toBe("Discounted");
  });

  it("hides games with known player caps below the selected player count", () => {
    const scored = scoreSessionGames({
      participants,
      selectedParticipantIds: ["p1", "p2"],
      playerCount: 3,
      userGames: [],
      sessionGames: [
        sessionGame("sg-one", "One Player", [{ participantId: "p1", signal: "OWNED" }], 1),
        sessionGame("sg-four", "Four Player", [{ participantId: "p1", signal: "OWNED" }], 4),
      ],
    });

    expect(scored.map((game) => game.title)).toEqual(["Four Player"]);
  });

  it("does not collapse sparse games to identical scores", () => {
    const scored = scoreSessionGames({
      participants: [{ id: "p1", userId: "u1", preference: null, user: { preference: null } }],
      selectedParticipantIds: ["p1"],
      playerCount: 1,
      userGames: [],
      sessionGames: [
        unknownSessionGame("sg-a", "Alpha Quest"),
        unknownSessionGame("sg-b", "Beta Quest"),
        unknownSessionGame("sg-c", "Gamma Quest"),
      ],
    });

    expect(new Set(scored.map((game) => game.score)).size).toBeGreaterThan(1);
    expect(scored.every((game) => game.playerCountStatus === "uncertain")).toBe(true);
  });

  it("uses sourced Steam review percentage before generic popularity", () => {
    const [reviewed] = scoreSessionGames({
      participants: [{ id: "p1", userId: "u1", preference: null, user: { preference: null } }],
      selectedParticipantIds: ["p1"],
      playerCount: 1,
      userGames: [],
      sessionGames: [
        {
          ...sessionGame("sg-reviewed", "Reviewed", [{ participantId: "p1", signal: "OWNED" }], 1),
          game: {
            ...sessionGame("sg-reviewed", "Reviewed", [{ participantId: "p1", signal: "OWNED" }], 1).game,
            popularityScore: 10,
            steamReviewPercent: 95,
            steamReviewSummary: "Overwhelmingly Positive, 95% positive from 10,000 reviews",
            qualitySource: "steam:appreviews",
          },
        },
      ],
    });

    expect(reviewed.factors.popularity).toBe(95);
    expect(reviewed.reviewSummary).toContain("95% positive");
    expect(reviewed.qualitySource).toBe("steam:appreviews");
  });

  it("drops alignment when one player has a strong preference mismatch despite a good score", () => {
    const [game] = scoreSessionGames({
      participants: [
        { id: "p1", userId: "u1", preference: { chillVsIntense: 10 }, user: { preference: null } },
        { id: "p2", userId: "u2", preference: null, user: { preference: null } },
      ],
      selectedParticipantIds: ["p1", "p2"],
      playerCount: 2,
      userGames: [],
      sessionGames: [
        {
          ...sessionGame("sg-horror", "Horror Co-op", [{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }], 4),
          game: {
            ...sessionGame("sg-horror", "Horror Co-op", [{ participantId: "p1", signal: "OWNED" }, { participantId: "p2", signal: "OWNED" }], 4).game,
            genres: ["horror", "co-op"],
            steamReviewPercent: 95,
          },
        },
      ],
    });

    expect(game.score).toBeGreaterThan(70);
    expect(game.alignment).toBe("Low");
    expect(game.alignmentReasons).toEqual(expect.arrayContaining(["A selected player strongly prefers chill games, but this looks intense"]));
    expect(game.factorBreakdown[0]).toHaveProperty("points");
  });

  it("uses persistent ratings and time commitment to separate otherwise similar games", () => {
    const short = sessionGame("sg-short", "Short Favourite", [{ participantId: "p1", signal: "OWNED" }], 4, "g-short");
    const endless = sessionGame("sg-endless", "Endless Grind", [{ participantId: "p1", signal: "OWNED" }], 4, "g-endless");
    const scored = scoreSessionGames({
      participants: [{ id: "p1", userId: "u1", preference: null, user: { preference: null } }],
      selectedParticipantIds: ["p1"],
      playerCount: 2,
      sessionMinutes: 90,
      commitment: "one-session",
      userGames: [
        { userId: "u1", gameId: "g-short", rating: 10, interest: "WANT_TO_PLAY" },
        { userId: "u1", gameId: "g-endless", rating: 2, interest: "NOT_INTERESTED" },
      ],
      sessionGames: [
        {
          ...short,
          game: {
            ...short.game,
            onlineMultiplayer: true,
            minimumSessionMinutes: 60,
            commitmentTier: "ONE_SESSION",
          },
        },
        {
          ...endless,
          game: {
            ...endless.game,
            onlineMultiplayer: true,
            minimumSessionMinutes: 180,
            commitmentTier: "ENDLESS",
          },
        },
      ],
    });

    expect(scored[0].title).toBe("Short Favourite");
    expect(scored[0].factors.personalRating).toBe(100);
    expect(scored[0].factors.durationFit).toBeGreaterThan(
      scored.find((game) => game.title === "Endless Grind")!.factors.durationFit,
    );
  });
});

function sessionGame(
  id: string,
  title: string,
  signals: Array<{ participantId: string; signal: string }>,
  maxPlayers: number,
  gameId = `g-${id}`,
  discountPercent = 0,
) {
  return {
    id,
    source: "MANUAL",
    gameId,
    game: {
      id: gameId,
      title,
      popularityScore: 50,
      minPlayers: 1,
      maxPlayers,
      onlineCoop: true,
      localCoop: false,
      deal: discountPercent > 0 ? { discountPercent, currentPrice: 999, historicalLow: 899, status: "ok" } : null,
    },
    signals,
    interests: [],
  };
}

function unknownSessionGame(id: string, title: string) {
  return {
    id,
    source: "MANUAL",
    gameId: `g-${id}`,
    game: {
      id: `g-${id}`,
      title,
      popularityScore: null,
      minPlayers: null,
      maxPlayers: null,
      onlineCoop: null,
      localCoop: null,
      deal: null,
    },
    signals: [{ participantId: "p1", signal: "OWNED" }],
    interests: [],
  };
}
