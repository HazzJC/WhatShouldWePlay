import { describe, expect, it } from "vitest";
import { curatedChallenges } from "@/lib/challenges";

describe("curated challenges", () => {
  it("ships sourced, timed cooperative challenge definitions", () => {
    expect(curatedChallenges.length).toBeGreaterThanOrEqual(10);
    expect(new Set(curatedChallenges.map((challenge) => challenge.id)).size).toBe(curatedChallenges.length);
    expect(curatedChallenges.every((challenge) => challenge.sourceUrl.startsWith("https://"))).toBe(true);
    expect(curatedChallenges.every((challenge) => challenge.difficulty >= 1 && challenge.difficulty <= 5)).toBe(true);
    expect(curatedChallenges.find((challenge) => challenge.id === "halo-mcc-laso")).toMatchObject({
      minPlayers: 2,
      difficulty: 5,
    });
  });
});
