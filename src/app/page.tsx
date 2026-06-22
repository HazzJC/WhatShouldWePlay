import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, Gamepad2, ListChecks, Share2, UsersRound } from "lucide-react";

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
          <Link href="/release-notes" className="secondary-button hidden md:inline-flex">
            Updates
          </Link>
          <a href="/auth/google/start" className="secondary-button hidden lg:inline-flex">
            Sign in
          </a>
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

      <section className="grid flex-1 items-center gap-5 py-5 lg:grid-cols-[0.9fr_1.1fr] lg:py-7">
        <div className="max-w-2xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">
            No login needed
          </p>
          <h1 className="mt-3 text-4xl font-black leading-[1.02] text-ink sm:text-5xl lg:text-6xl">
            Let&apos;s Play Games
          </h1>
          <p className="mt-4 max-w-xl text-base font-bold leading-7 text-ink/68 sm:text-lg">
            Find the time, pick the crew, and get a game night locked without chasing everyone
            across chat.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/sessions/new" className="focus-ring rounded-lg border border-coral/30 bg-coral p-4 text-white shadow-card transition hover:-translate-y-0.5 hover:bg-coralDark">
              <CalendarDays className="h-6 w-6" />
              <span className="mt-3 block text-xl font-black">Plan a time</span>
              <span className="mt-2 block text-sm font-bold leading-6 text-white/78">
                Build an availability poll, share one link, and lock the best slot.
              </span>
            </Link>
            <Link href="/sessions/pick" className="focus-ring rounded-lg border border-ink/10 bg-white p-4 text-ink shadow-card transition hover:-translate-y-0.5 hover:border-teal/40 hover:bg-paper">
              <ListChecks className="h-6 w-6 text-teal" />
              <span className="mt-3 block text-xl font-black">Pick a game</span>
              <span className="mt-2 block text-sm font-bold leading-6 text-ink/62">
                Import libraries, compare ownership, and shortlist what the group can play.
              </span>
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
            <Link href="/discover" className="text-teal underline underline-offset-4">Browse game ideas</Link>
            <Link href="/release-notes" className="text-ink/60 underline underline-offset-4 md:hidden">Updates</Link>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              [Clock3, "2 minutes", "Build a poll fast"],
              [Share2, "One link", "No accounts for friends"],
              [CheckCircle2, "Best time", "See the winning slot"],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="rounded-lg border border-ink/10 bg-white/70 p-3">
                <Icon className="h-5 w-5 text-teal" />
                <p className="mt-2 font-black text-ink">{title as string}</p>
                <p className="mt-1 text-sm leading-5 text-ink/60">{copy as string}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[380px] overflow-hidden rounded-xl border border-ink/10 bg-ink shadow-soft sm:min-h-[460px] lg:min-h-[min(620px,72vh)]">
          <Image
            src="/assets/game-night-hero.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
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
            <div className="rounded-lg bg-teal p-3 text-white shadow-card sm:p-4">
              <UsersRound className="h-5 w-5" />
              <p className="mt-3 text-sm font-bold text-white/70">Crew status</p>
              <p className="text-xl font-black">Ready to lock</p>
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
