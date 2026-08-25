import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, Gamepad2, LibraryBig, Sparkles, UsersRound } from "lucide-react";

export const metadata: Metadata = {
  title: "About | Let's Play Games",
  description: "Why Let's Play Games exists, what it does, and what it does with your data.",
};

const jobs = [
  [CalendarCheck2, "Find the overlap", "Send one link. Friends mark when they can make it without creating an account."],
  [LibraryBig, "Compare the pile", "Bring Steam and manually-added libraries together, with console platforms and cross-play taken into account."],
  [Sparkles, "Make a useful suggestion", "Spot the game five people already own, the cheap missing copy, or something the group has not worn out yet."],
] as const;

export default function AboutPage() {
  return (
    <main className="ui-shell">
      <header className="route-hero reveal-up mx-auto max-w-5xl p-7 sm:p-10">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Why this exists</p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-white sm:text-6xl">Built to end the “what are we playing?” loop.</h1>
        <p className="mt-5 max-w-3xl text-lg font-bold leading-8 text-white/62">
          Let&apos;s Play Games is a small, independent tool for the bit before game night: finding a time, working out what everyone owns, and making a decision before somebody gives up and launches their usual game.
        </p>
      </header>

      <section className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3" aria-label="What the app does">
        {jobs.map(([Icon, title, copy], index) => (
          <article key={title} className="interactive-card surface reveal-up rounded-xl p-5" style={{ animationDelay: `${index * 70}ms` }}>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal/10 text-teal"><Icon className="h-5 w-5" /></span>
            <h2 className="mt-4 text-xl font-black text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">{copy}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto my-8 grid max-w-5xl gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <article className="surface rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-3"><UsersRound className="h-6 w-6 text-coral" /><h2 className="text-2xl font-black text-ink">Accounts are optional until they help</h2></div>
          <p className="mt-4 leading-7 text-ink/65">Nobody needs an account to answer an availability poll. An account becomes useful when you want to keep a library, save friends and groups, or come back to past game nights.</p>
          <p className="mt-3 leading-7 text-ink/65">Steam can provide owned games and playtime when your profile allows it. Xbox and PlayStation identities can be saved, but those platforms do not offer the same open library access, so console games can also be added by hand. We would rather show an honest unknown than invent a confident match.</p>
        </article>
        <aside className="rounded-xl bg-ink p-6 text-white sm:p-8">
          <Gamepad2 className="h-7 w-7 text-teal" />
          <h2 className="mt-5 text-2xl font-black">Made for real groups</h2>
          <p className="mt-3 leading-7 text-white/68">Messy libraries, awkward headcounts, one friend on console, another who refuses to buy anything: that is the actual design brief.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/sessions/new" className="primary-button">Plan a night</Link>
            <Link href="/changelog" className="secondary-button">See what changed</Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
