import Link from "next/link";
import { Gamepad2, UsersRound } from "lucide-react";
import { PlayerCountFilter } from "@/components/player-count-filter";
import { curatedGamesForList, curatedLists } from "@/lib/curated-games";
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
        <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Discover</p>
        <h1 className="mt-3 text-4xl font-black text-ink">Find better group games</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
          Browse curated multiplayer lists before anyone connects Steam.
        </p>
        {!hasPlayerCount ? (
          <section className="surface mt-6 rounded-lg p-5">
            <div className="flex items-center gap-2 text-teal"><UsersRound className="h-5 w-5" /><h2 className="text-xl font-bold text-ink">How many people need to play?</h2></div>
            <p className="mt-2 text-sm text-ink/60">Choose a group size so every list contains games your group can actually play.</p>
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
        {hasPlayerCount ? (
        <>
        <Link href="/discover/challenges" className="mt-5 block rounded-xl border border-coral/30 bg-coral p-5 text-white shadow-card transition hover:-translate-y-0.5 hover:bg-coralDark">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">New: co-op challenges</p>
          <h2 className="mt-1 text-2xl font-black">Hard things worth attempting together</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-white/80">
            Browse sourced LASO runs, flawless raids, S-rank campaigns, and other difficult group goals with estimated completion times.
          </p>
        </Link>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLists.map((list) => (
            <Link key={list.slug} href={`/discover/${list.slug}?minPlayers=${minimumPlayers}`} className="surface rounded-xl p-5 transition hover:-translate-y-0.5">
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
