import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Gamepad2, LockKeyhole } from "lucide-react";
import { notFound } from "next/navigation";
import { requireActivePickUser } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ username: string }>;
};

export default async function UserGamingProfilePage({ params }: PageProps) {
  const { username } = await params;
  const currentUser = await requireActivePickUser(`/users/${encodeURIComponent(username)}`);
  const profile = await prisma.user.findUnique({
    where: { normalizedUsername: username.toLocaleLowerCase() },
  });

  if (!profile?.username) {
    notFound();
  }

  const isSelf = profile.id === currentUser.id;
  const friendship = isSelf
    ? true
    : Boolean(
        await prisma.userFriend.findUnique({
          where: {
            userId_friendId: {
              userId: currentUser.id,
              friendId: profile.id,
            },
          },
        }),
      );

  if (!profile.directoryVisible && !friendship) {
    notFound();
  }

  const games = await prisma.userGame.findMany({
    where: {
      userId: profile.id,
      ...(friendship ? {} : { favourite: true }),
    },
    include: { game: true },
    orderBy: [
      { favourite: "desc" },
      { rating: "desc" },
      { playtimeMinutes: "desc" },
      { game: { title: "asc" } },
    ],
    take: friendship ? 100 : 6,
  });

  return (
    <main className="ui-shell pb-16">
      <nav className="flex items-center justify-between gap-3 py-1.5">
        <Link href="/friends" className="secondary-button">
          <ArrowLeft className="h-4 w-4" />
          Friends
        </Link>
        {isSelf ? <Link href="/account/library" className="primary-button">Edit library</Link> : null}
      </nav>

      <header className="surface mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {profile.avatarUrl ? (
          <Image src={profile.avatarUrl} alt="" width={80} height={80} className="h-20 w-20 rounded-lg object-cover" />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-lg bg-teal/12 text-3xl font-black text-teal">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-coral">Gaming profile</p>
          <h1 className="mt-1 truncate text-3xl font-black text-ink">{profile.displayName}</h1>
          <p className="font-bold text-teal">@{profile.username}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.isArray(profile.favouriteGenres)
              ? profile.favouriteGenres.map((genre) => (
                  <span key={String(genre)} className="rounded-md bg-paper px-2 py-1 text-xs font-black text-ink/62">{String(genre)}</span>
                ))
              : null}
          </div>
        </div>
      </header>

      <section className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-ink">{friendship ? "Game library" : "Favourite games"}</h2>
            <p className="mt-1 text-sm font-bold text-ink/52">
              {friendship ? "Shared with accepted friends only." : "Full ownership and ratings stay private until you become friends."}
            </p>
          </div>
          {!friendship ? <LockKeyhole className="h-5 w-5 text-ink/35" /> : null}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((userGame) => (
            <article key={userGame.id} className="surface flex gap-3 p-4">
              {userGame.game.coverUrl ? (
                <Image src={userGame.game.coverUrl} alt="" width={48} height={64} className="h-16 w-12 rounded-md object-cover" />
              ) : (
                <span className="grid h-16 w-12 shrink-0 place-items-center rounded-md bg-ink/8 text-teal">
                  <Gamepad2 className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <h3 className="line-clamp-2 font-black text-ink">{userGame.game.title}</h3>
                <p className="mt-1 text-xs font-bold text-ink/48">
                  {userGame.ownership === "HAVE" ? "Has it" : userGame.ownership === "DONT_HAVE" ? "Doesn't have it" : "Unknown"}
                  {userGame.rating ? ` · ${userGame.rating}/10` : ""}
                </p>
                {userGame.playtimeMinutes ? (
                  <p className="mt-1 text-xs font-bold text-ink/48">{Math.round(userGame.playtimeMinutes / 60).toLocaleString()}h played</p>
                ) : null}
              </div>
            </article>
          ))}
          {!games.length ? (
            <p className="surface p-5 text-sm font-bold text-ink/52 sm:col-span-2 lg:col-span-3">
              No games are visible on this profile yet.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
