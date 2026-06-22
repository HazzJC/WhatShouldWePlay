import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Gamepad2, Link as LinkIcon, Trash2, UsersRound } from "lucide-react";
import { addFriendToGroupAction, createFriendGroupInviteAction, removeFriendGroupMemberAction, startPickSessionFromFriendGroupAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function FriendGroupPage({ params }: PageProps) {
  const { groupId } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(`/auth/google/start?redirectTo=${encodeURIComponent(`/groups/${groupId}`)}`);
  }

  const group = await prisma.friendGroup.findFirst({
    where: { id: groupId, ownerId: currentUser.id },
    include: {
      members: { include: { user: true }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      invites: { where: { expiresAt: { gt: new Date() }, acceptedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!group) {
    notFound();
  }

  const appUrl = await getAppUrl();
  const inviteUrl = group.invites[0] ? `${appUrl}/groups/invite/${group.invites[0].token}` : null;
  const memberUserIds = new Set(group.members.map((member) => member.userId).filter((userId): userId is string => Boolean(userId)));
  const savedFriends = await prisma.userFriend.findMany({
    where: {
      userId: currentUser.id,
      friendId: { notIn: Array.from(memberUserIds) },
    },
    include: { friend: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between py-2">
        <Link href="/groups" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Saved groups
        </Link>
      </nav>
      <section className="surface mt-6 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">Friend group</p>
            <h1 className="mt-2 text-4xl font-black text-ink">{group.name}</h1>
            <p className="mt-2 text-sm leading-6 text-ink/62">
              Accepted members are added automatically when you start a Pick session from this group.
            </p>
          </div>
          <form action={startPickSessionFromFriendGroupAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="timezone" value="Europe/London" />
            <PendingSubmitButton className="primary-button" pendingLabel="Starting...">Start Pick</PendingSubmitButton>
          </form>
        </div>
        <div className="mt-5 grid gap-3">
          {group.members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/10 bg-paper p-3">
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-teal" />
                <div>
                  <p className="font-black text-ink">{member.user?.displayName ?? member.displayName}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">{member.status.toLowerCase()}</p>
                </div>
              </div>
              <form action={removeFriendGroupMemberAction}>
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="memberId" value={member.id} />
                <PendingSubmitButton className="secondary-button px-3 py-2" pendingLabel="Removing...">
                  <Trash2 className="h-4 w-4" />
                  Remove
                </PendingSubmitButton>
              </form>
            </div>
          ))}
        </div>
        <form action={createFriendGroupInviteAction} className="mt-5">
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="redirectTo" value={`/groups/${group.id}`} />
          <PendingSubmitButton className="secondary-button" pendingLabel="Creating...">
            <LinkIcon className="h-4 w-4" />
            Create group invite
          </PendingSubmitButton>
        </form>
        {inviteUrl ? (
          <div className="mt-3 rounded-lg border border-teal/20 bg-teal/10 p-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Invite link</p>
            <p className="mt-1 break-all text-sm font-bold text-ink">{inviteUrl}</p>
          </div>
        ) : null}
        {savedFriends.length > 0 ? (
          <section className="mt-5 rounded-lg border border-ink/10 bg-paper p-3">
            <h2 className="font-black text-ink">Add saved friends</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {savedFriends.map((friendship) => (
                <form key={friendship.friendId} action={addFriendToGroupAction} className="flex items-center justify-between gap-2 rounded-md border border-ink/10 bg-white p-2">
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="friendId" value={friendship.friendId} />
                  <span className="text-sm font-black text-ink">{friendship.friend.displayName}</span>
                  <PendingSubmitButton className="secondary-button px-3 py-2" pendingLabel="Adding...">Add</PendingSubmitButton>
                </form>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
