import { prisma } from "@/lib/prisma";

const itadBaseUrl = "https://api.isthereanydeal.com";
const cacheMs = 1000 * 60 * 60 * 12;

type ItadLookupResponse = {
  id?: string;
};

type ItadOverviewResponse = {
  prices?: Array<{
    id: string;
    current?: ItadDeal;
    lowest?: ItadDeal;
    urls?: { game?: string };
  }>;
};

type ItadPricesResponse = Array<{
  id: string;
  historyLow?: {
    all?: ItadPrice;
    y1?: ItadPrice;
    m3?: ItadPrice;
  };
  deals?: ItadDeal[];
}>;

type ItadDeal = {
  shop?: { name?: string };
  price?: ItadPrice;
  regular?: ItadPrice;
  cut?: number;
  url?: string;
};

type ItadPrice = {
  amountInt?: number;
  currency?: string;
};

export async function refreshGameDeals({
  gameIds,
  country,
  currency,
}: {
  gameIds: string[];
  country: string;
  currency: string;
}) {
  if (!process.env.ITAD_API_KEY) {
    return;
  }

  const games = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    include: { deal: true },
  });
  const staleGames = games.filter((game) => {
    if (!game.deal) {
      return true;
    }

    return game.deal.country !== country || Date.now() - game.deal.fetchedAt.getTime() > cacheMs;
  });

  if (staleGames.length === 0) {
    return;
  }

  const resolved = await Promise.all(
    staleGames.map(async (game) => {
      const itadId = game.itadId ?? (await lookupItadId({ title: game.title, steamAppId: game.steamAppId }));

      if (!itadId) {
        await upsertDealFailure(game.id, country, currency, "not_found");
        return null;
      }

      if (!game.itadId) {
        await prisma.game.update({ where: { id: game.id }, data: { itadId } });
      }

      return { gameId: game.id, itadId };
    }),
  );
  const resolvedGames = resolved.filter((game): game is { gameId: string; itadId: string } => Boolean(game));
  const prices = await fetchItadPrices(resolvedGames.map((game) => game.itadId), country);
  const overview = await fetchItadOverview(resolvedGames.map((game) => game.itadId), country);
  const priceMap = new Map(prices.map((price) => [price.id, price]));
  const overviewMap = new Map((overview.prices ?? []).map((price) => [price.id, price]));

  await Promise.all(
    resolvedGames.map(async ({ gameId, itadId }) => {
      const price = priceMap.get(itadId);
      const overviewPrice = overviewMap.get(itadId);
      const bestDeal = price?.deals?.[0] ?? overviewPrice?.current ?? overviewPrice?.lowest;
      const historyLow = price?.historyLow?.all ?? overviewPrice?.lowest?.price;

      await prisma.gameDeal.upsert({
        where: { gameId },
        create: {
          gameId,
          itadId,
          currentPrice: bestDeal?.price?.amountInt ?? null,
          regularPrice: bestDeal?.regular?.amountInt ?? null,
          discountPercent: bestDeal?.cut ?? null,
          currency: bestDeal?.price?.currency ?? historyLow?.currency ?? currency,
          country,
          shopName: bestDeal?.shop?.name ?? null,
          dealUrl: bestDeal?.url ?? overviewPrice?.urls?.game ?? null,
          historicalLow: historyLow?.amountInt ?? null,
          historicalLow3m: price?.historyLow?.m3?.amountInt ?? null,
          historicalLow1y: price?.historyLow?.y1?.amountInt ?? null,
          status: bestDeal ? "ok" : "no_price",
          fetchedAt: new Date(),
        },
        update: {
          itadId,
          currentPrice: bestDeal?.price?.amountInt ?? null,
          regularPrice: bestDeal?.regular?.amountInt ?? null,
          discountPercent: bestDeal?.cut ?? null,
          currency: bestDeal?.price?.currency ?? historyLow?.currency ?? currency,
          country,
          shopName: bestDeal?.shop?.name ?? null,
          dealUrl: bestDeal?.url ?? overviewPrice?.urls?.game ?? null,
          historicalLow: historyLow?.amountInt ?? null,
          historicalLow3m: price?.historyLow?.m3?.amountInt ?? null,
          historicalLow1y: price?.historyLow?.y1?.amountInt ?? null,
          status: bestDeal ? "ok" : "no_price",
          fetchedAt: new Date(),
        },
      });
    }),
  );
}

export async function lookupItadId({ title, steamAppId }: { title: string; steamAppId?: number | null }) {
  const apiKey = process.env.ITAD_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    if (steamAppId) {
      const url = itadUrl("/games/lookup/v1");
      url.searchParams.set("appid", String(steamAppId));
      const result = (await fetchJson(url)) as ItadLookupResponse | null;

      if (result?.id) {
        return result.id;
      }
    }

    const url = itadUrl("/games/lookup/v1");
    url.searchParams.set("title", title);
    const result = (await fetchJson(url)) as ItadLookupResponse | null;
    return result?.id ?? null;
  } catch {
    return null;
  }
}

export async function fetchItadPrices(ids: string[], country: string) {
  if (ids.length === 0 || !process.env.ITAD_API_KEY) {
    return [] as ItadPricesResponse;
  }

  try {
    const url = itadUrl("/games/prices/v3");
    url.searchParams.set("country", country);
    url.searchParams.set("deals", "true");
    return (await fetchJson(url, ids)) as ItadPricesResponse;
  } catch {
    return [] as ItadPricesResponse;
  }
}

export async function fetchItadOverview(ids: string[], country: string) {
  if (ids.length === 0 || !process.env.ITAD_API_KEY) {
    return {} as ItadOverviewResponse;
  }

  try {
    const url = itadUrl("/games/overview/v2");
    url.searchParams.set("country", country);
    return (await fetchJson(url, ids)) as ItadOverviewResponse;
  } catch {
    return {} as ItadOverviewResponse;
  }
}

function itadUrl(path: string) {
  const url = new URL(path, itadBaseUrl);
  const key = process.env.ITAD_API_KEY;

  if (key) {
    url.searchParams.set("key", key);
  }

  return url;
}

async function fetchJson(url: URL, body?: unknown) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ITAD request failed with ${response.status}`);
  }

  return response.json();
}

async function upsertDealFailure(gameId: string, country: string, currency: string, status: string) {
  await prisma.gameDeal.upsert({
    where: { gameId },
    create: {
      gameId,
      country,
      currency,
      status,
      fetchedAt: new Date(),
    },
    update: {
      country,
      currency,
      status,
      fetchedAt: new Date(),
    },
  });
}

export function formatMinorPrice(value?: number | null, currency = "GBP") {
  if (value === null || value === undefined) {
    return null;
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value / 100);
}
