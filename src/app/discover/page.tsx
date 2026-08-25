import Link from "next/link";
import { ArrowRight, Gamepad2, Sparkles, UsersRound } from "lucide-react";
import { GameArtwork } from "@/components/game-artwork";
import { PlayerCountFilter } from "@/components/player-count-filter";
import { curatedGames, curatedGamesForList, curatedLists, curatedPlayerLabel, supportsAtLeast, type CuratedGame } from "@/lib/curated-games";
import { parseMinimumPlayers } from "@/lib/player-count";

type PageProps = {
  searchParams?: Promise<{ minPlayers?: string }>;
};

export default async function DiscoverPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const hasPlayerCount = Boolean(params?.minPlayers);
  const minimumPlayers = parseMinimumPlayers(params?.minPlayers);
  const visibleLists = curatedLists
    .map((list) => ({ ...list, games: curatedGamesForList(list.slug, minimumPlayers) }))
    .filter((list) => list.games.length > 0);
  const spotlightGames = curatedGames
    .filter((game) => game.steamAppId && game.releaseStatus !== "upcoming")
    .filter((game) => !hasPlayerCount || supportsAtLeast(game, minimumPlayers))
    .sort((a, b) => Number(Boolean(b.trending)) - Number(Boolean(a.trending)))
    .slice(0, 3);

  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
        <Link href="/sessions/pick" className="primary-button">Start Pick</Link>
      </nav>
      <section className="py-8">
        <header className="route-hero p-6 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">The game cupboard</p>
        <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">What can we actually play?</h1>
        <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/60">
          Filter by headcount, couch or online setup, price, and how much faff your group will tolerate.
        </p>
        </header>
        {!hasPlayerCount ? (
          <section className="surface mt-6 rounded-lg p-5">
            <div className="flex items-center gap-2 text-teal"><UsersRound className="h-5 w-5" /><h2 className="text-xl font-bold text-ink">How many people need to play?</h2></div>
            <p className="mt-2 text-sm text-ink/60">Pick a headcount and we&apos;ll hide anything that leaves somebody watching.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[2, 4, 6, 8, 10].map((count) => (
                <Link key={count} href={`/discover?minPlayers=${count}`} className="secondary-button min-w-16">{count === 10 ? "10+" : count}</Link>
              ))}
              <Link href="/discover?minPlayers=1" className="text-button px-3 py-2 text-sm font-semibold text-teal">Browse everything</Link>
            </div>
          </section>
        ) : (
        <PlayerCountFilter minimumPlayers={minimumPlayers} action="/discover" />
        )}
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-coral"><Sparkles className="h-4 w-4" /> Tonight&apos;s wildcards</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">Three games to throw into the chat</h2>
            </div>
            {hasPlayerCount ? <p className="text-sm font-medium text-ink/55">Every pick supports {minimumPlayers}+ players</p> : null}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {spotlightGames.map((game, index) => <SpotlightCard key={game.slug} game={game} minimumPlayers={hasPlayerCount ? minimumPlayers : undefined} priority={index === 0} />)}
          </div>
        </section>
        {hasPlayerCount ? (
        <>
        <Link href="/discover/challenges" className="interactive-card mt-5 block rounded-xl border border-coral/30 bg-coral p-5 text-white shadow-card hover:bg-coralDark">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">New: co-op challenges</p>
          <h2 className="mt-1 text-2xl font-black">Hard things worth attempting together</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-white/80">
            Browse sourced LASO runs, flawless raids, S-rank campaigns, and other difficult group goals with estimated completion times.
          </p>
        </Link>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLists.map((list) => (
            <Link key={list.slug} href={`/discover/${list.slug}?minPlayers=${minimumPlayers}`} className="surface rounded-xl p-5">
              <div className="mb-4 flex h-20 overflow-hidden rounded-lg bg-ink/10">
                {list.games.filter((game) => game.steamAppId).slice(0, 3).map((game) => (
                  <GameArtwork key={game.slug} appId={game.steamAppId!} title={game.title} sizes="184px" className="min-w-0 flex-1" />
                ))}
              </div>
              <h2 className="text-xl font-black text-ink">{list.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">{list.description}</p>
              <p className="mt-3 line-clamp-2 text-sm font-semibold text-ink/75">{list.games.slice(0, 3).map((game) => game.title).join(" · ")}</p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-teal">
                {list.games.length} match{list.games.length === 1 ? "" : "es"} for {minimumPlayers}+ players
              </p>
            </Link>
          ))}
        </div>
        </>
        ) : null}
      </section>
    </main>
  );
}

function SpotlightCard({ game, minimumPlayers, priority = false }: { game: CuratedGame; minimumPlayers?: number; priority?: boolean }) {
  const params = minimumPlayers ? `?minPlayers=${minimumPlayers}` : "";

  return (
    <Link href={`/games/${game.slug}${params}`} className="interactive-card group relative min-h-64 overflow-hidden rounded-xl border border-ink/10 bg-ink text-white shadow-card">
      <GameArtwork appId={game.steamAppId!} title={game.title} sizes="(min-width: 768px) 33vw, 100vw" className="!absolute inset-0" imageClassName="transition duration-500 group-hover:scale-105" priority={priority} />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">{curatedPlayerLabel(game)}</p>
        <h3 className="mt-1 text-xl font-bold">{game.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/75">{game.description}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white">See why it fits <ArrowRight className="h-4 w-4" /></span>
      </div>
    </Link>
  );
}
