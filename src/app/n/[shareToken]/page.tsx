import Link from "next/link";
import { CalendarDays, CheckCircle2, Gamepad2, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { SharePanel } from "@/components/share-panel";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateGameNightStatusAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

export const metadata = { robots: { index: false, follow: false } };

export default async function GameNightOverviewPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const gameNight = await prisma.gameNight.findUnique({
    where: { shareToken },
    include: {
      selectedSessionGame: { include: { game: true } },
      workspaces: {
        include: {
          participants: {
            include: {
              responses: { select: { id: true } },
              user: { select: { steamAccount: { select: { id: true } } } },
            },
          },
          games: { select: { id: true } },
        },
      },
    },
  });

  if (!gameNight) notFound();

  const appUrl = await getAppUrl();
  const currentUser = await getCurrentUser();
  const canManage = currentUser?.id === gameNight.ownerUserId;
  const plan = gameNight.workspaces.find((workspace) => workspace.workspaceType === "PLAN");
  const pick = gameNight.workspaces.find((workspace) => workspace.workspaceType === "PICK");

  return (
    <main className="ui-shell">
      <header className="flex flex-col gap-4 border-b border-ink/10 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal">Game Night</p>
          <h1 className="mt-1 text-4xl font-black text-ink">{gameNight.title}</h1>
          <p className="mt-2 text-sm text-ink/60">One shared space for the date and the game.</p>
        </div>
        <SharePanel url={`${appUrl}/n/${gameNight.shareToken}`} title={gameNight.title} />
      </header>

      <section className="grid gap-4 py-6 lg:grid-cols-2">
        {plan ? (
          <WorkspaceCard
            icon={<CalendarDays className="h-5 w-5" />}
            eyebrow="Plan"
            title={plan.lockedStartTime ? "Time confirmed" : "Share your availability"}
            detail={`${plan.participants.filter((participant) => participant.responses.length).length} of ${plan.participants.length} players have responded`}
            href={`/s/${plan.shareToken}`}
            action={plan.lockedStartTime ? "View confirmed time" : "Fill availability"}
          />
        ) : (
          <MissingWorkspace icon={<CalendarDays className="h-5 w-5" />} title="Scheduling has not been set up yet" href={canManage ? `/sessions/new?gameNight=${gameNight.id}` : undefined} action="Create Plan" />
        )}
        {pick ? (
          <WorkspaceCard
            icon={<Gamepad2 className="h-5 w-5" />}
            eyebrow="Pick"
            title={pick.games.length ? "Compare the shortlist" : "Build the shortlist"}
            detail={`${pick.participants.filter((participant) => participant.user?.steamAccount).length} of ${pick.participants.length} libraries connected · ${pick.games.length} games shortlisted`}
            href={`/s/${pick.shareToken}?tab=pick`}
            action="Open Pick"
          />
        ) : (
          <MissingWorkspace icon={<Gamepad2 className="h-5 w-5" />} title="No game shortlist yet" href={canManage ? `/sessions/pick?gameNight=${gameNight.id}` : undefined} action="Create Pick" />
        )}
      </section>

      {gameNight.selectedSessionGame ? (
        <section className="mb-6 rounded-lg border border-moss/30 bg-moss/10 p-5">
          <p className="text-sm font-semibold text-moss">Final game</p>
          <h2 className="mt-1 text-3xl font-black text-ink">{gameNight.selectedSessionGame.game.title}</h2>
        </section>
      ) : null}

      {canManage ? (
        <section className="mb-6 flex flex-wrap items-center gap-2">
          <p className="mr-2 text-sm font-semibold text-ink/60">Status: {gameNight.status.toLocaleLowerCase()}</p>
          {gameNight.status === "ACTIVE" ? (
            <>
              <form action={updateGameNightStatusAction}><input type="hidden" name="gameNightId" value={gameNight.id} /><input type="hidden" name="status" value="COMPLETED" /><PendingSubmitButton className="secondary-button" pendingLabel="Completing...">Mark complete</PendingSubmitButton></form>
              <form action={updateGameNightStatusAction}><input type="hidden" name="gameNightId" value={gameNight.id} /><input type="hidden" name="status" value="CANCELLED" /><PendingSubmitButton className="secondary-button" pendingLabel="Cancelling...">Cancel</PendingSubmitButton></form>
            </>
          ) : (
            <form action={updateGameNightStatusAction}><input type="hidden" name="gameNightId" value={gameNight.id} /><input type="hidden" name="status" value="ACTIVE" /><PendingSubmitButton className="secondary-button" pendingLabel="Reopening...">Reopen</PendingSubmitButton></form>
          )}
        </section>
      ) : null}

      <section className="surface rounded-lg p-4">
        <div className="flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-teal" />
          <h2 className="text-lg font-bold text-ink">What happens next</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Step number="1" text="Open the workspace that needs your response." />
          <Step number="2" text="Your changes save to this Game Night." />
          <Step number="3" text="Return here to see the group’s progress." />
        </div>
      </section>
    </main>
  );
}

function WorkspaceCard({ icon, eyebrow, title, detail, href, action }: { icon: React.ReactNode; eyebrow: string; title: string; detail: string; href: string; action: string }) {
  return (
    <article className="surface rounded-lg p-5">
      <div className="flex items-center gap-2 text-teal">{icon}<p className="text-sm font-semibold">{eyebrow}</p></div>
      <h2 className="mt-3 text-2xl font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60">{detail}</p>
      <Link href={href} className="primary-button mt-5">{action}<CheckCircle2 className="h-4 w-4" /></Link>
    </article>
  );
}

function MissingWorkspace({ icon, title, href, action }: { icon: React.ReactNode; title: string; href?: string; action: string }) {
  return (
    <article className="rounded-lg border border-dashed border-ink/20 p-5">
      <div className="text-ink/40">{icon}</div>
      <h2 className="mt-3 text-xl font-bold text-ink">{title}</h2>
      {href ? <Link href={href} className="secondary-button mt-5">{action}</Link> : <p className="mt-3 text-sm text-ink/50">The host can add this workspace later.</p>}
    </article>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return <div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal text-sm font-bold text-white">{number}</span><p className="text-sm leading-6 text-ink/60">{text}</p></div>;
}
