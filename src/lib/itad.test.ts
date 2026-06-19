import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchItadOverview, fetchItadPrices, lookupItadId } from "@/lib/itad";

describe("ITAD client", () => {
  beforeEach(() => {
    delete process.env.ITAD_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ITAD_API_KEY;
  });

  it("returns null without credentials", async () => {
    await expect(lookupItadId({ title: "Valheim", steamAppId: 892970 })).resolves.toBeNull();
  });

  it("looks up games by Steam app id", async () => {
    process.env.ITAD_API_KEY = "key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ found: true, game: { id: "itad-valheim" } }),
    } as Response);

    await expect(lookupItadId({ title: "Valheim", steamAppId: 892970 })).resolves.toBe("itad-valheim");
  });

  it("maps price and overview responses without throwing", async () => {
    process.env.ITAD_API_KEY = "key";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "itad-game", deals: [{ cut: 50, price: { amountInt: 799, currency: "GBP" } }] }],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ prices: [{ id: "itad-game", current: { cut: 50 } }] }),
      } as Response);

    await expect(fetchItadPrices(["itad-game"], "GB")).resolves.toHaveLength(1);
    await expect(fetchItadOverview(["itad-game"], "GB")).resolves.toHaveProperty("prices");
  });
});
