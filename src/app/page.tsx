import Link from "next/link";
import { CalendarDays, Gamepad2, UsersRound } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
      <nav className="flex items-center justify-between py-2">
        <Link href="/" className="text-lg font-semibold tracking-normal text-ink">
          Let&apos;s Play Games
        </Link>
        <Link
          href="/sessions/new"
          className="focus-ring rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-black"
        >
          Plan a game night
        </Link>
      </nav>

      <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-ember">
            No login needed
          </p>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.02] tracking-normal text-ink sm:text-6xl">
            Find the time, pick the game, get everyone in.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/72">
            Create a shareable game night poll in under a minute. Friends add availability without
            signing up, and the app shows the best time to play.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sessions/new"
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-ember px-5 py-3 font-semibold text-white shadow-soft transition hover:bg-[#b74724]"
            >
              <CalendarDays className="h-5 w-5" />
              Plan a game night
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-ink/10 bg-white/78 p-5 shadow-soft backdrop-blur">
          <div className="rounded-md border border-ink/10 bg-paper p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink/58">Best time to play</p>
                <p className="mt-1 text-2xl font-bold text-ink">Friday, 19:00-21:00</p>
              </div>
              <Gamepad2 className="h-9 w-9 text-tide" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-white p-3">
                <p className="text-2xl font-bold text-moss">6</p>
                <p className="text-xs font-medium text-ink/58">Available</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-2xl font-bold text-ember">1</p>
                <p className="text-xs font-medium text-ink/58">Maybe</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-2xl font-bold text-ink">0</p>
                <p className="text-xs font-medium text-ink/58">Unavailable</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Create", "Choose dates, duration, and group size."],
              ["Share", "Send one link to your friends."],
              ["Lock", "Download the calendar invite."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-md border border-ink/10 bg-white p-4">
                <UsersRound className="mb-3 h-5 w-5 text-tide" />
                <p className="font-semibold text-ink">{title}</p>
                <p className="mt-1 text-sm leading-6 text-ink/62">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
