import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight, Download, Gamepad2, Search, ShieldCheck, Upload } from "lucide-react";
import { importGamePlayerCountsAction, saveGamePlayerCountAction } from "@/app/admin/games/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireMetadataAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const pageSize = 40;

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
    saved?: string;
    imported?: string;
    skipped?: string;
    error?: string;
  }>;
};

export default async function GameMetadataAdminPage({ searchParams }: PageProps) {
  await requireMetadataAdmin();
  const params = await searchParams;
  const query = params?.q?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number(params?.page) || 1);
  const missingFilter: Prisma.GameWhereInput = {
    userGames: { some: { source: "STEAM" } },
    AND: [
      { OR: [{ minPlayers: null }, { maxPlayers: null }] },
      ...(query
        ? [{
            OR: [
              { title: { contains: query, mode: "insensitive" as const } },
              ...(/^\d+$/.test(query) ? [{ steamAppId: Number(query) }] : []),
            ],
          }]
        : []),
    ],
  };

  const [games, totalMissing] = await Promise.all([
    prisma.game.findMany({
      where: missingFilter,
      select: {
        id: true,
        title: true,
        steamAppId: true,
        minPlayers: true,
        maxPlayers: true,
        capabilitySource: true,
        _count: { select: { userGames: true } },
      },
      orderBy: [{ userGames: { _count: "desc" } }, { title: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.game.count({ where: missingFilter }),
  ]);
  const pageCount = Math.max(1, Math.ceil(totalMissing / pageSize));
  const returnTo = `/admin/games?${new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  }).toString()}`;

  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between gap-3 py-2">
        <Link href="/" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
        <Link href="/account" className="secondary-button">Account</Link>
      </nav>

      <section className="mx-auto grid max-w-5xl gap-4 py-5">
        <header>
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-coral">
            <ShieldCheck className="h-4 w-4" />
            HazzJC admin
          </p>
          <h1 className="mt-2 text-3xl font-black text-ink">Missing player metadata</h1>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-ink/60">
            Steam-imported games missing a minimum or maximum player count. Saved values become trusted database overrides and are preserved during metadata refreshes.
          </p>
        </header>

        {params?.error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{params.error}</p> : null}
        {params?.saved ? <p role="status" className="rounded-lg border border-moss/20 bg-moss/10 p-3 text-sm font-bold text-moss">Player metadata saved. The game has left the missing-data queue.</p> : null}
        {params?.imported ? (
          <p role="status" className="rounded-lg border border-moss/20 bg-moss/10 p-3 text-sm font-bold text-moss">
            Imported {params.imported} game {params.imported === "1" ? "update" : "updates"}.
            {Number(params.skipped) > 0 ? ` Skipped ${params.skipped} incomplete or unknown rows.` : ""}
          </p>
        ) : null}

        <section className="surface grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1fr)]">
          <div>
            <h2 className="text-lg font-black text-ink">Edit in a spreadsheet</h2>
            <p className="mt-1 text-sm font-bold leading-6 text-ink/55">
              Export every missing game, fill in the min_players and max_players columns, then upload the same file. Leave rows untouched to skip them.
            </p>
            <a href="/admin/games/export" className="secondary-button mt-3 w-fit">
              <Download className="h-4 w-4" />
              Export missing games
            </a>
          </div>
          <form action={importGamePlayerCountsAction} className="grid content-start gap-3 rounded-lg border border-ink/10 bg-paper p-3">
            <label>
              <span className="text-sm font-black text-ink">Completed CSV</span>
              <input name="metadata" type="file" required accept=".csv,text/csv" className="mt-2 block w-full text-sm font-bold text-ink" />
            </label>
            <PendingSubmitButton className="primary-button w-fit" pendingLabel="Importing metadata...">
              <Upload className="h-4 w-4" />
              Upload and save
            </PendingSubmitButton>
          </form>
        </section>

        <form className="surface flex flex-col gap-2 p-3 sm:flex-row" action="/admin/games">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search games</span>
            <input name="q" defaultValue={query} className="field mt-0" placeholder="Search title or Steam App ID" />
          </label>
          <button className="secondary-button justify-center" type="submit">
            <Search className="h-4 w-4" />
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-ink/55">
          <p>{totalMissing.toLocaleString("en-GB")} imported games need player data</p>
          <p>Page {Math.min(page, pageCount)} of {pageCount}</p>
        </div>

        <section className="grid gap-2">
          {games.map((game) => (
            <form key={game.id} action={saveGamePlayerCountAction} className="surface grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] md:items-end">
              <input type="hidden" name="gameId" value={game.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="min-w-0">
                <p className="truncate font-black text-ink">{game.title}</p>
                <p className="mt-1 text-xs font-bold text-ink/48">
                  {game.steamAppId ? `Steam ${game.steamAppId}` : "No Steam ID"} · owned by {game._count.userGames} {game._count.userGames === 1 ? "account" : "accounts"}
                </p>
              </div>
              <label>
                <span className="text-xs font-black text-ink/60">Minimum</span>
                <input name="minPlayers" type="number" min={1} max={1000} required defaultValue={game.minPlayers ?? 1} className="field" />
              </label>
              <label>
                <span className="text-xs font-black text-ink/60">Maximum</span>
                <input name="maxPlayers" type="number" min={1} max={1000} required defaultValue={game.maxPlayers ?? 4} className="field" />
              </label>
              <PendingSubmitButton className="primary-button h-11 justify-center" pendingLabel="Saving...">
                Save
              </PendingSubmitButton>
            </form>
          ))}
          {games.length === 0 ? (
            <div className="surface p-6 text-center">
              <p className="font-black text-ink">{query ? "No matching games need metadata." : "The missing player-data queue is empty."}</p>
            </div>
          ) : null}
        </section>

        <nav className="flex items-center justify-between gap-3" aria-label="Metadata pages">
          {page > 1 ? (
            <Link href={pageHref(query, page - 1)} className="secondary-button">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          ) : <span />}
          {page < pageCount ? (
            <Link href={pageHref(query, page + 1)} className="secondary-button">
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </nav>
      </section>
    </main>
  );
}

function pageHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/admin/games?${params.toString()}`;
}
