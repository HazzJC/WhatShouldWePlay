import { announceDiscordPriceAlerts } from "@/lib/discord";
import { evaluatePriceAlerts } from "@/lib/price-alerts";
import { prisma } from "@/lib/prisma";

export async function processActivePriceAlerts() {
  const sessions = await prisma.session.findMany({
    where: {
      workspaceType: "PICK",
      priceAlertRules: { some: { enabled: true } },
    },
    include: {
      participants: { select: { id: true } },
      games: {
        include: {
          signals: true,
          game: { include: { deals: true } },
        },
      },
    },
    orderBy: { priceAlertsCheckedAt: { sort: "asc", nulls: "first" } },
    take: 100,
  });

  let evaluated = 0;
  let errors = 0;
  for (const session of sessions) {
    try {
      const sessionGames = session.games.map((sessionGame) => ({
        ...sessionGame,
        game: {
          ...sessionGame.game,
          deal: sessionGame.game.deals.find((deal) => deal.country === session.dealCountry) ?? null,
        },
      }));
      await evaluatePriceAlerts({
        sessionId: session.id,
        sessionGames,
        selectedCount: session.participants.length,
        currency: session.dealCurrency,
      });
      await announceDiscordPriceAlerts(session.id);
      evaluated += 1;
    } catch (error) {
      errors += 1;
      console.error("[price-alerts] evaluation failed", { sessionId: session.id, error });
    } finally {
      await prisma.session.update({
        where: { id: session.id },
        data: { priceAlertsCheckedAt: new Date() },
      });
    }
  }

  return { evaluated, errors };
}
