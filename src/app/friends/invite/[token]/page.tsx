import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Gamepad2, UsersRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function FriendInvitePage({ params }: PageProps) {
  const { token } = await params;
  const invite = await prisma.friendInvite.findUnique({
    where: { token },
    include: { inviter: true },
  });

  if (!invite || invite.expiresAt < new Date()) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <main className="ui-shell">
        <InviteShell inviterName={invite.inviter.displayName}>
          <a href={`/auth/steam/start?friendInvite=${token}`} className="primary-button">
            <Gamepad2 className="h-4 w-4" />
            Sign in with Steam
          </a>
        </InviteShell>
      </main>
    );
  }

  if (currentUser.id !== invite.inviterId) {
    await Promise.all([
      prisma.userFriend.upsert({
        where: { userId_friendId: { userId: invite.inviterId, friendId: currentUser.id } },
        create: { userId: invite.inviterId, friendId: currentUser.id },
        update: {},
      }),
      prisma.userFriend.upsert({
        where: { userId_friendId: { userId: currentUser.id, friendId: invite.inviterId } },
        create: { userId: currentUser.id, friendId: invite.inviterId },
        update: {},
      }),
      prisma.friendInvite.update({
        where: { id: invite.id },
        data: { acceptedById: currentUser.id, acceptedAt: new Date() },
      }),
    ]);
  }

  redirect("/sessions/pick");
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
        Sign in so this friend can be reused across future Pick sessions.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        {children}
        <Link href="/" className="secondary-button">Not now</Link>
      </div>
    </section>
  );
}
