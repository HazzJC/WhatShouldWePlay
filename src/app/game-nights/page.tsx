import Link from "next/link";
import { CalendarDays, Clock3, Gamepad2, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function GameNightsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="ui-shell">
        <section className="mx-auto max-w-2xl py-12 text-center">
          <p className="text-sm font-semibold text-coral">Game nights</p>
          <h1 className="mt-2 text-4xl font-black text-ink">Keep every night in one place</h1>
          <p className="mt-3 text-ink/60">Sign in to see Game Nights you created or joined. Planning still works without an account.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/account?returnTo=%2Fgame-nights" className="primary-button">Sign in</Link>
            <Link href="/sessions/new" className="secondary-button">Plan without an account</Link>
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
    orderBy: { updatedAt: "desc" },
  });
  gameNights.sort((a, b) => latestActivity(b).getTime() - latestActivity(a).getTime());

  const grouped = {
    Active: gameNights.filter((night) => statusFor(night.workspaces) === "Active"),
    Upcoming: gameNights.filter((night) => statusFor(night.workspaces) === "Upcoming"),
    Past: gameNights.filter((night) => statusFor(night.workspaces) === "Past"),
  };

  return (
    <main className="ui-shell">
      <header className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-coral">Game nights</p>
          <h1 className="mt-1 text-4xl font-black text-ink">Your group activity</h1>
          <p className="mt-2 text-sm text-ink/60">Planning, shortlists, upcoming nights, and previous decisions.</p>
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
                  <Link key={night.id} href={`/n/${night.shareToken}`} className="surface rounded-lg p-4 transition hover:border-teal/40">
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
                    <p className="mt-4 text-xs text-ink/45">Updated {latestActivity(night).toLocaleDateString("en-GB")}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null)}
        </div>
      ) : (
        <section className="surface rounded-lg p-8 text-center">
          <h2 className="text-xl font-bold text-ink">No Game Nights yet</h2>
          <p className="mt-2 text-sm text-ink/60">Plan a date or create a Pick workspace to start.</p>
          <Link href="/game-nights/new" className="primary-button mt-5"><Plus className="h-4 w-4" />Create Game Night</Link>
        </section>
      )}
    </main>
  );
}

function statusFor(workspaces: Array<{ lockedStartTime: Date | null; lockedEndTime: Date | null; dateRangeEnd: Date }>) {
  const now = new Date();
  if (workspaces.some((workspace) => workspace.lockedStartTime && workspace.lockedStartTime > now)) return "Upcoming";
  if (workspaces.every((workspace) => (workspace.lockedEndTime ?? workspace.dateRangeEnd) < now)) return "Past";
  return "Active";
}

function latestActivity(night: { updatedAt: Date; workspaces: Array<{ updatedAt: Date }> }) {
  return night.workspaces.reduce(
    (latest, workspace) => workspace.updatedAt > latest ? workspace.updatedAt : latest,
    night.updatedAt,
  );
}
