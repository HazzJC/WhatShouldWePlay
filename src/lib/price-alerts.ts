import type { PriceAlertRule } from "@prisma/client";
import { countHaveSignals } from "@/lib/games";
import { formatMinorPrice } from "@/lib/itad";
import { prisma } from "@/lib/prisma";

type AlertRuleInput = Partial<Omit<PriceAlertRule, "id">> & {
  id?: string | null;
  type: PriceAlertRule["type"];
};

type SessionGameForAlert = {
  id: string;
  gameId: string;
  game: {
    id: string;
    title: string;
    deal?: {
      currentPrice?: number | null;
      discountPercent?: number | null;
      historicalLow?: number | null;
      currency?: string | null;
      dealUrl?: string | null;
      status?: string | null;
    } | null;
  };
  signals: Array<{ signal: string }>;
};

export async function evaluatePriceAlerts({
  sessionId,
  sessionGames,
  selectedCount,
  currency,
}: {
  sessionId: string;
  sessionGames: SessionGameForAlert[];
  selectedCount: number;
  currency: string;
}) {
  const gamesWithDeals = sessionGames.filter((sessionGame) => {
    const deal = sessionGame.game.deal;
    return deal?.status === "ok" && deal.currentPrice !== null && deal.currentPrice !== undefined;
  });

  const rules = await prisma.priceAlertRule.findMany({
    where: { sessionId, enabled: true },
  });
  const previousEvents = await prisma.priceAlertEvent.findMany({
    where: { sessionId },
    select: { gameId: true, message: true, resolvedAt: true },
  });
  const previousByKey = new Map(previousEvents.map((event) => [`${event.gameId}\u0000${event.message}`, event]));
  const effectiveRules: AlertRuleInput[] = rules;

  if (effectiveRules.length === 0 || gamesWithDeals.length === 0) {
    await prisma.priceAlertEvent.updateMany({
      where: { sessionId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    return;
  }

  const writes: ReturnType<typeof prisma.priceAlertEvent.upsert>[] = [];
  const activeMessages = new Set<string>();

  for (const sessionGame of gamesWithDeals) {
    const deal = sessionGame.game.deal;

    if (!deal || deal.currentPrice === null || deal.currentPrice === undefined) {
      continue;
    }

    const haveCount = countHaveSignals(sessionGame);
    const missingCount = Math.max(selectedCount - haveCount, 0);

    for (const rule of effectiveRules) {
      const message = alertMessageForRule({
        rule,
        title: sessionGame.game.title,
        haveCount,
        missingCount,
        selectedCount,
        currentPrice: deal.currentPrice,
        historicalLow: deal.historicalLow,
        discountPercent: deal.discountPercent ?? 0,
        currency: deal.currency ?? currency,
      });

      if (!message) {
        continue;
      }
      activeMessages.add(message);
      const previous = previousByKey.get(`${sessionGame.gameId}\u0000${message}`);

      writes.push(prisma.priceAlertEvent.upsert({
        where: {
          sessionId_gameId_message: {
            sessionId,
            gameId: sessionGame.gameId,
            message,
          },
        },
        create: {
          sessionId,
          ruleId: rule.id ?? null,
          gameId: sessionGame.gameId,
          title: sessionGame.game.title,
          message,
          currentPrice: deal.currentPrice,
          historicalLow: deal.historicalLow ?? null,
          currency: deal.currency ?? currency,
          url: deal.dealUrl ?? null,
        },
        update: {
          ruleId: rule.id ?? null,
          currentPrice: deal.currentPrice,
          historicalLow: deal.historicalLow ?? null,
          currency: deal.currency ?? currency,
          url: deal.dealUrl ?? null,
          lastObservedAt: new Date(),
          resolvedAt: null,
          triggeredAt: previous?.resolvedAt ? new Date() : undefined,
        },
      }));
    }
  }

  for (let index = 0; index < writes.length; index += 20) {
    await prisma.$transaction(writes.slice(index, index + 20));
  }

  await prisma.priceAlertEvent.updateMany({
    where: {
      sessionId,
      resolvedAt: null,
      ...(activeMessages.size > 0 ? { message: { notIn: [...activeMessages] } } : {}),
    },
    data: { resolvedAt: new Date() },
  });
}

function alertMessageForRule({
  rule,
  title,
  haveCount,
  missingCount,
  selectedCount,
  currentPrice,
  historicalLow,
  discountPercent,
  currency,
}: {
  rule: AlertRuleInput;
  title: string;
  haveCount: number;
  missingCount: number;
  selectedCount: number;
  currentPrice: number;
  historicalLow?: number | null;
  discountPercent: number;
  currency: string;
}) {
  const price = formatMinorPrice(currentPrice, currency) ?? "a live deal";
  const nearHistoricalLow = historicalLow ? currentPrice <= Math.round(historicalLow * 1.15) : false;

  if (rule.type === "UNDER_PRICE" && rule.thresholdPrice && currentPrice <= rule.thresholdPrice) {
    return `${title} is under ${formatMinorPrice(rule.thresholdPrice, currency)} at ${price}.`;
  }

  if (rule.type === "GROUP_ON_SALE" && discountPercent > 0) {
    return `${title} is ${discountPercent}% off at ${price}.`;
  }

  if (rule.type === "MISSING_PLAYERS_ONLY" && missingCount > 0 && discountPercent > 0) {
    return `${haveCount} of ${selectedCount} players own ${title}. The remaining ${missingCount} can buy it for ${price}${nearHistoricalLow ? ", close to its historical low" : ""}.`;
  }

  if (rule.type === "HISTORICAL_LOW" && nearHistoricalLow) {
    return `${title} is close to its historical low at ${price}.`;
  }

  if (
    rule.type === "OWNED_COUNT_DISCOUNTED" &&
    discountPercent > 0 &&
    haveCount >= (rule.ownedCount ?? Math.max(selectedCount - 2, 1)) &&
    selectedCount >= (rule.totalCount ?? selectedCount)
  ) {
    return `${haveCount} of ${selectedCount} players own ${title}; missing players can buy it for ${price}${nearHistoricalLow ? ", close to its historical low" : ""}.`;
  }

  return null;
}
