import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Search, UserPlus, UsersRound } from "lucide-react";
import {
  blockUserAction,
  cancelFriendRequestAction,
  removeFriendAction,
  respondFriendRequestAction,
  sendFriendRequestAction,
} from "@/app/friends/actions";
import { requireActivePickUser } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function FriendsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const user = await requireActivePickUser("/friends");
  const search = query?.q?.trim().toLocaleLowerCase() ?? "";
  const [friendships, incoming, outgoing, blockedRows] = await Promise.all([
    prisma.userFriend.findMany({
      where: { userId: user.id },
      include: { friend: true },
      orderBy: { friend: { displayName: "asc" } },
    }),
    prisma.friendRequest.findMany({
      where: { recipientId: user.id, status: "PENDING" },
      include: { sender: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { senderId: user.id, status: "PENDING" },
      include: { recipient: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: user.id }, { blockedId: user.id }],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);
  const blockedIds = new Set(
    blockedRows.flatMap((row) => [row.blockerId, row.blockedId]).filter((id) => id !== user.id),
  );
  const friendIds = new Set(friendships.map((friendship) => friendship.friendId));
  const pendingIds = new Set([
    ...incoming.map((request) => request.senderId),
    ...outgoing.map((request) => request.recipientId),
  ]);
  const results =
    search.length >= 2
      ? await prisma.user.findMany({
          where: {
            id: { not: user.id, notIn: [...blockedIds] },
            directoryVisible: true,
            normalizedUsername: { startsWith: search },
          },
          include: {
            games: {
              where: { favourite: true },
              include: { game: { select: { title: true } } },
              take: 3,
              orderBy: [{ rating: "desc" }, { updatedAt: "desc" }],
            },
            _count: {
              select: {
                friendsSent: {
                  where: {
                    friendId: { in: [...friendIds] },
                  },
                },
              },
            },
          },
          orderBy: { normalizedUsername: "asc" },
          take: 20,
        })
      : [];

  return (
    <main className="ui-shell pb-16">
      <nav className="flex items-center justify-between gap-3 py-1.5">
        <Link href="/account" className="secondary-button">
          <ArrowLeft className="h-4 w-4" />
          Account
        </Link>
        <Link href="/groups" className="secondary-button">Groups</Link>
      </nav>

      <header className="mt-5">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Friends</p>
        <h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Find your people</h1>
        <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-ink/62">
          Search by username. Email addresses, SteamIDs, private notes, and full libraries are never shown in search.
        </p>
      </header>

      <form className="surface mt-4 flex gap-2 p-3">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ink/40" />
          <input name="q" minLength={2} defaultValue={search} className="field mt-0 pl-9" placeholder="Search @username" />
        </label>
        <button className="primary-button" type="submit">Search</button>
      </form>

      {search.length >= 2 ? (
        <section className="mt-4">
          <h2 className="text-xl font-black text-ink">Search results</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {results.length ? results.map((result) => (
              <article key={result.id} className="surface flex items-start gap-3 p-4">
                <Avatar name={result.displayName} url={result.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <Link href={`/users/${result.username}`} className="truncate font-black text-ink hover:text-teal">{result.displayName}</Link>
                  <p className="text-sm font-bold text-teal">@{result.username}</p>
                  <p className="mt-1 text-xs font-bold text-ink/45">
                    {result._count.friendsSent} mutual friend{result._count.friendsSent === 1 ? "" : "s"}
                  </p>
                  <p className="mt-2 text-xs font-bold text-ink/52">
                    {Array.isArray(result.favouriteGenres) && result.favouriteGenres.length
                      ? result.favouriteGenres.join(" · ")
                      : "No favourite genres set"}
                  </p>
                  {result.games.length ? (
                    <p className="mt-1 text-xs font-bold text-ink/45">
                      Favourites: {result.games.map((game) => game.game.title).join(", ")}
                    </p>
                  ) : null}
                </div>
                {friendIds.has(result.id) ? (
                  <span className="rounded-full bg-moss/12 px-2 py-1 text-xs font-black text-moss">Friends</span>
                ) : pendingIds.has(result.id) ? (
                  <span className="rounded-full bg-gold/15 px-2 py-1 text-xs font-black text-ink">Pending</span>
                ) : (
                  <form action={sendFriendRequestAction}>
                    <input type="hidden" name="recipientId" value={result.id} />
                    <button type="submit" className="secondary-button px-3 py-2" aria-label={`Add ${result.username}`}>
                      <UserPlus className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </article>
            )) : (
              <p className="surface p-5 text-sm font-bold text-ink/58 md:col-span-2">No visible usernames begin with “{search}”.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="surface p-4">
          <h2 className="text-xl font-black text-ink">Requests</h2>
          <div className="mt-3 grid gap-2">
            {incoming.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 bg-paper p-3">
                <span className="font-black text-ink">@{request.sender.username}</span>
                <div className="flex gap-2">
                  <form action={respondFriendRequestAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="response" value="accept" />
                    <button className="primary-button px-3 py-2">Accept</button>
                  </form>
                  <form action={respondFriendRequestAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="response" value="decline" />
                    <button className="secondary-button px-3 py-2">Decline</button>
                  </form>
                </div>
              </div>
            ))}
            {outgoing.map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-paper p-3">
                <span className="font-black text-ink">@{request.recipient.username} · pending</span>
                <form action={cancelFriendRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button className="secondary-button px-3 py-2">Cancel</button>
                </form>
              </div>
            ))}
            {!incoming.length && !outgoing.length ? <p className="text-sm font-bold text-ink/52">No pending requests.</p> : null}
          </div>
        </div>

        <div className="surface p-4">
          <h2 className="text-xl font-black text-ink">Friends</h2>
          <div className="mt-3 grid gap-2">
            {friendships.map(({ friend }) => (
              <div key={friend.id} className="flex items-center gap-3 rounded-lg border border-ink/10 bg-paper p-3">
                <Avatar name={friend.displayName} url={friend.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <Link href={`/users/${friend.username}`} className="truncate font-black text-ink hover:text-teal">{friend.displayName}</Link>
                  <p className="text-xs font-bold text-teal">@{friend.username}</p>
                </div>
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-md px-2 py-1 font-black text-ink/55">•••</summary>
                  <div className="absolute right-0 top-full z-20 mt-1 grid w-36 gap-1 rounded-lg border border-ink/10 bg-white p-2 shadow-card">
                    <form action={removeFriendAction}>
                      <input type="hidden" name="friendId" value={friend.id} />
                      <button className="w-full px-2 py-1 text-left text-sm font-bold text-ink">Remove</button>
                    </form>
                    <form action={blockUserAction}>
                      <input type="hidden" name="userId" value={friend.id} />
                      <button className="w-full px-2 py-1 text-left text-sm font-bold text-red-800">Block</button>
                    </form>
                  </div>
                </details>
              </div>
            ))}
            {!friendships.length ? (
              <div className="grid place-items-center rounded-lg border border-dashed border-ink/15 p-6 text-center">
                <UsersRound className="h-6 w-6 text-teal" />
                <p className="mt-2 text-sm font-bold text-ink/52">Search for a username or accept an invite.</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  return url ? (
    <Image src={url} alt="" width={42} height={42} className="h-10 w-10 rounded-md object-cover" />
  ) : (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-teal/12 font-black text-teal">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
