import { refreshGameMetadata } from "@/lib/game-metadata";
import { refreshGameDeals } from "@/lib/itad";
import { prisma } from "@/lib/prisma";

// Keeps the *shared* game dataset fresh in the background.
//
// Metadata (player count, capability confidence, reviews) and deals live on the
// shared `Game`/`GameDeal` rows, keyed by Steam app id. So once a game's
// metadata is populated, every user who has imported that same game benefits —
// there is no per-user copy. This refresher runs daily over the games that are
// actually in use (in a session shortlist or someone's imported library) so:
//   - metadata for newly imported games gets filled in within a day, and is
//     already present the next time anyone imports an overlapping library;
//   - prices/sales stay current for sale alerts and the buy flow.
//
// It is bounded per run to stay within serverless duration and external API
// rate limits; the daily cadence spreads large libraries across several runs.
// Defaults are tuned for a single ~60s Vercel function invocation.

const metadataStaleMs = 1000 * 60 * 60 * 24 * 30; // 30 days
const dealBatchSize = 24; // ITAD batch limit per request

const inUseGame = {
  OR: [{ sessionGames: { some: {} } }, { userGames: { some: {} } }],
};

export async function refreshActiveGameData({
  metadataLimit = 36,
  metadataConcurrency = 6,
  dealLimit = 48,
  dealCountry = "GB",
  dealCurrency = "GBP",
}: {
  metadataLimit?: number;
  metadataConcurrency?: number;
  dealLimit?: number;
  dealCountry?: string;
  dealCurrency?: string;
} = {}) {
  const metadataStaleBefore = new Date(Date.now() - metadataStaleMs);

  // In-use games whose metadata is missing or stale, oldest-fetched first so
  // never-populated games (qualityFetchedAt = null) are prioritised.
  const metadataGames = await prisma.game.findMany({
    where: {
      AND: [
        inUseGame,
        { OR: [{ qualityFetchedAt: null }, { qualityFetchedAt: { lt: metadataStaleBefore } }] },
      ],
    },
    select: { id: true },
    orderBy: { qualityFetchedAt: { sort: "asc", nulls: "first" } },
    take: metadataLimit,
  });

  const metadataResult = await refreshGameMetadata(
    metadataGames.map((game) => game.id),
    { limit: metadataLimit, concurrency: metadataConcurrency },
  );

  // In-use games whose deal data is missing or stale for the target country.
  const dealStaleBefore = new Date(Date.now() - 1000 * 60 * 60 * 12);
  const dealGames = process.env.ITAD_API_KEY
    ? await prisma.game.findMany({
        where: {
          AND: [
            inUseGame,
            {
              OR: [
                { deal: null },
                { deal: { country: { not: dealCountry } } },
                { deal: { fetchedAt: { lt: dealStaleBefore } } },
              ],
            },
          ],
        },
        select: { id: true },
        orderBy: { updatedAt: "asc" },
        take: dealLimit,
      })
    : [];

  let dealsRefreshed = 0;

  for (let index = 0; index < dealGames.length; index += dealBatchSize) {
    const batch = dealGames.slice(index, index + dealBatchSize).map((game) => game.id);
    await refreshGameDeals({ gameIds: batch, country: dealCountry, currency: dealCurrency });
    dealsRefreshed += batch.length;
  }

  return {
    metadataRefreshed: metadataResult.refreshed,
    metadataCandidates: metadataGames.length,
    dealsRefreshed,
  };
}
