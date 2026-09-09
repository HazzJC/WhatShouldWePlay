/** Executes the real session page composition with synthetic database/provider boundaries. */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SessionPage from "@/app/s/[shareToken]/page";
import { PickPanel } from "@/components/pick-panel";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), userGames: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  session: { findUnique: mocks.session },
  sessionGame: { findMany: async () => [] },
  userGame: { findMany: mocks.userGames },
  priceAlertEvent: { findMany: async () => [] },
  friendInvite: { findFirst: async () => null },
  userFriend: { findMany: async () => [] },
  friendGroup: { findMany: async () => [] },
  game: { findMany: async () => [] },
} }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => ({ id: "viewer" }),
  getParticipantId: async () => null,
}));
vi.mock("@/lib/accounts", () => ({ requireActivePickUser: async () => ({ id: "viewer" }) }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: async () => "https://audit.invalid" }));
vi.mock("@/lib/igdb", () => ({ getPopularIgdbGames: async () => [], getTrendingIgdbGames: async () => [], mapIgdbGame: vi.fn() }));
vi.mock("@/components/pick-panel", () => ({ PickPanel: () => null }));

const game = { id: "g1", title: "Synthetic Shared Candidate", minPlayers: 1, maxPlayers: 4, onlineCoop: true, deals: [], steamStorePrice: null };
function libraryRow(userId: string) {
  return { id: `row-${userId}`, userId, gameId: "g1", game, ownership: "HAVE", platforms: ["PC"], createdAt: new Date(0), updatedAt: new Date(0) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    id: "s1", shareToken: "share", title: "Synthetic Night", workspaceType: "PICK", mode: "ONLINE",
    requiredDuration: 2, minimumPlayerCount: 2, timezone: "Europe/London", dealCountry: "GB", dealCurrency: "GBP",
    dateRangeStart: "2026-09-09", dateRangeEnd: "2026-09-09", dailyStartHour: 18, dailyEndHour: 23,
    gameNight: null, participants: [1, 2].map((n) => ({ id: `p${n}`, userId: `u${n}`, name: `Player ${n}`, isHost: n === 1, responses: [], preference: null, user: { preference: null, steamAccount: null } })),
  });
  // The first query is the globally capped candidate query; the second loads
  // complete ownership rows for those candidates. The page should use both.
  mocks.userGames.mockResolvedValueOnce([libraryRow("u1")]).mockResolvedValueOnce([libraryRow("u1"), libraryRow("u2")]);
});

function findPanel(node: React.ReactNode): React.ComponentProps<typeof PickPanel> | undefined {
  if (Array.isArray(node)) return node.map(findPanel).find(Boolean);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return undefined;
  if (node.type === PickPanel) return node.props as React.ComponentProps<typeof PickPanel>;
  return findPanel(node.props.children);
}
async function compose(query: Record<string, string | string[]> = {}) {
  const tree = await SessionPage({ params: Promise.resolve({ shareToken: "share" }), searchParams: Promise.resolve(query) });
  const panel = findPanel(tree);
  if (!panel) throw new Error("Audit harness could not find PickPanel");
  return panel;
}

describe("dimension 1: real session page composition", () => {
  it.fails("F04: ownership uses complete rows even when a candidate owner's discovery row is cut off", async () => {
    const panel = await compose();
    expect(mocks.userGames).toHaveBeenCalledTimes(2);
    expect(panel.scoredGames).toHaveLength(1);
    expect(panel.scoredGames[0].ownership.have).toBe(2);
  });

  it.fails("F09: repeated and foreign selected participant IDs are canonicalized", async () => {
    const panel = await compose({ selectedParticipants: ["p1", "p1", "foreign"] });
    expect(panel.selectedParticipantIds).toEqual(["p1"]);
  });

  it.fails("F09: non-finite player counts do not enter matching", async () => {
    const panel = await compose({ playerCount: "Infinity" });
    expect(Number.isFinite(panel.selectedPlayerCount)).toBe(true);
  });

  it("F03/F16 evidence: a signed-in non-member receives full matching output without joining", async () => {
    const panel = await compose();
    expect(panel.participantId).toBeUndefined();
    expect(panel.scoredGames[0].title).toBe(game.title);
  });
});
