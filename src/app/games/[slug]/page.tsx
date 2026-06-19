import Link from "next/link";
import { notFound } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { curatedPriceLabel, curatedSaleLabel, enrichedCuratedGame } from "@/lib/curated-deals";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function GameDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const game = await enrichedCuratedGame(slug);

  if (!game) {
    notFound();
  }

  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between py-2">
        <Link href="/discover" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Discover
        </Link>
        <Link href={`/sessions/pick?game=${game.slug}`} className="primary-button">Start Pick</Link>
      </nav>
      <section className="surface mt-8 rounded-xl p-6">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Group game</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-4xl font-black text-ink">{game.title}</h1>
          {curatedSaleLabel(game) ? (
            <span className="rounded-md bg-coral px-3 py-2 text-sm font-black uppercase tracking-[0.08em] text-white">{curatedSaleLabel(game)}</span>
          ) : null}
        </div>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink/65">{game.description}</p>
        <p className="mt-3 inline-flex rounded-md bg-paper px-3 py-2 text-sm font-black text-ink">
          {curatedPriceLabel(game)}
        </p>
        {game.releaseStatus === "upcoming" ? (
          <p className="mt-3 inline-flex rounded-md bg-gold/20 px-3 py-2 text-sm font-black text-ink">Upcoming pick</p>
        ) : null}
        {game.releaseStatus === "recent" ? (
          <p className="mt-3 inline-flex rounded-md bg-teal/10 px-3 py-2 text-sm font-black text-teal">Recently released</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {game.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-teal/10 px-3 py-2 text-sm font-black text-teal">{tag}</span>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Fact label="Players" value={`${game.minPlayers}-${game.maxPlayers}`} />
          <Fact label="Online" value={game.onlineCoop ? "Yes" : "No"} />
          <Fact label="Local" value={game.localCoop ? "Yes" : "No"} />
        </div>
        {game.caveat ? (
          <div className="mt-4 rounded-lg border border-coral/20 bg-coral/10 p-4">
            <p className="text-sm font-black text-ink">Large-group note</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">{game.caveat}</p>
          </div>
        ) : null}
        <Link href={`/sessions/pick?game=${game.slug}`} className="primary-button mt-6">Start a Pick shortlist with this game</Link>
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value}</p>
    </div>
  );
}
