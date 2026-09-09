/**
 * Audit evidence against fe110fe; not a claim that these behaviours are fixed.
 * `it.fails` states the desired invariant and verifies that the baseline violates it.
 * Execution agents must remove `.fails` as each finding is repaired, preserving
 * the assertion (or an equivalent integration test if the public contract changes).
 * Synthetic inputs only; no database or external provider requests.
 */
import { describe, expect, it, vi } from "vitest";
import { scoreSessionGames } from "@/lib/match-scoring";
import { defaultGroupBuyFilters, scoreGroupBuyCandidates } from "@/lib/group-buy";
import { curatedGames, getCuratedGame, supportsAtLeast } from "@/lib/curated-games";
import { generateCandidateWindows, generateHourlySlots } from "@/lib/scheduling";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const participants = [1, 2].map((n) => ({ id: `p${n}`, userId: `u${n}` }));
type ScoreInput = Parameters<typeof scoreSessionGames>[0];
function fixture(): ScoreInput {
  return {
    participants: participants.map((p) => ({ ...p })),
    playerCount: 2,
    selectedParticipantIds: ["p1", "p2"],
    userGames: participants.map((p) => ({ userId: p.userId, gameId: "g1", ownership: "HAVE", platforms: ["PC"] })),
    sessionGames: [{
      id: "sg1", gameId: "g1", source: "MANUAL",
      game: { id: "g1", title: "Synthetic Audit Co-op", minPlayers: 1, maxPlayers: 4, onlineCoop: true },
      signals: participants.map((p) => ({ participantId: p.id, signal: "OWNED" })),
    }],
  };
}

describe("dimension 1: known domain defects at audit baseline", () => {
  it.fails("F04: persistent ownership remains authoritative after shortlisting", () => {
    const input = fixture();
    input.sessionGames[0].signals = [];
    expect(scoreSessionGames(input)[0].ownership.have).toBe(2);
  });

  it.fails("F07: a veto prevents the perfect category", () => {
    const input = fixture();
    input.sessionGames[0].interests = [{ participantId: "p2", interest: "NOT_TONIGHT" }];
    const result = scoreSessionGames(input)[0];
    expect(result.alignment).toBe("Low");
    expect(result.categories).not.toContain("perfect");
  });

  it.fails("F06: an unknown upper player limit cannot confirm a 50-player fit", () => {
    const input = fixture();
    input.playerCount = 50;
    input.sessionGames[0].game.maxPlayers = null;
    expect(scoreSessionGames(input)[0].playerCountStatus).toBe("uncertain");
  });

  it.fails("F07: unknown platform for one selected owner prevents confirmed same-platform fit", () => {
    const input = fixture();
    input.participants.push({ id: "p3", userId: "u3" });
    input.selectedParticipantIds!.push("p3");
    input.playerCount = 3;
    input.sessionGames[0].signals.push({ participantId: "p3", signal: "OWNED" });
    input.userGames.push({ userId: "u3", gameId: "g1", ownership: "HAVE", platforms: [] });
    expect(scoreSessionGames(input)[0].platformFit).toBe("unknown");
  });

  it.fails("F07: a 2-player game is not perfect for four selected participants", () => {
    const input = fixture();
    input.sessionGames[0].game.maxPlayers = 2;
    for (const n of [3, 4]) {
      input.participants.push({ id: `p${n}`, userId: `u${n}` });
      input.selectedParticipantIds!.push(`p${n}`);
      input.sessionGames[0].signals.push({ participantId: `p${n}`, signal: "OWNED" });
    }
    expect(scoreSessionGames(input).some((game) => game.categories.includes("perfect"))).toBe(false);
  });

  it.fails("F06: Discovery and Pick agree on the same modded 5-player candidate", () => {
    const curated = getCuratedGame("subnautica")!;
    expect(supportsAtLeast(curated, 5)).toBe(true);
    const input = fixture();
    input.playerCount = 5;
    input.sessionGames[0].game = { ...curated, id: "g1" };
    expect(scoreSessionGames(input)).toHaveLength(1);
  });

  it.fails("F07: tied scores have an identity-based total order independent of input order", () => {
    const input = fixture();
    input.sessionGames.push({ ...input.sessionGames[0], id: "sg2", gameId: "g2", game: { ...input.sessionGames[0].game, id: "g2" } });
    input.userGames = [];
    const first = scoreSessionGames(input).map((g) => g.gameId);
    const second = scoreSessionGames({ ...input, sessionGames: [...input.sessionGames].reverse() }).map((g) => g.gameId);
    expect(first).toEqual(second);
  });

  it.fails("F10: a budget constraint excludes known over-budget group buys", () => {
    const deals = new Map(curatedGames.map((game) => [game.title, { currentPrice: 5000, currency: "GBP", discountPercent: 0 }]));
    const result = scoreGroupBuyCandidates({ filters: { ...defaultGroupBuyFilters(2), budget: 100, avoidOwned: false }, ownedTitles: [], deals });
    expect(result.filter((r) => r.price !== null && r.price !== undefined && r.price > 100)).toHaveLength(0);
  });

  it.fails("F10: a one-night-only request cannot manufacture a long-term section", () => {
    const result = scoreGroupBuyCandidates({ filters: { ...defaultGroupBuyFilters(2), sessionLength: "one-night", avoidOwned: false }, ownedTitles: [], deals: new Map() });
    expect(result.filter((r) => r.section === "longTerm")).toHaveLength(0);
  });

  it.fails("F11: spring DST produces unique real hourly instants", () => {
    const slots = generateHourlySlots({ dateRangeStart: "2026-03-29", dateRangeEnd: "2026-03-29", dailyStartHour: 0, dailyEndHour: 4, requiredDuration: 2, timezone: "Europe/London" });
    expect(new Set(slots.map((s) => s.startsAt.toISOString())).size).toBe(slots.length);
  });

  it.fails("F11: autumn DST candidates contain adjacent real hours", () => {
    const windows = generateCandidateWindows({ dateRangeStart: "2026-10-25", dateRangeEnd: "2026-10-25", dailyStartHour: 0, dailyEndHour: 4, requiredDuration: 2, timezone: "Europe/London" });
    expect(windows.every((w) => w.endsAt.getTime() - w.startsAt.getTime() === 2 * 60 * 60 * 1000)).toBe(true);
  });
});
