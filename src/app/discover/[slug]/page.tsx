import Link from "next/link";
import { notFound } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { PlayerCountFilter } from "@/components/player-count-filter";
import { curatedGamesForList, getCuratedList } from "@/lib/curated-games";
import { curatedPriceLabel, curatedSaleLabel, enrichCuratedGamesWithDeals, sortCuratedGamesForDiscovery } from "@/lib/curated-deals";
import { parseMinimumPlayers } from "@/lib/player-count";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ minPlayers?: string }>;
};

export default async function DiscoverListPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const minimumPlayers = parseMinimumPlayers(query?.minPlayers);
  const list = getCuratedList(slug);

  if (!list) {
    notFound();
  }

  const games = sortCuratedGamesForDiscovery(await enrichCuratedGamesWithDeals(curatedGamesForList(slug, minimumPlayers)));

  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between py-2">
        <Link href="/discover" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Discover
        </Link>
        <Link href="/sessions/pick" className="primary-button">Start Pick</Link>
      </nav>
      <section className="py-8">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Curated list</p>
        <h1 className="mt-3 text-4xl font-black text-ink">{list.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">{list.description}</p>
        <PlayerCountFilter minimumPlayers={minimumPlayers} action={`/discover/${slug}`} />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {games.length > 0 ? (
            games.map((game) => (
              <Link key={game.slug} href={`/games/${game.slug}`} className="surface rounded-xl p-5 transition hover:-translate-y-0.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-xl font-black text-ink">{game.title}</h2>
                  {curatedSaleLabel(game) ? (
                    <span className="rounded-md bg-coral px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] text-white">{curatedSaleLabel(game)}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-ink/60">{game.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="rounded-md bg-teal/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-teal">
                    {game.minPlayers}-{game.maxPlayers} players
                  </p>
                  <p className="rounded-md bg-paper px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-ink/60">
                    {curatedPriceLabel(game)}
                  </p>
                </div>
                {game.caveat ? <p className="mt-2 text-xs font-bold leading-5 text-coral">{game.caveat}</p> : null}
              </Link>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-ink/20 bg-paper p-5 text-sm font-bold leading-6 text-ink/60">
              No picks in this list support {minimumPlayers}+ players yet. Try <Link href={`/discover/more-than-4?minPlayers=${minimumPlayers}`} className="text-teal underline">More than 4?</Link> or lower the player requirement.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
