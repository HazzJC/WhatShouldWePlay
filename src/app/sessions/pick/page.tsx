import Link from "next/link";
import { ArrowLeft, Gamepad2, ListChecks, Sparkles, UsersRound } from "lucide-react";
import { createPickSessionAction, startPickSessionFromFriendGroupAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TimezoneInput } from "@/components/timezone-input";
import { requireActivePickUser } from "@/lib/accounts";
import { getCuratedGame } from "@/lib/curated-games";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<{ game?: string; gameNight?: string }>;
};

export default async function NewPickSessionPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const initialGame = query?.game ? getCuratedGame(query.game) : null;
  const returnParams = new URLSearchParams();
  if (query?.game) returnParams.set("game", query.game);
  if (query?.gameNight) returnParams.set("gameNight", query.gameNight);
  const returnTo = `/sessions/pick${returnParams.size ? `?${returnParams.toString()}` : ""}`;
  const currentUser = await requireActivePickUser(returnTo);
  const friendGroups = await prisma.friendGroup.findMany({
    where: { ownerId: currentUser.id },
    include: { members: { select: { id: true } } },
    orderBy: { updatedAt: "desc" },
    take: 4,
  });

  return (
    <main className="ui-shell pb-24 sm:pb-8">
      <Link href="/" className="secondary-button px-3 py-2">
        <ArrowLeft className="h-4 w-4" />
        Let&apos;s Play Games
      </Link>

      <section className="mt-4 grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="quest-map overflow-hidden rounded-3xl p-6 shadow-soft lg:sticky lg:top-24 lg:self-start">
          <span className="sticker !border-white/15 !bg-white/10 !text-white/75"><Sparkles className="mr-1 h-3 w-3" />The decision room</span>
          <h1 className="mt-5 text-4xl font-black leading-tight text-white">Right. What are we playing?</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-white/62">
            Put everyone&apos;s libraries in one room, rule out the awkward fits, and get to a shortlist that makes sense.
          </p>
          <div className="mt-6 grid gap-3 text-sm font-bold text-white/75">
            <Step number="1" icon={<UsersRound className="h-4 w-4" />} label="Bring the crew" />
            <Step number="2" icon={<Gamepad2 className="h-4 w-4" />} label="Pull in the games" />
            <Step number="3" icon={<ListChecks className="h-4 w-4" />} label="Pick without the debate" />
          </div>
        </aside>

        <div className="grid gap-4">
        <form action={createPickSessionAction} className="choice-card p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="step-badge" style={{ background: "rgb(var(--color-coral))" }}><Gamepad2 className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[0.16em] text-coral">Start fresh</p><h2 className="mt-1 text-2xl font-black text-ink">Make a new shortlist</h2><p className="mt-1 text-sm font-bold leading-6 text-ink/52">Best for a new mix of people or a one-off night.</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-bold text-ink">Group name</span>
              <input name="title" required minLength={2} maxLength={120} defaultValue="Game night picks" className="field" />
            </label>
            <label>
              <span className="text-sm font-bold text-ink">Your name</span>
              <input name="hostName" required maxLength={80} defaultValue={currentUser.displayName} className="field" />
            </label>
            <div className="sm:col-span-2">
            <TimezoneInput defaultTimezone={currentUser.timezone ?? "Europe/London"} />
            </div>
            {query?.gameNight ? <input type="hidden" name="gameNightId" value={query.gameNight} /> : null}
            {initialGame ? <input type="hidden" name="initialGameSlug" value={initialGame.slug} /> : null}
            {initialGame ? (
              <div className="rounded-lg border border-teal/20 bg-teal/10 p-4">
                <p className="text-sm font-black text-ink">Starting shortlist with {initialGame.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink/65">
                  This game will be added automatically so the group can mark who has it.
                </p>
              </div>
            ) : null}
            <div className="rounded-xl border border-purple/20 bg-linen p-4 text-sm font-bold leading-6 text-ink/58 sm:col-span-2">
              This starts with games. Add scheduling later if the group needs it.
            </div>
            <PendingSubmitButton className="primary-button w-full py-3 text-base sm:col-span-2 sm:w-fit" pendingLabel="Creating...">
              <Gamepad2 className="h-5 w-5" />
              Open the decision room
            </PendingSubmitButton>
          </div>
        </form>

        <section className="choice-card p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="step-badge" style={{ background: "rgb(var(--color-teal))" }}><UsersRound className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[0.16em] text-teal">Your usual suspects</p><h2 className="mt-1 text-2xl font-black text-ink">Reuse a saved crew</h2><p className="mt-1 text-sm font-bold leading-6 text-ink/52">Skip the invites and bring the same people back in.</p></div></div>
            <div className="mt-4 grid gap-3">
              {friendGroups.length > 0 ? (
                friendGroups.map((group) => (
                  <div key={group.id} className="interactive-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-paper p-3">
                    <div>
                      <p className="font-black text-ink">{group.name}</p>
                      <p className="mt-1 text-xs font-bold text-ink/50">{group.members.length} member{group.members.length === 1 ? "" : "s"}</p>
                    </div>
                    <form action={startPickSessionFromFriendGroupAction}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <TimezoneInput defaultTimezone={currentUser.timezone ?? "Europe/London"} />
                      <PendingSubmitButton className="secondary-button px-3 py-2" pendingLabel="Starting...">
                        Start Pick
                      </PendingSubmitButton>
                    </form>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-ink/20 bg-paper p-4 text-sm leading-6 text-ink/62">
                  Save a crew from any Pick session to reuse it here.
                </p>
              )}
            </div>
        </section>
        </div>
      </section>
    </main>
  );
}

function Step({ number, icon, label }: { number: string; icon: React.ReactNode; label: string }) {
  return (
    <div className="quest-step flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-teal">{icon}</span>
      <span><span className="mr-2 text-white/35">{number}.</span>{label}</span>
    </div>
  );
}
