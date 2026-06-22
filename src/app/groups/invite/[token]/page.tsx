import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import { acceptFriendGroupInviteAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function FriendGroupInvitePage({ params }: PageProps) {
  const { token } = await params;
  const invite = await prisma.friendGroupInvite.findUnique({
    where: { token },
    include: { group: { include: { owner: true } } },
  });

  if (!invite || invite.expiresAt < new Date()) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <main className="ui-shell">
        <InviteShell groupName={invite.group.name} inviterName={invite.group.owner.displayName}>
          <a href={`/auth/google/start?friendGroupInvite=${token}&redirectTo=${encodeURIComponent(`/groups/invite/${token}`)}`} className="primary-button">
            Sign in with Google
          </a>
        </InviteShell>
      </main>
    );
  }

  if (currentUser.id === invite.group.ownerId) {
    redirect(`/groups/${invite.groupId}`);
  }

  return (
    <main className="ui-shell">
      <InviteShell groupName={invite.group.name} inviterName={invite.group.owner.displayName}>
        <form action={acceptFriendGroupInviteAction}>
          <input type="hidden" name="token" value={token} />
          <PendingSubmitButton className="primary-button" pendingLabel="Joining...">
            Join group
          </PendingSubmitButton>
        </form>
      </InviteShell>
    </main>
  );
}

function InviteShell({ groupName, inviterName, children }: { groupName: string; inviterName: string; children: React.ReactNode }) {
  return (
    <section className="surface mx-auto mt-10 max-w-xl rounded-xl p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-teal text-white">
        <UsersRound className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-black uppercase tracking-[0.14em] text-coral">Group invite</p>
      <h1 className="mt-2 text-3xl font-black text-ink">{inviterName} invited you to {groupName}</h1>
      <p className="mt-3 text-sm leading-6 text-ink/62">
        Join this saved group so future Pick sessions can include you across devices.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        {children}
        <Link href="/" className="secondary-button">
          Not now
        </Link>
      </div>
    </section>
  );
}
