import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const findRules = vi.fn();
const findEvents = vi.fn();
const updateMany = vi.fn();
const transaction = vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
    priceAlertRule: {
      findMany: findRules,
    },
    priceAlertEvent: {
      findMany: findEvents,
      updateMany,
      upsert,
    },
  },
}));

describe("price alert evaluation", () => {
  beforeEach(() => {
    upsert.mockClear();
    findRules.mockReset();
    findEvents.mockReset();
    updateMany.mockReset();
    transaction.mockClear();
    findRules.mockResolvedValue([]);
    findEvents.mockResolvedValue([]);
  });

  it("creates an in-app event for discounted missing-player games", async () => {
    findRules.mockResolvedValue([
      { id: "rule-1", type: "MISSING_PLAYERS_ONLY", enabled: true },
    ]);
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

  it("resolves active alerts when no current deals are present", async () => {
    const { evaluatePriceAlerts } = await import("@/lib/price-alerts");

    await evaluatePriceAlerts({
      sessionId: "s1",
      selectedCount: 2,
      currency: "GBP",
      sessionGames: [
        {
          id: "sg1",
          gameId: "g1",
          game: {
            id: "g1",
            title: "No Deal Game",
            deal: {
              status: "no_price",
              currentPrice: null,
              discountPercent: null,
              historicalLow: null,
              currency: "GBP",
              dealUrl: null,
            },
          },
          signals: [{ signal: "OWNED" }],
        },
      ],
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { sessionId: "s1", resolvedAt: null },
      data: { resolvedAt: expect.any(Date) },
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not retrigger an alert that remains active", async () => {
    findRules.mockResolvedValue([{ id: "rule-1", type: "GROUP_ON_SALE", enabled: true }]);
    findEvents.mockResolvedValue([{
      gameId: "g1",
      message: "Valheim is 50% off at £7.99.",
      resolvedAt: null,
    }]);
    const { evaluatePriceAlerts } = await import("@/lib/price-alerts");

    await evaluatePriceAlerts({
      sessionId: "s1",
      selectedCount: 2,
      currency: "GBP",
      sessionGames: [{
        id: "sg1",
        gameId: "g1",
        game: {
          id: "g1",
          title: "Valheim",
          deal: { status: "ok", currentPrice: 799, discountPercent: 50, currency: "GBP" },
        },
        signals: [{ signal: "OWNED" }],
      }],
    });

    expect(upsert.mock.calls[0][0].update.triggeredAt).toBeUndefined();
    expect(upsert.mock.calls[0][0].update.lastObservedAt).toEqual(expect.any(Date));
  });
});
