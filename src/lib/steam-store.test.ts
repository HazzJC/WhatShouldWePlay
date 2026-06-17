import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSteamAppDetails } from "@/lib/steam-store";

describe("Steam store lookup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps discounted appdetails responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        "548430": {
          success: true,
          data: {
            price_overview: {
              currency: "GBP",
              initial: 2499,
              final: 824,
              discount_percent: 67,
            },
          },
        },
      }),
    } as Response);

    const details = await fetchSteamAppDetails(548430);

    expect(details?.data?.price_overview?.discount_percent).toBe(67);
  });

  it("returns unavailable payloads without throwing when Steam says success false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        "1": {
          success: false,
        },
      }),
    } as Response);

    await expect(fetchSteamAppDetails(1)).resolves.toEqual({ success: false });
  });
});
