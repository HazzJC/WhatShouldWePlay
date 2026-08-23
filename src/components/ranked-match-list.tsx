"use client";

import { useMemo, useState } from "react";
import type { MatchCategory, ScoredGame } from "@/lib/match-scoring";

const filters: Array<{ value: "all" | MatchCategory; label: string }> = [
  { value: "all", label: "Best overall" },
  { value: "perfect", label: "Perfect" },
  { value: "hiddenBacklog", label: "Hidden backlog" },
  { value: "oldFavourites", label: "Old favourites" },
  { value: "almostReady", label: "Almost ready" },
  { value: "saleOpportunity", label: "On sale" },
];

export function RankedMatchList({
  games,
  provisional,
  selectedProfiles,
  requestedPlayers,
}: {
  games: ScoredGame[];
  provisional: boolean;
  selectedProfiles: number;
  requestedPlayers: number;
}) {
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const visibleGames = useMemo(
    () => games.filter((game) => filter === "all" || game.categories.includes(filter)).slice(0, 16),
    [filter, games],
  );

  return (
    <section className="mt-4">
      <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Match categories">
        {filters.map((option) => {
          const category = option.value === "all" ? null : option.value;
          const count = category ? games.filter((game) => game.categories.includes(category)).length : games.length;
          if (option.value !== "all" && count === 0) return null;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`focus-ring shrink-0 rounded-md px-3 py-2 text-sm font-semibold ${
                filter === option.value ? "bg-teal text-white" : "border border-ink/10 bg-white text-ink/65"
              }`}
            >
              {option.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid gap-3 xl:grid-cols-2">
        {visibleGames.map((game, index) => (
          <article key={game.sessionGameId} className="rounded-lg border border-ink/10 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink/40">#{index + 1}</p>
                <h3 className="truncate text-lg font-bold text-ink">{game.title}</h3>
                <p className="mt-1 text-sm text-ink/55">{game.ownership.have}/{game.ownership.selected} selected profiles have it</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-teal">{game.score}</p>
                <p className="text-xs font-medium text-ink/40">match</p>
              </div>
            </div>
            {provisional ? (
              <p className="mt-3 rounded-md bg-gold/15 px-3 py-2 text-xs font-semibold text-ink">
                Early score · based on {selectedProfiles} of {requestedPlayers} player profiles
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={`rounded px-2 py-1 text-xs font-semibold ${game.alignment === "Low" ? "bg-red-50 text-red-800" : game.alignment === "Medium" ? "bg-gold/15 text-ink" : "bg-moss/10 text-moss"}`}>
                {game.alignment} alignment
              </span>
              {game.categories.slice(0, 2).map((category) => <span key={category} className="rounded bg-linen px-2 py-1 text-xs font-medium text-ink/55">{categoryLabel(category)}</span>)}
              {game.discountPercent > 0 ? <span className="rounded bg-coral/10 px-2 py-1 text-xs font-semibold text-coral">{game.discountPercent}% off</span> : null}
              {game.platformFit === "crossplay" ? <span className="rounded bg-teal/10 px-2 py-1 text-xs font-semibold text-teal">Cross-play ready</span> : null}
              {game.platformFit === "same-platform" && game.platforms?.length === 1 ? <span className="rounded bg-linen px-2 py-1 text-xs font-medium text-ink/60">All on {game.platforms[0]}</span> : null}
              {game.platformFit === "mismatch" ? <span className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">Check cross-play</span> : null}
            </div>
            <ul className="mt-3 grid gap-1 text-sm leading-6 text-ink/65">
              {game.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            <details className="mt-3 border-t border-ink/10 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-teal">How this score was calculated</summary>
              <div className="mt-3 grid gap-2">
                {game.factorBreakdown.slice(0, 8).map((factor) => (
                  <div key={factor.key} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs text-ink/55">
                    <span>{factor.label}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-linen"><span className="block h-full rounded-full bg-teal" style={{ width: `${factor.value}%` }} /></span>
                    <span className="text-right">{Math.round(factor.points)} pts</span>
                  </div>
                ))}
              </div>
            </details>
          </article>
        ))}
        {visibleGames.length === 0 ? <p className="rounded-lg border border-dashed border-ink/20 p-5 text-sm text-ink/55 xl:col-span-2">No games match this filter yet.</p> : null}
      </div>
    </section>
  );
}

function categoryLabel(category: MatchCategory) {
  return {
    perfect: "Perfect",
    hiddenBacklog: "Hidden backlog",
    oldFavourites: "Old favourite",
    almostReady: "Almost ready",
    saleOpportunity: "Sale",
  }[category];
}
