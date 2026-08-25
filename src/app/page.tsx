import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, Gamepad2, ListChecks, Share2, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="ui-shell flex flex-col">
      <nav className="flex items-center justify-between gap-3 py-1.5">
        <Link href="/" className="flex items-center gap-2 text-base font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white shadow-card">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
        <div className="flex min-w-0 gap-2">
          <Link href="/changelog" className="secondary-button hidden md:inline-flex">
            Changelog
          </Link>
          <Link href="/account" className="secondary-button hidden lg:inline-flex">
            Account
          </Link>
          <Link href="/sessions/pick" className="secondary-button">
            <Gamepad2 className="h-4 w-4" />
            <span className="hidden sm:inline">Pick games</span>
            <span className="sm:hidden">Pick</span>
          </Link>
          <Link href="/sessions/new" className="primary-button">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Plan a game night</span>
            <span className="sm:hidden">Plan</span>
          </Link>
        </div>
      </nav>

      <section className="reveal-up grid flex-1 items-start gap-7 py-8 lg:grid-cols-[0.88fr_1.12fr] lg:py-12">
        <div className="max-w-2xl">
          <p className="eyebrow"><Sparkles className="h-3.5 w-3.5" /><span>Free planning. No account. No chasing.</span></p>
          <h1 className="mt-3 text-4xl font-black leading-[1.02] text-ink sm:text-5xl lg:text-6xl">
            Stop debating.<br />Start playing.
          </h1>
          <p className="mt-4 max-w-xl text-base font-bold leading-7 text-ink/68 sm:text-lg">
            Send one link, find a time everyone can make, then pick a game the group actually owns.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/sessions/new" className="choice-card focus-ring group !border-coral/25 !bg-coral p-5 text-white">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 shadow-inner"><CalendarDays className="h-6 w-6" /></span>
              <span className="mt-4 block text-[0.65rem] font-black uppercase tracking-[0.15em] text-white/62">First: find the overlap</span>
              <span className="mt-1 block text-2xl font-black">Plan a time</span>
              <span className="mt-2 block text-sm font-bold leading-6 text-white/78">
                See when everyone&apos;s free without asking them to install anything.
              </span>
            </Link>
            <Link href="/sessions/pick" className="choice-card focus-ring group p-5 text-ink">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-purple/12 text-purple"><ListChecks className="h-6 w-6" /></span>
              <span className="mt-4 block text-[0.65rem] font-black uppercase tracking-[0.15em] text-purple">Then: end the debate</span>
              <span className="mt-1 block text-2xl font-black">Pick a game</span>
              <span className="mt-2 inline-flex rounded bg-teal/10 px-2 py-1 text-xs font-semibold text-teal">Free account required</span>
              <span className="mt-2 block text-sm font-bold leading-6 text-ink/62">
                Bring your libraries together and spot the games that work for this group.
              </span>
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
            <Link href="/discover" className="text-teal underline underline-offset-4">Browse game ideas</Link>
            <Link href="/changelog" className="text-ink/60 underline underline-offset-4 md:hidden">Changelog</Link>
          </div>

          <div className="mt-6"><p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-ink/38">From “maybe Friday?” to sorted</p><div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              [Clock3, "Under 2 minutes", "Get the poll out"],
              [Share2, "One link", "Friends just tap and answer"],
              [CheckCircle2, "One answer", "Lock the time and move on"],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="interactive-card rounded-xl border border-ink/10 bg-white/70 p-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/10 text-teal"><Icon className="h-4 w-4" /></span>
                <p className="mt-2 font-black text-ink">{title as string}</p>
                <p className="mt-1 text-sm leading-5 text-ink/60">{copy as string}</p>
              </div>
            ))}
          </div></div>
        </div>

        <div className="hero-stage relative min-h-[400px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink shadow-soft sm:min-h-[480px] lg:min-h-[min(620px,72vh)]">
          <Image
            src="/assets/game-night-choice-hero-v2.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
          <div className="absolute right-4 top-4 flex rotate-2 items-center gap-2 rounded-xl border border-white/15 bg-ink/65 px-3 py-2 text-xs font-black text-white shadow-card backdrop-blur"><Sparkles className="h-4 w-4 text-gold" />Group chat boss defeated</div>
          <div className="absolute bottom-3 left-3 right-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="rounded-lg bg-white/92 p-3 shadow-card backdrop-blur sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink/60">Best time to play</p>
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wide text-ink/60">
                  Example
                </span>
              </div>
              <p className="mt-1 text-2xl font-black text-ink">Friday, 19:00-21:00</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Score value="6" label="Available" className="text-moss" />
                <Score value="1" label="Maybe" className="text-gold" />
                <Score value="0" label="Out" className="text-slate" />
              </div>
            </div>
            <div className="rounded-lg bg-teal p-3 text-white shadow-card sm:min-w-40 sm:p-4">
              <Gamepad2 className="h-5 w-5" />
              <p className="mt-3 text-sm font-bold text-white/70">Top game match</p>
              <p className="text-2xl font-black">92 / 100</p>
              <p className="mt-1 text-xs font-semibold text-white/80">Cross-play ready · 5/6 own it</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Score({ value, label, className }: { value: string; label: string; className: string }) {
  return (
    <div className="rounded-md bg-paper px-2 py-3">
      <p className={`text-2xl font-black ${className}`}>{value}</p>
      <p className="text-xs font-bold text-ink/60">{label}</p>
    </div>
  );
}
