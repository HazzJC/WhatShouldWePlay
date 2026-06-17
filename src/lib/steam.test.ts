import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { extractSteamIdFromClaimedId, getOwnedSteamGames, parseSteamCommunityGamesXml } from "@/lib/steam";

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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "<gamesList></gamesList>",
      }),
    );

    await expect(getOwnedSteamGames("76561198000000000", "")).resolves.toEqual({
      games: [],
      status: "missing_key_xml_private_or_empty",
    });

    vi.unstubAllGlobals();
  });

  it("falls back to community XML after Steam HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <gamesList>
              <games>
                <game>
                  <appID>620</appID>
                  <name><![CDATA[Portal 2]]></name>
                  <hoursOnRecord>12.5</hoursOnRecord>
                </game>
              </games>
            </gamesList>
          `,
        }),
    );

    await expect(getOwnedSteamGames("76561198000000000", "key")).resolves.toMatchObject({
      games: [{ appid: 620, name: "Portal 2", playtime_forever: 750 }],
      status: "http_403_xml_imported:1",
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

  it("parses Steam community games XML", () => {
    expect(
      parseSteamCommunityGamesXml(`
        <gamesList>
          <games>
            <game>
              <appID>400</appID>
              <name>Portal &amp; Friends</name>
              <hoursOnRecord>2</hoursOnRecord>
            </game>
          </games>
        </gamesList>
      `),
    ).toEqual([{ appid: 400, name: "Portal & Friends", playtime_forever: 120 }]);
  });
});
