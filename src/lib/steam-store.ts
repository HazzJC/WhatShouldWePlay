import { prisma } from "@/lib/prisma";

const cacheMs = 1000 * 60 * 60 * 12;

type SteamAppDetailsResponse = Record<
  string,
  {
    success: boolean;
    data?: {
      is_free?: boolean;
      price_overview?: {
        currency?: string;
        initial?: number;
        final?: number;
        discount_percent?: number;
      };
    };
  }
>;

export async function refreshSteamStorePrices(gameIds: string[]) {
  const games = await prisma.game.findMany({
    where: {
      id: { in: gameIds },
      steamAppId: { not: null },
    },
    include: { steamStorePrice: true },
  });
  const staleGames = games.filter((game) => {
    if (!game.steamStorePrice) {
      return true;
    }

    return Date.now() - game.steamStorePrice.fetchedAt.getTime() > cacheMs;
  });

  await Promise.all(
    staleGames.map(async (game) => {
      const steamAppId = game.steamAppId!;

      try {
        const details = await fetchSteamAppDetails(steamAppId);
        const price = details?.data?.price_overview;
        const isFree = details?.data?.is_free === true;
        const status = details?.success ? "ok" : "unavailable";

        await prisma.steamStorePrice.upsert({
          where: { gameId: game.id },
          create: {
            gameId: game.id,
            steamAppId,
            currency: price?.currency ?? null,
            initialPrice: isFree ? 0 : price?.initial ?? null,
            finalPrice: isFree ? 0 : price?.final ?? null,
            discountPercent: price?.discount_percent ?? 0,
            status,
            fetchedAt: new Date(),
          },
          update: {
            currency: price?.currency ?? null,
            initialPrice: isFree ? 0 : price?.initial ?? null,
            finalPrice: isFree ? 0 : price?.final ?? null,
            discountPercent: price?.discount_percent ?? 0,
            status,
            fetchedAt: new Date(),
          },
        });
      } catch {
        await prisma.steamStorePrice.upsert({
          where: { gameId: game.id },
          create: {
            gameId: game.id,
            steamAppId,
            status: "failed",
            fetchedAt: new Date(),
          },
          update: {
            status: "failed",
            fetchedAt: new Date(),
          },
        });
      }
    }),
  );
}

export async function fetchSteamAppDetails(steamAppId: number) {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(steamAppId));
  url.searchParams.set("filters", "price_overview,basic");
  url.searchParams.set("cc", "gb");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Steam store lookup failed with ${response.status}`);
  }

  const payload = (await response.json()) as SteamAppDetailsResponse;
  return payload[String(steamAppId)] ?? null;
}
