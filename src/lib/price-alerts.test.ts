import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceAlertRule: {
      findMany: vi.fn(async () => []),
    },
    priceAlertEvent: {
      upsert,
    },
  },
}));

describe("price alert evaluation", () => {
  beforeEach(() => {
    upsert.mockClear();
  });

  it("creates an in-app event for discounted missing-player games", async () => {
    const { evaluatePriceAlerts } = await import("@/lib/price-alerts");

    await evaluatePriceAlerts({
      sessionId: "s1",
      selectedCount: 7,
      currency: "GBP",
      sessionGames: [
        {
          id: "sg1",
          gameId: "g1",
          game: {
            id: "g1",
            title: "Valheim",
            deal: {
              status: "ok",
              currentPrice: 799,
              discountPercent: 50,
              historicalLow: 699,
              currency: "GBP",
              dealUrl: "https://example.com",
            },
          },
          signals: [
            { signal: "OWNED" },
            { signal: "OWNED" },
            { signal: "OWNED" },
            { signal: "OWNED" },
            { signal: "OWNED" },
          ],
        },
      ],
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          message: expect.stringContaining("5 of 7 players own Valheim"),
        }),
      }),
    );
    const missingPlayerAlert = upsert.mock.calls
      .map((call) => call[0].create.message)
      .find((message) => message.includes("remaining 2"));

    expect(missingPlayerAlert).toContain("close to its historical low");
  });
});
