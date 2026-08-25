import Link from "next/link";
import { ArrowRight, CalendarDays, Gamepad2, LibraryBig, UsersRound } from "lucide-react";
import { HomeProductDemo } from "@/components/home-product-demo";

export default function Home() {
  return (
    <main className="ui-shell flex flex-col">
      <section className="home-hero reveal-up grid items-center gap-8 py-8 lg:grid-cols-[0.76fr_1.24fr] lg:gap-10 lg:py-12">
        <div className="max-w-2xl">
          <p className="eyebrow">Guests can answer without an account</p>
          <h1 className="mt-4 text-4xl font-black leading-[1.02] text-ink sm:text-5xl lg:text-[3.65rem]">
            Find the night.<br />Then find the game.
          </h1>
          <p className="mt-5 max-w-xl text-base font-bold leading-7 text-ink/68 sm:text-lg">
            Share a few possible times, see where everyone overlaps, then compare the games your group owns. One link for the plan; a useful shortlist for the game.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/sessions/new" className="primary-button min-h-12 px-5">
              <CalendarDays className="h-5 w-5" />
              Plan a night
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/sessions/pick" className="secondary-button min-h-12 px-5">
              <Gamepad2 className="h-5 w-5 text-purple" />
              Compare our games
            </Link>
          </div>
          <p className="mt-3 text-sm font-semibold text-ink/52">
            Planning is open to everyone. Sign in only if you want to save libraries and groups.
          </p>

          <div className="mt-8 hidden gap-2 sm:grid sm:grid-cols-2">
            <Link href="/sessions/new" className="home-route-card group focus-ring">
              <span className="home-route-icon bg-coral/10 text-coral"><UsersRound className="h-5 w-5" /></span>
              <span><strong>See when people are free</strong><small>Guests tap the times they can make.</small></span>
              <ArrowRight className="h-4 w-4 text-ink/30 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/discover" className="home-route-card group focus-ring">
              <span className="home-route-icon bg-teal/10 text-teal"><LibraryBig className="h-5 w-5" /></span>
              <span><strong>Browse multiplayer games</strong><small>Filter by group size, setup and price.</small></span>
              <ArrowRight className="h-4 w-4 text-ink/30 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <HomeProductDemo />
      </section>

      <section className="home-explainer reveal-up mb-6 grid overflow-hidden rounded-3xl border border-ink/10 bg-surface shadow-soft md:grid-cols-3" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="sr-only">How it works</h2>
        <Explainer number="1" title="Send one link" copy="Choose some dates and share the plan in your group chat." />
        <Explainer number="2" title="Lock in the overlap" copy="The clearest times rise to the top as people answer." />
        <Explainer number="3" title="Compare the group" copy="Ownership, player count, platforms and playtime shape the shortlist." />
      </section>
    </main>
  );
}

function Explainer({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <div className="home-explainer-step p-5 sm:p-6">
      <span className="home-explainer-number">{number}</span>
      <div><h3 className="font-black text-ink">{title}</h3><p className="mt-1 text-sm leading-6 text-ink/58">{copy}</p></div>
    </div>
  );
}
