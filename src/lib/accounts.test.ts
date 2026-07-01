import { describe, expect, it } from "vitest";
import {
  normalizeUsername,
  usernameChangeAvailableAt,
  validateUsername,
} from "@/lib/accounts";

describe("account usernames", () => {
  it("normalizes and validates searchable usernames", () => {
    expect(normalizeUsername("  Player_One ")).toBe("player_one");
    expect(validateUsername("player_one")).toEqual({
      success: true,
      username: "player_one",
    });
    expect(validateUsername("No spaces allowed")).toMatchObject({ success: false });
    expect(validateUsername("ab")).toMatchObject({ success: false });
  });

  it("enforces a 30-day username change window", () => {
    const changedAt = new Date("2026-07-01T00:00:00.000Z");
    expect(usernameChangeAvailableAt(changedAt)?.toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });
});
