import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSteamReviewSummary } from "@/lib/game-metadata";

describe("game metadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps Steam review summaries into sourced quality data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query_summary: {
            review_score: 8,
            review_score_desc: "Very Positive",
            total_positive: 900,
            total_negative: 100,
            total_reviews: 1000,
          },
        }),
      }),
    );

    const summary = await fetchSteamReviewSummary(620);

    expect(summary).toMatchObject({
      popularityScore: 90,
      steamReviewScore: 8,
      steamReviewPercent: 90,
      steamReviewTotal: 1000,
      qualitySource: "steam:appreviews",
    });
    expect(summary?.steamReviewSummary).toContain("Very Positive");
  });
});
