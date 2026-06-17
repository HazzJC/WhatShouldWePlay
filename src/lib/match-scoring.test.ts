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
      steamStorePrice: discountPercent > 0 ? { discountPercent, finalPrice: 999, status: "ok" } : null,
    },
    signals,
    interests: [],
  };
}
