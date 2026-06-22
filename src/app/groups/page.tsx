import Link from "next/link";
import { redirect } from "next/navigation";
import { Gamepad2, UsersRound } from "lucide-react";
import { startPickSessionFromFriendGroupAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function GroupsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(`/auth/google/start?redirectTo=${encodeURIComponent("/groups")}`);
  }

  const groups = await prisma.friendGroup.findMany({
    where: { ownerId: currentUser.id },
    include: { members: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
      </nav>
      <header className="py-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">Friends</p>
        <h1 className="mt-2 text-4xl font-black text-ink">Saved groups</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
          Reuse the same crew across Pick sessions and invite missing players with one link.
        </p>
      </header>
      <section className="grid gap-3 md:grid-cols-2">
        {groups.length > 0 ? (
          groups.map((group) => (
            <article key={group.id} className="surface rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-ink">{group.name}</h2>
                  <p className="mt-1 text-sm font-bold text-ink/55">
                    {group.members.length} member{group.members.length === 1 ? "" : "s"}
                  </p>
                </div>
                <UsersRound className="h-5 w-5 text-teal" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/groups/${group.id}`} className="secondary-button">Manage</Link>
                <form action={startPickSessionFromFriendGroupAction}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="timezone" value="Europe/London" />
                  <PendingSubmitButton className="primary-button" pendingLabel="Starting...">
                    Start Pick
                  </PendingSubmitButton>
                </form>
              </div>
            </article>
          ))
        ) : (
          <div className="surface rounded-xl p-5 md:col-span-2">
            <h2 className="text-xl font-black text-ink">No saved groups yet</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">
              Open a Pick session and use Save this group to turn the current session players into a reusable crew.
            </p>
            <Link href="/sessions/pick" className="primary-button mt-4">Start Pick</Link>
          </div>
        )}
      </section>
    </main>
  );
}
