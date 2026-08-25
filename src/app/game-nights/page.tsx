import Link from "next/link";
import { CalendarDays, Clock3, Gamepad2, History, Plus, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function GameNightsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="ui-shell">
        <section className="route-hero mx-auto max-w-4xl p-6 sm:p-10">
          <span className="sticker !border-white/15 !bg-white/10 !text-white/75"><History className="mr-1 h-3.5 w-3.5" />Saved game nights</span>
          <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight text-white sm:text-5xl">Keep your plans, groups and shortlists</h1>
          <p className="mt-4 max-w-2xl font-bold leading-7 text-white/62">Sign in to find every plan, shortlist and final choice again. Just making a quick availability poll? You still don&apos;t need an account.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link href="/account?returnTo=%2Fgame-nights" className="choice-card group !border-white/10 !bg-white/10 p-5 text-white"><Sparkles className="h-6 w-6 text-gold" /><span className="mt-3 block text-xl font-black">Open my game nights</span><span className="mt-1 block text-sm font-bold text-white/55">Sign in and pick up where the group left off.</span></Link>
            <Link href="/sessions/new" className="choice-card group !border-white/10 !bg-white/10 p-5 text-white"><CalendarDays className="h-6 w-6 text-teal" /><span className="mt-3 block text-xl font-black">Make an availability poll</span><span className="mt-1 block text-sm font-bold text-white/55">Share one link; guests can answer without an account.</span></Link>
          </div>
        </section>
      </main>
    );
  }

  const gameNights = await prisma.gameNight.findMany({
    where: {
      OR: [
        { ownerUserId: user.id },
        { workspaces: { some: { participants: { some: { userId: user.id } } } } },
      ],
    },
    include: {
      workspaces: {
        include: {
          participants: {
            select: {
              id: true,
              responses: { select: { id: true } },
              user: { select: { steamAccount: { select: { id: true } } } },
            },
          },
          games: { select: { id: true } },
        },
      },
    },
    orderBy: { lastActivityAt: "desc" },
  });

  const grouped = {
    Active: gameNights.filter((night) => statusFor(night) === "Active"),
    Upcoming: gameNights.filter((night) => statusFor(night) === "Upcoming"),
    Past: gameNights.filter((night) => statusFor(night) === "Past"),
  };

  return (
    <main className="ui-shell">
      <header className="route-hero flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.15em] text-coral">Saved game nights</p>
          <h1 className="mt-2 text-4xl font-black text-white">Your game nights</h1>
          <p className="mt-2 text-sm font-bold text-white/58">Open an active plan, return to a shortlist, or reuse a group.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/game-nights/new" className="primary-button"><CalendarDays className="h-4 w-4" />New Game Night</Link>
          <Link href="/sessions/pick" className="secondary-button"><Gamepad2 className="h-4 w-4" />Pick</Link>
        </div>
      </header>

      {gameNights.length ? (
        <div className="grid gap-8">
          {Object.entries(grouped).map(([label, nights]) => nights.length ? (
            <section key={label}>
              <h2 className="text-xl font-bold text-ink">{label}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {nights.map((night) => (
                  <Link key={night.id} href={`/n/${night.shareToken}`} className="choice-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-bold text-ink">{night.title}</h3>
                      <Clock3 className="h-4 w-4 text-ink/35" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {night.workspaces.map((workspace) => (
                        <span key={workspace.id} className="rounded bg-linen px-2 py-1 text-xs font-semibold text-ink/65">
                          {workspace.workspaceType === "PLAN"
                            ? `Plan · ${workspace.participants.filter((participant) => participant.responses.length).length}/${workspace.participants.length} replied`
                            : `Pick · ${workspace.games.length} shortlisted`}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-ink/45">Updated {night.lastActivityAt.toLocaleDateString("en-GB")}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null)}
        </div>
      ) : (
        <section className="surface p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-purple/10 text-purple"><Gamepad2 className="h-7 w-7" /></span>
          <h2 className="mt-4 text-2xl font-black text-ink">No saved game nights yet</h2>
          <p className="mt-2 text-sm font-bold text-ink/55">Create one to keep its plan, group and shortlist together.</p>
          <Link href="/game-nights/new" className="primary-button mt-5"><Plus className="h-4 w-4" />Create Game Night</Link>
        </section>
      )}
    </main>
  );
}

function statusFor(night: { status: string; workspaces: Array<{ lockedStartTime: Date | null; lockedEndTime: Date | null }> }) {
  const now = new Date();
  if (night.status === "COMPLETED" || night.status === "CANCELLED") return "Past";
  if (night.workspaces.some((workspace) => workspace.lockedStartTime && workspace.lockedStartTime > now)) return "Upcoming";
  return "Active";
}
