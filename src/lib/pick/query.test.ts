import { describe, expect, it } from "vitest";
import { parsePickQuery, serializePickQuery } from "@/lib/pick/query";

const allowedParticipantIds = ["host", "friend", "guest"];

describe("Pick query contract", () => {
  it("deduplicates selected members, filters foreign IDs, and keeps an explicit empty selection", () => {
    const selected = parsePickQuery({ selectedParticipants: ["host", "foreign", "host", "friend"] }, { allowedParticipantIds });
    expect(selected.selectedParticipantIds).toEqual(["host", "friend"]);
    expect(selected.selectionExplicit).toBe(true);

    const empty = parsePickQuery({ selectionExplicit: "true" }, { allowedParticipantIds, defaultSelectedParticipantIds: ["host"] });
    expect(empty).toMatchObject({ selectionExplicit: true, selectedParticipantIds: [] });
  });

  it("uses defaults only when selection was omitted and bounds integer input", () => {
    const query = parsePickQuery({ playerCount: "2.5", sessionMinutes: "Infinity", page: "0", pageSize: "101" }, {
      allowedParticipantIds,
      defaultSelectedParticipantIds: ["host", "foreign"],
      defaultPlayerCount: 4,
      defaultSessionMinutes: 90,
    });
    expect(query.selectedParticipantIds).toEqual(["host"]);
    expect(query.selectionExplicit).toBe(false);
    expect(query).toMatchObject({ playerCount: 4, sessionMinutes: 90, page: 1, pageSize: 24 });
    expect(parsePickQuery({ playerCount: "50", sessionMinutes: "1440" }, { allowedParticipantIds })).toMatchObject({ playerCount: 50, sessionMinutes: 1440 });
  });

  it("normalizes enums, bounded monetary values, facets, and strict booleans", () => {
    const query = parsePickQuery({
      setup: "modded", mode: "local", scoreMode: "coop", commitment: "one-session",
      groupBudget: "12.34", groupMode: "online", groupLength: "campaign",
      avoidOwned: "false", saleOnly: "true", platform: ["PC", "steam", "unknown"],
      genre: ["co-op", "co-op"], tag: ["tactical", "tactical"],
    }, { allowedParticipantIds });
    expect(query).toMatchObject({ setup: "modded", mode: "local", scoreMode: "coop", commitment: "one-session", platforms: ["PC"], genres: ["co-op"], tags: ["tactical"] });
    expect(query.groupBuy).toMatchObject({ budget: 1234, mode: "online", sessionLength: "campaign", avoidOwned: false, saleOnly: true });
    expect(parsePickQuery({ groupBudget: "NaN", avoidOwned: "off", saleOnly: "1" }, { allowedParticipantIds }).groupBuy).toMatchObject({ budget: 0, avoidOwned: false, saleOnly: false });
  });

  it("serializes every filter, including false booleans and explicit empty selection", () => {
    const query = parsePickQuery({ selectionExplicit: "true", playerCount: "5", setup: "modded", search: "wizards", groupBudget: "9.99", avoidOwned: "false", saleOnly: "true", platform: "PC", genre: "rpg", tag: "co-op" }, { allowedParticipantIds });
    const serialized = serializePickQuery(query);
    expect(serialized.get("selectionExplicit")).toBe("true");
    expect(serialized.getAll("selectedParticipantIds")).toEqual([]);
    expect(serialized.get("setup")).toBe("modded");
    expect(serialized.get("avoidOwned")).toBe("false");
    expect(serialized.get("saleOnly")).toBe("true");
    expect(parsePickQuery(Object.fromEntries(serialized), { allowedParticipantIds })).toEqual(query);
  });
});
