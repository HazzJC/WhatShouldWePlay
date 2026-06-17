import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { extractSteamIdFromClaimedId, getOwnedSteamGames } from "@/lib/steam";

describe("steam helpers", () => {
  it("extracts valid SteamID64 values from claimed IDs", () => {
    expect(extractSteamIdFromClaimedId("https://steamcommunity.com/openid/id/76561198000000000")).toBe(
      "76561198000000000",
    );
  });

  it("rejects invalid claimed IDs", () => {
    expect(extractSteamIdFromClaimedId("https://example.com/openid/id/76561198000000000")).toBeNull();
    expect(extractSteamIdFromClaimedId("https://steamcommunity.com/openid/id/not-a-steamid")).toBeNull();
  });

  it("returns a graceful status when Steam API credentials are missing", async () => {
    await expect(getOwnedSteamGames("76561198000000000", "")).resolves.toEqual({
      games: [],
      status: "missing_key",
    });
  });

  it("captures Steam HTTP errors for detailed messaging", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }),
    );

    await expect(getOwnedSteamGames("76561198000000000", "key")).resolves.toEqual({
      games: [],
      status: "http_403",
    });

    vi.unstubAllGlobals();
  });

  it("includes imported game count in the status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: {
            games: [{ appid: 1, name: "Portal 2" }],
          },
        }),
      }),
    );

    await expect(getOwnedSteamGames("76561198000000000", "key")).resolves.toMatchObject({
      status: "imported:1",
    });

    vi.unstubAllGlobals();
  });
});
