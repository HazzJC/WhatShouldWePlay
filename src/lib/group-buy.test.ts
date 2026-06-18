import { describe, expect, it } from "vitest";
import { defaultGroupBuyFilters, scoreGroupBuyCandidates } from "@/lib/group-buy";

describe("group-buy scoring", () => {
  it("respects budget, player count, owned exclusion, and sale-only filters", () => {
    const recommendations = scoreGroupBuyCandidates({
      filters: {
        ...defaultGroupBuyFilters(4),
        budget: 1200,
        genre: "co-op",
        platform: "PC",
        saleOnly: true,
        avoidOwned: true,
      },
      ownedTitles: ["Overcooked! 2"],
      deals: new Map([
        ["Deep Rock Galactic", { currentPrice: 899, currency: "GBP", discountPercent: 67 }],
        ["Overcooked! 2", { currentPrice: 499, currency: "GBP", discountPercent: 75 }],
      ]),
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.some((recommendation) => recommendation.game.title === "Overcooked! 2")).toBe(false);
    expect(recommendations[0].price).toBeLessThanOrEqual(1200);
    expect(recommendations[0].reasons).toEqual(expect.arrayContaining(["PC compatible"]));
  });
});
