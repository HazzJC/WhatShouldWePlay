import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { PlayerCountFilter } from "@/components/player-count-filter";
import { curatedGamesForList, curatedLists } from "@/lib/curated-games";
import { parseMinimumPlayers } from "@/lib/player-count";

type PageProps = {
  searchParams?: Promise<{ minPlayers?: string }>;
};

export default async function DiscoverPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const minimumPlayers = parseMinimumPlayers(params?.minPlayers);

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
        <PlayerCountFilter minimumPlayers={minimumPlayers} action="/discover" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curatedLists.map((list) => (
            <Link key={list.slug} href={`/discover/${list.slug}?minPlayers=${minimumPlayers}`} className="surface rounded-xl p-5 transition hover:-translate-y-0.5">
              <h2 className="text-xl font-black text-ink">{list.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">{list.description}</p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-teal">
                {curatedGamesForList(list.slug, minimumPlayers).length} match{curatedGamesForList(list.slug, minimumPlayers).length === 1 ? "" : "es"} for {minimumPlayers}+ players
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
