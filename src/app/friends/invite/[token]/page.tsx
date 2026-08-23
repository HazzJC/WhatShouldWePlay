import Link from "next/link";
import { notFound } from "next/navigation";
import { Gamepad2, UsersRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acceptFriendInviteAction } from "@/app/friends/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function FriendInvitePage({ params }: PageProps) {
  const { token } = await params;
  const invite = await prisma.friendInvite.findUnique({
    where: { token },
    include: { inviter: true },
  });

  if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <main className="ui-shell">
        <InviteShell inviterName={invite.inviter.displayName}>
          <a href={`/auth/google/start?friendInvite=${token}&redirectTo=${encodeURIComponent(`/friends/invite/${token}`)}`} className="primary-button">
            Sign in with Google
          </a>
          <a href={`/auth/steam/start?friendInvite=${token}`} className="secondary-button">
            <Gamepad2 className="h-4 w-4" />
            Steam instead
          </a>
        </InviteShell>
      </main>
    );
  }

  return (
    <main className="ui-shell">
      <InviteShell inviterName={invite.inviter.displayName}>
        {currentUser.id === invite.inviterId ? (
          <p className="text-sm font-bold text-ink/60">Share this link with someone else.</p>
        ) : (
          <form action={acceptFriendInviteAction}>
            <input type="hidden" name="token" value={token} />
            <PendingSubmitButton className="primary-button" pendingLabel="Accepting...">Accept friend invite</PendingSubmitButton>
          </form>
        )}
      </InviteShell>
    </main>
  );
}

function InviteShell({ inviterName, children }: { inviterName: string; children: React.ReactNode }) {
  return (
    <section className="surface mx-auto mt-10 max-w-xl rounded-xl p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-teal text-white">
        <UsersRound className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-black uppercase tracking-[0.14em] text-coral">Friend invite</p>
      <h1 className="mt-2 text-3xl font-black text-ink">{inviterName} invited you to match games</h1>
      <p className="mt-3 text-sm leading-6 text-ink/62">
        Sign in with Google to save this friend across devices. Steam is still available when you want game-library import.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        {children}
        <Link href="/" className="secondary-button">Not now</Link>
      </div>
    </section>
  );
}
