import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Gamepad2, Plus, Search, Upload } from "lucide-react";
import {
  addLibraryGameAction,
  importAccountSteamLibraryAction,
  updateLibraryGameAction,
} from "@/app/account/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireActivePickUser } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    ownership?: string;
    imported?: string;
  }>;
};

export default async function AccountLibraryPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const user = await requireActivePickUser("/account/library");
  const search = query?.q?.trim() ?? "";
  const ownership = ["HAVE", "DONT_HAVE", "UNKNOWN"].includes(query?.ownership ?? "")
    ? query!.ownership
    : undefined;
  const games = await prisma.userGame.findMany({
    where: {
      userId: user.id,
      ...(ownership ? { ownership: ownership as "HAVE" | "DONT_HAVE" | "UNKNOWN" } : {}),
      ...(search
        ? {
            game: {
              title: {
                contains: search,
                mode: "insensitive",
              },
            },
          }
        : {}),
    },
    include: {
      game: true,
    },
    orderBy: [
      { favourite: "desc" },
      { recentlyPlayedAt: "desc" },
      { playtimeMinutes: "desc" },
      { game: { title: "asc" } },
    ],
    take: 100,
  });
  const counts = await prisma.userGame.groupBy({
    by: ["ownership"],
    where: { userId: user.id },
    _count: { _all: true },
  });
  const countByOwnership = new Map(counts.map((count) => [count.ownership, count._count._all]));

  return (
    <main className="ui-shell pb-16">
      <nav className="flex flex-wrap items-center justify-between gap-3 py-1.5">
        <Link href="/account" className="secondary-button">
          <ArrowLeft className="h-4 w-4" />
          Account
        </Link>
        <Link href="/sessions/pick" className="primary-button">
          <Gamepad2 className="h-4 w-4" />
          Start Pick
        </Link>
      </nav>

      <header className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Persistent library</p>
          <h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Your games</h1>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-ink/62">
            Update a game once and every future group match can use your ownership, rating, playtime, and interest.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.steamAccount ? (
            <form action={importAccountSteamLibraryAction}>
              <PendingSubmitButton className="primary-button" pendingLabel="Importing library...">
                <Upload className="h-4 w-4" />
                Import Steam
              </PendingSubmitButton>
            </form>
          ) : (
            <a href="/auth/steam/start?redirectTo=%2Faccount%2Flibrary" className="primary-button">
              Connect Steam
            </a>
          )}
        </div>
      </header>

      {query?.imported ? (
        <p className="mt-4 rounded-lg border border-moss/25 bg-moss/10 p-3 text-sm font-black text-moss">
          Imported {query.imported} Steam games into your persistent library.
        </p>
      ) : null}

      <section className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <form className="surface flex min-w-0 flex-wrap gap-2 p-3">
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ink/40" />
            <input name="q" defaultValue={search} className="field mt-0 pl-9" placeholder="Search your games" />
          </label>
          <select name="ownership" defaultValue={ownership ?? ""} className="field mt-0 w-auto">
            <option value="">All statuses</option>
            <option value="HAVE">Have</option>
            <option value="DONT_HAVE">Don&apos;t have</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
          <button className="secondary-button" type="submit">Filter</button>
        </form>
        <div className="surface flex items-center gap-4 px-4 py-3 text-sm font-black text-ink/62">
          <span>{countByOwnership.get("HAVE") ?? 0} have</span>
          <span>{countByOwnership.get("DONT_HAVE") ?? 0} don&apos;t</span>
          <span>{countByOwnership.get("UNKNOWN") ?? 0} unknown</span>
        </div>
      </section>

      <details className="surface mt-3 p-4">
        <summary className="cursor-pointer font-black text-ink">Add a non-Steam game</summary>
        <form action={addLibraryGameAction} className="mt-3 flex flex-wrap gap-2">
          <input name="title" required maxLength={180} className="field mt-0 min-w-[220px] flex-1" placeholder="Game title" />
          <button type="submit" className="secondary-button">
            <Plus className="h-4 w-4" />
            Add as Have
          </button>
        </form>
      </details>

      <section className="mt-4 grid gap-3">
        {games.length > 0 ? (
          games.map((userGame) => (
            <form key={userGame.id} action={updateLibraryGameAction} className="surface grid gap-4 p-4 xl:grid-cols-[minmax(220px,1fr)_160px_110px_170px_170px] xl:items-end">
              <input type="hidden" name="gameId" value={userGame.gameId} />
              <div className="flex min-w-0 gap-3">
                {userGame.game.coverUrl ? (
                  <Image src={userGame.game.coverUrl} alt="" width={54} height={72} className="h-[72px] w-[54px] rounded-md object-cover" />
                ) : (
                  <span className="grid h-[72px] w-[54px] shrink-0 place-items-center rounded-md bg-ink/8 text-teal">
                    <Gamepad2 className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-ink">{userGame.game.title}</h2>
                  <p className="mt-1 text-xs font-bold text-ink/48">
                    {formatPlaytime(userGame.playtimeMinutes)}
                    {userGame.recentlyPlayedAt ? ` · played ${userGame.recentlyPlayedAt.toLocaleDateString("en-GB")}` : ""}
                  </p>
                  <textarea name="notes" maxLength={1000} defaultValue={userGame.notes ?? ""} className="field mt-2 min-h-10 py-2 text-sm" placeholder="Private note" />
                </div>
              </div>
              <label>
                <span className="text-xs font-black uppercase text-ink/48">Ownership</span>
                <select name="ownership" defaultValue={userGame.ownership} className="field">
                  <option value="HAVE">Have</option>
                  <option value="DONT_HAVE">Don&apos;t have</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </label>
              <label>
                <span className="text-xs font-black uppercase text-ink/48">Rating</span>
                <select name="rating" defaultValue={userGame.rating ?? ""} className="field">
                  <option value="">—</option>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
                    <option key={rating} value={rating}>{rating}/10</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-xs font-black uppercase text-ink/48">Interest</span>
                <select name="interest" defaultValue={userGame.interest} className="field">
                  <option value="WANT_TO_PLAY">Want to play</option>
                  <option value="NEUTRAL">Neutral</option>
                  <option value="NOT_INTERESTED">Not interested</option>
                </select>
              </label>
              <div className="grid gap-2">
                <select name="playedStatus" defaultValue={userGame.playedStatus} className="field mt-0">
                  <option value="UNPLAYED">Unplayed</option>
                  <option value="PLAYING">Playing</option>
                  <option value="PLAYED">Played</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DROPPED">Dropped</option>
                </select>
                <div className="flex flex-wrap gap-3 text-xs font-bold text-ink">
                  <label><input type="checkbox" name="wishlist" defaultChecked={userGame.wishlist} /> Wishlist</label>
                  <label><input type="checkbox" name="favourite" defaultChecked={userGame.favourite} /> Favourite</label>
                </div>
                <button type="submit" className="secondary-button justify-center">Save</button>
              </div>
            </form>
          ))
        ) : (
          <div className="surface p-7 text-center">
            <h2 className="text-xl font-black text-ink">No games match this view</h2>
            <p className="mt-2 text-sm font-bold text-ink/58">Import Steam or add a game manually to begin your reusable profile.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function formatPlaytime(minutes?: number | null) {
  if (!minutes) {
    return "No imported playtime";
  }

  return `${Math.round(minutes / 60).toLocaleString()}h played`;
}
