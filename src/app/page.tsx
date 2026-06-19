import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, Gamepad2, ListChecks, Share2, UsersRound } from "lucide-react";

export default function Home() {
  return (
    <main className="ui-shell flex flex-col">
      <nav className="flex items-center justify-between gap-4 py-2">
        <Link href="/" className="flex items-center gap-2 text-base font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
        <div className="flex gap-2">
          <Link href="/release-notes" className="secondary-button hidden md:inline-flex">
            Updates
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

      <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">
            No login needed
          </p>
          <h1 className="mt-4 text-4xl font-black leading-[1.04] text-ink sm:text-5xl lg:text-6xl">
            Let&apos;s Play Games
          </h1>
          <p className="mt-5 text-lg leading-8 text-ink/70">
            Find the time, pick the crew, and get a game night locked without chasing everyone
            across chat.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link href="/sessions/new" className="rounded-xl border border-coral/20 bg-coral p-5 text-white shadow-card transition hover:bg-coralDark focus-ring">
              <CalendarDays className="h-6 w-6" />
              <span className="mt-4 block text-xl font-black">Plan a time</span>
              <span className="mt-2 block text-sm font-bold leading-6 text-white/78">
                Build an availability poll, share one link, and lock the best slot.
              </span>
            </Link>
            <Link href="/sessions/pick" className="rounded-xl border border-ink/10 bg-white p-5 text-ink shadow-card transition hover:-translate-y-0.5 hover:bg-paper focus-ring">
              <ListChecks className="h-6 w-6 text-teal" />
              <span className="mt-4 block text-xl font-black">Pick a game</span>
              <span className="mt-2 block text-sm font-bold leading-6 text-ink/62">
                Import libraries, compare ownership, and shortlist what the group can play.
              </span>
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
            <Link href="/discover" className="text-teal underline underline-offset-4">Browse game ideas</Link>
            <Link href="/release-notes" className="text-ink/60 underline underline-offset-4 md:hidden">Updates</Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              [Clock3, "2 minutes", "Build a poll fast"],
              [Share2, "One link", "No accounts for friends"],
              [CheckCircle2, "Best time", "See the winning slot"],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="rounded-lg border border-ink/10 bg-white/70 p-4">
                <Icon className="h-5 w-5 text-teal" />
                <p className="mt-3 font-black text-ink">{title as string}</p>
                <p className="mt-1 text-sm leading-6 text-ink/60">{copy as string}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-ink/10 bg-ink shadow-soft">
          <Image
            src="/assets/game-night-hero.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="rounded-lg bg-white/92 p-4 shadow-card backdrop-blur">
              <p className="text-sm font-bold text-ink/60">Best time to play</p>
              <p className="mt-1 text-2xl font-black text-ink">Friday, 19:00-21:00</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Score value="6" label="Available" className="text-moss" />
                <Score value="1" label="Maybe" className="text-gold" />
                <Score value="0" label="Out" className="text-slate" />
              </div>
            </div>
            <div className="rounded-lg bg-teal p-4 text-white shadow-card">
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
