import { describe, expect, it } from "vitest";
import { parseGamingPlatforms } from "@/lib/platforms";

describe("platform normalization", () => {
  it("normalizes storefront, generation, and console aliases without duplicates", () => {
    expect(parseGamingPlatforms(["Steam", "Windows", "Xbox Series X|S", "PS5", "Switch", "Android", "PC"]))
      .toEqual(["PC", "Xbox", "PlayStation", "Nintendo Switch", "Mobile"]);
  });

  it("ignores unknown and malformed metadata", () => {
    expect(parseGamingPlatforms(["Arcade cabinet", null, 42, ""])).toEqual([]);
    expect(parseGamingPlatforms({ PC: true })).toEqual([]);
  });
});
