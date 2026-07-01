import { describe, expect, it } from "vitest";
import { createPlayerMetadataCsv, parsePlayerMetadataCsv } from "@/lib/player-metadata-csv";

describe("player metadata CSV", () => {
  it("round-trips titles containing commas and completed player counts", () => {
    const csv = 'game_id,steam_app_id,title,min_players,max_players\n' +
      'game-1,123,"Game, The Sequel",1,8\n';
    const result = parsePlayerMetadataCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.updates).toEqual([{ gameId: "game-1", minPlayers: 1, maxPlayers: 8 }]);
  });

  it("exports incomplete rows in a form that is safely skipped until completed", () => {
    const csv = createPlayerMetadataCsv([{
      id: "game-1",
      steamAppId: 123,
      title: "Unresearched Game",
      minPlayers: null,
      maxPlayers: null,
    }]);
    const result = parsePlayerMetadataCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.updates).toEqual([]);
    expect(result.skipped).toBe(1);
  });

  it("reports invalid ranges without importing them", () => {
    const csv = "game_id,steam_app_id,title,min_players,max_players\none,1,Game,4,2\n";
    const result = parsePlayerMetadataCsv(csv);

    expect(result.updates).toEqual([]);
    expect(result.errors[0]).toContain("max_players");
  });

  it("accepts capacities up to 2,000 players", () => {
    const valid = parsePlayerMetadataCsv(
      "game_id,steam_app_id,title,min_players,max_players\nosrs,1343370,Old School RuneScape,1,2000\n",
    );
    const invalid = parsePlayerMetadataCsv(
      "game_id,steam_app_id,title,min_players,max_players\nhuge,1,Huge Game,1,2001\n",
    );

    expect(valid.updates[0]?.maxPlayers).toBe(2000);
    expect(invalid.errors[0]).toContain("2000");
  });
});
