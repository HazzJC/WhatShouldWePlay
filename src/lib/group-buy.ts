import type { GameDeal } from "@prisma/client";
import { curatedGames, type CuratedGame } from "@/lib/curated-games";
import { normalizeGameTitle } from "@/lib/games";

export type GroupBuyFilters = {
  budget: number;
  genre: string;
  playerCount: number;
  mode: "online" | "local" | "either";
  sessionLength: "one-night" | "long-term" | "campaign" | "any";
  platform: string;
  avoidOwned: boolean;
  saleOnly: boolean;
};

export type GroupBuyRecommendation = {
  game: CuratedGame;
  score: number;
  section: "bestOverall" | "cheapest" | "longTerm" | "oneNight" | "trending";
  reasons: string[];
  price?: number | null;
  currency?: string | null;
  discountPercent?: number | null;
};

export function scoreGroupBuyCandidates({
  filters,
  ownedTitles,
  deals,
}: {
  filters: GroupBuyFilters;
  ownedTitles: string[];
  deals: Map<string, Pick<GameDeal, "currentPrice" | "currency" | "discountPercent">>;
}) {
  const owned = new Set(ownedTitles.map(normalizeGameTitle));
  const candidates = curatedGames
    .filter((game) => !filters.avoidOwned || !owned.has(normalizeGameTitle(game.title)))
    .filter((game) => playerCountFits(game, filters.playerCount))
    .filter((game) => modeFits(game, filters.mode))
    .filter((game) => platformFits(game, filters.platform))
    .filter((game) => filters.sessionLength === "any" || game.sessionLength === filters.sessionLength)
    .filter((game) => filters.genre.trim().length === 0 || game.tags.some((tag) => tag.includes(filters.genre.toLocaleLowerCase())))
    .map((game) => {
      const deal = deals.get(game.title);
      const price = deal?.currentPrice ?? null;
      const withinBudget = !price || price <= filters.budget;
      const onSale = (deal?.discountPercent ?? 0) > 0;
      const reasons = [
        `${filters.playerCount}-player ${filters.mode === "either" ? "group" : filters.mode} fit`,
        `${filters.platform || "Any platform"} compatible`,
        game.sessionLength === "one-night" ? "Works for a one-night session" : "Good long-term group value",
      ];

      if (onSale) {
        reasons.push(`${deal?.discountPercent}% off right now`);
      }

      if (!withinBudget) {
        reasons.push("Over the selected budget");
      }

      return {
        game,
        price,
        currency: deal?.currency ?? null,
        discountPercent: deal?.discountPercent ?? null,
        baseScore:
          45 +
          (withinBudget ? 18 : -20) +
          (onSale ? 12 : 0) +
          (game.trending ? 8 : 0) +
          (game.maxPlayers && game.maxPlayers >= filters.playerCount ? 12 : 0) +
          (platformFits(game, filters.platform) ? 6 : 0) +
          (game.sessionLength === "long-term" ? 3 : 0),
        reasons,
      };
    })
    .filter((candidate) => !filters.saleOnly || (candidate.discountPercent ?? 0) > 0)
    .sort((a, b) => b.baseScore - a.baseScore);

  const recommendations: GroupBuyRecommendation[] = [];
  const add = (section: GroupBuyRecommendation["section"], candidate = candidates[0]) => {
    if (!candidate || recommendations.some((recommendation) => recommendation.game.slug === candidate.game.slug && recommendation.section === section)) {
      return;
    }

    recommendations.push({
      game: candidate.game,
      score: Math.max(0, Math.min(100, Math.round(candidate.baseScore))),
      section,
      reasons: candidate.reasons.slice(0, 3),
      price: candidate.price,
      currency: candidate.currency,
      discountPercent: candidate.discountPercent,
    });
  };

  add("bestOverall", candidates[0]);
  add("cheapest", [...candidates].filter((candidate) => candidate.price !== null).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0]);
  add("longTerm", candidates.find((candidate) => candidate.game.sessionLength === "long-term" || candidate.game.sessionLength === "campaign"));
  add("oneNight", candidates.find((candidate) => candidate.game.sessionLength === "one-night"));
  add("trending", candidates.find((candidate) => candidate.game.trending));

  return recommendations;
}

export function defaultGroupBuyFilters(playerCount: number): GroupBuyFilters {
  return {
    budget: 1500,
    genre: "",
    playerCount,
    mode: "online",
    sessionLength: "any",
    platform: "PC",
    avoidOwned: true,
    saleOnly: false,
  };
}

function playerCountFits(game: CuratedGame, playerCount: number) {
  return (game.minPlayers ?? 1) <= playerCount && (game.maxPlayers ?? playerCount) >= playerCount;
}

function modeFits(game: CuratedGame, mode: GroupBuyFilters["mode"]) {
  if (mode === "online") {
    return game.onlineCoop === true;
  }

  if (mode === "local") {
    return game.localCoop === true;
  }

  return game.onlineCoop === true || game.localCoop === true;
}

function platformFits(game: CuratedGame, platform: string) {
  const requested = platform.trim().toLocaleLowerCase();

  if (!requested || requested === "any") {
    return true;
  }

  return (game.platforms ?? []).some((candidate) => candidate.toLocaleLowerCase().includes(requested));
}
