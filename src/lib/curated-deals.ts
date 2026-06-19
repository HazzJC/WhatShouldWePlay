import type { GameDeal } from "@prisma/client";
import { curatedGames, type CuratedGame } from "@/lib/curated-games";
import { normalizeGameTitle } from "@/lib/games";
import { formatMinorPrice, refreshGameDealsWithin } from "@/lib/itad";
import { prisma } from "@/lib/prisma";

export type CuratedGameWithDeal = CuratedGame & {
  deal?: GameDeal | null;
};

export async function enrichCuratedGamesWithDeals(games: CuratedGame[], country = "GB", currency = "GBP") {
  if (games.length === 0) {
    return [] as CuratedGameWithDeal[];
  }

  const steamAppIds = games.map((game) => game.steamAppId).filter((steamAppId): steamAppId is number => Boolean(steamAppId));
  const normalizedTitles = games.map((game) => normalizeGameTitle(game.title));
  const dbGames = await prisma.game.findMany({
    where: {
      OR: [
        ...(steamAppIds.length > 0 ? [{ steamAppId: { in: steamAppIds } }] : []),
        { normalizedTitle: { in: normalizedTitles } },
      ],
    },
    include: { deal: true },
  });

  await refreshGameDealsWithin({
    gameIds: dbGames.map((game) => game.id),
    country,
    currency,
  });

  const refreshedGames = await prisma.game.findMany({
    where: { id: { in: dbGames.map((game) => game.id) } },
    include: { deal: true },
  });
  const bySteamAppId = new Map(refreshedGames.filter((game) => game.steamAppId).map((game) => [game.steamAppId, game]));
  const byTitle = new Map(refreshedGames.map((game) => [normalizeGameTitle(game.title), game]));

  return games.map((game) => ({
    ...game,
    deal: (game.steamAppId ? bySteamAppId.get(game.steamAppId)?.deal : null) ?? byTitle.get(normalizeGameTitle(game.title))?.deal ?? null,
  }));
}

export async function enrichedCuratedGame(slug: string) {
  const game = curatedGames.find((candidate) => candidate.slug === slug);

  if (!game) {
    return null;
  }

  return (await enrichCuratedGamesWithDeals([game]))[0] ?? null;
}

export function sortCuratedGamesForDiscovery(games: CuratedGameWithDeal[]) {
  return [...games].sort((a, b) => {
    const saleDifference = saleRank(b) - saleRank(a);

    if (saleDifference !== 0) {
      return saleDifference;
    }

    const priceDifference = priceRank(a) - priceRank(b);

    if (priceDifference !== 0) {
      return priceDifference;
    }

    return a.title.localeCompare(b.title);
  });
}

export function curatedPriceLabel(game: CuratedGameWithDeal) {
  if (game.releaseStatus === "upcoming") {
    return "Price pending";
  }

  if (game.deal?.currentPrice !== null && game.deal?.currentPrice !== undefined) {
    return formatMinorPrice(game.deal.currentPrice, game.deal.currency ?? "GBP") ?? "Price unavailable";
  }

  return "Price unavailable";
}

export function curatedSaleLabel(game: CuratedGameWithDeal) {
  const discount = game.deal?.discountPercent ?? 0;

  if (discount <= 0) {
    return null;
  }

  return `${discount}% off`;
}

function saleRank(game: CuratedGameWithDeal) {
  return Math.max(0, game.deal?.discountPercent ?? 0);
}

function priceRank(game: CuratedGameWithDeal) {
  return game.deal?.currentPrice ?? Number.POSITIVE_INFINITY;
}
