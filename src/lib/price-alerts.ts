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

  if (gamesWithDeals.length === 0) {
    return;
  }

  const rules = await prisma.priceAlertRule.findMany({
    where: { sessionId, enabled: true },
  });
  const defaultRules: AlertRuleInput[] = [
    { id: null, type: "GROUP_ON_SALE" },
    { id: null, type: "MISSING_PLAYERS_ONLY", missingOnly: true },
    { id: null, type: "HISTORICAL_LOW" },
    { id: null, type: "OWNED_COUNT_DISCOUNTED", ownedCount: Math.max(selectedCount - 2, 1), totalCount: selectedCount },
  ];
  const effectiveRules =
    rules.length > 0
      ? rules
      : defaultRules;

  const writes: ReturnType<typeof prisma.priceAlertEvent.upsert>[] = [];

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
          triggeredAt: new Date(),
        },
      }));
    }
  }

  for (let index = 0; index < writes.length; index += 20) {
    await prisma.$transaction(writes.slice(index, index + 20));
  }
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
