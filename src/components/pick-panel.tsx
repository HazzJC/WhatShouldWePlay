import type { Game, SessionGame, SessionGameSignal, SteamAccount, User } from "@prisma/client";
import { Gamepad2, LogOut, Plus, Search, Sparkles, TrendingUp } from "lucide-react";
import {
  addSessionGameAction,
  importSteamLibraryAction,
  markGameAvailableAction,
  removeSessionGameAction,
} from "@/app/actions";
import type { GameInput } from "@/lib/games";

type SessionGameView = SessionGame & {
  game: Game;
  signals: SessionGameSignal[];
};

type UserWithSteam =
  | (User & {
      steamAccount: SteamAccount | null;
    })
  | null;

export function PickPanel({
  shareToken,
  participantId,
  currentUser,
  sessionGames,
  searchResults,
  popularGames,
  trendingGames,
  commonGames,
  searchQuery,
}: {
  shareToken: string;
  participantId?: string;
  currentUser: UserWithSteam;
  sessionGames: SessionGameView[];
  searchResults: GameInput[];
  popularGames: GameInput[];
  trendingGames: GameInput[];
  commonGames: GameInput[];
  searchQuery: string;
}) {
  const steamAccount = currentUser?.steamAccount;
  const importStatus = steamAccount?.lastImportStatus ?? null;
  const importMessage = importStatus ? steamImportMessage(importStatus) : null;

  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-5">
        <section className="surface rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">Pick</p>
              <h2 className="mt-1 text-3xl font-black text-ink">Choose what to play</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/62">
                Match owned games, add non-Steam options, and keep everything in one shared shortlist.
              </p>
            </div>
            {currentUser ? (
              <form action="/auth/logout" method="post">
                <input type="hidden" name="redirectTo" value={`/s/${shareToken}?tab=pick${participantId ? `&participant=${participantId}` : ""}`} />
                <button className="secondary-button" type="submit">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            ) : null}
          </div>

          <div className="mt-5 rounded-xl border border-ink/10 bg-paper p-4">
            {steamAccount ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-black text-ink">Steam connected</p>
                  <p className="mt-1 text-sm leading-6 text-ink/62">
                    {steamAccount.lastImportAt
                      ? `Last imported ${steamAccount.lastImportAt.toLocaleDateString()}`
                      : "Import your library to find games this group already owns."}
                  </p>
                  {importMessage ? (
                    <p className={`mt-2 rounded-md px-3 py-2 text-sm font-bold ${importMessage.className}`}>
                      {importMessage.text}
                    </p>
                  ) : null}
                </div>
                <form action={importSteamLibraryAction}>
                  <input type="hidden" name="shareToken" value={shareToken} />
                  {participantId ? <input type="hidden" name="participantId" value={participantId} /> : null}
                  <button className="primary-button">Import Steam library</button>
                </form>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-black text-ink">Connect Steam</p>
                  <p className="mt-1 text-sm leading-6 text-ink/62">
                    Steam import is optional. You can still add games manually without signing in.
                  </p>
                </div>
                <a href={`/auth/steam/start?shareToken=${shareToken}${participantId ? `&participant=${participantId}` : ""}`} className="primary-button">
                  Connect Steam
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="surface rounded-xl p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.14em] text-moss">Group match</p>
              <h2 className="mt-1 text-2xl font-black text-ink">Best shared options</h2>
            </div>
            <p className="text-sm font-bold text-ink/60">Owned games first</p>
          </div>
          <div className="mt-4 grid gap-3">
            {sessionGames.length > 0 ? (
              sessionGames.map((sessionGame) => (
                <SessionGameCard key={sessionGame.id} shareToken={shareToken} participantId={participantId} sessionGame={sessionGame} />
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-ink/20 bg-paper p-4 text-sm leading-6 text-ink/62">
                No games added yet. Search, import Steam, or start with a common multiplayer pick.
              </p>
            )}
          </div>
        </section>

        <section className="surface rounded-xl p-5">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-coral">Add games</p>
          <h2 className="mt-1 text-2xl font-black text-ink">Search by title</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" action={`/s/${shareToken}`}>
            <input type="hidden" name="tab" value="pick" />
            {participantId ? <input type="hidden" name="participant" value={participantId} /> : null}
            <input name="gameSearch" defaultValue={searchQuery} placeholder="Search games..." className="field mt-0" />
            <button className="primary-button" type="submit">
              <Search className="h-4 w-4" />
              Search
            </button>
          </form>
          <GameGrid shareToken={shareToken} participantId={participantId} games={searchResults} source="IGDB_SEARCH" empty={searchQuery ? "No IGDB results found. You can add it manually below." : "Search IGDB for Steam and non-Steam games."} />
          <ManualAddForm shareToken={shareToken} participantId={participantId} />
        </section>
      </div>

      <aside className="grid content-start gap-5">
        <DiscoveryPanel title="Trending" icon={<TrendingUp className="h-5 w-5" />} shareToken={shareToken} participantId={participantId} games={trendingGames} source="TRENDING" />
        <DiscoveryPanel title="Popular" icon={<Sparkles className="h-5 w-5" />} shareToken={shareToken} participantId={participantId} games={popularGames} source="POPULAR" />
        <DiscoveryPanel title="Common multiplayer" icon={<Gamepad2 className="h-5 w-5" />} shareToken={shareToken} participantId={participantId} games={commonGames} source="COMMON" />
      </aside>
    </section>
  );
}

function steamImportMessage(status: string) {
  if (status.startsWith("imported:")) {
    const count = status.split(":")[1] ?? "some";
    return {
      className: "bg-moss/10 text-moss",
      text: `Imported ${count} Steam game${count === "1" ? "" : "s"}.`,
    };
  }

  const messages: Record<string, string> = {
    missing_key:
      "Steam import is not configured yet: STEAM_WEB_API_KEY is missing on the server.",
    private_or_empty:
      "Steam returned no visible games. This is usually because your Steam game details are private, or the account has no visible library.",
    network_error:
      "Steam import could not reach Steam. Check your network/server connectivity and try again.",
    malformed_response:
      "Steam replied, but the response was not in the format we expected. Try again in a moment.",
    http_401:
      "Steam rejected the API request. The Steam API key may be invalid.",
    http_403:
      "Steam refused the API request. Check the Steam API key and whether the requested profile/library is visible.",
    http_429:
      "Steam rate-limited the import request. Wait a little while and try again.",
    http_500:
      "Steam returned a server error. Try again in a moment.",
    http_502:
      "Steam returned a gateway error. Try again in a moment.",
    http_503:
      "Steam is temporarily unavailable. Try again in a moment.",
    http_504:
      "Steam timed out. Try again in a moment.",
  };

  return {
    className: "bg-red-50 text-red-800",
    text:
      messages[status] ??
      `Steam import failed with status "${status}". We could not import your full library. You can still add games manually.`,
  };
}

function SessionGameCard({
  shareToken,
  participantId,
  sessionGame,
}: {
  shareToken: string;
  participantId?: string;
  sessionGame: SessionGameView;
}) {
  const ownedCount = sessionGame.signals.filter((signal) => signal.signal === "OWNED").length;
  const availableCount = sessionGame.signals.filter((signal) => signal.signal === "AVAILABLE_TO_PLAY").length;
  const outCount = sessionGame.signals.filter((signal) => signal.signal === "NOT_AVAILABLE").length;

  return (
    <div className="rounded-lg border border-ink/10 bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-ink">{sessionGame.game.title}</p>
          <p className="mt-1 text-sm text-ink/60">
            {ownedCount} owned, {availableCount} added, {outCount} not available
          </p>
        </div>
        <form action={removeSessionGameAction}>
          <input type="hidden" name="shareToken" value={shareToken} />
          <input type="hidden" name="sessionGameId" value={sessionGame.id} />
          <button className="secondary-button px-3 py-2" type="submit">Remove</button>
        </form>
      </div>
      {participantId ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["OWNED", "I own this"],
            ["AVAILABLE_TO_PLAY", "Can play"],
            ["NOT_AVAILABLE", "Not available"],
          ].map(([signal, label]) => (
            <form key={signal} action={markGameAvailableAction}>
              <input type="hidden" name="shareToken" value={shareToken} />
              <input type="hidden" name="sessionGameId" value={sessionGame.id} />
              <input type="hidden" name="participantId" value={participantId} />
              <input type="hidden" name="signal" value={signal} />
              <button className="secondary-button w-full px-3 py-2" type="submit">{label}</button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ManualAddForm({ shareToken, participantId }: { shareToken: string; participantId?: string }) {
  return (
    <form action={addSessionGameAction} className="mt-4 grid gap-3 rounded-lg border border-ink/10 bg-paper p-3 sm:grid-cols-[1fr_auto]">
      <input type="hidden" name="shareToken" value={shareToken} />
      <input type="hidden" name="source" value="MANUAL" />
      {participantId ? <input type="hidden" name="participantId" value={participantId} /> : null}
      <input name="title" required placeholder="Add a game manually..." className="field mt-0" />
      <button className="primary-button" type="submit">
        <Plus className="h-4 w-4" />
        Add
      </button>
    </form>
  );
}

function DiscoveryPanel({
  title,
  icon,
  shareToken,
  participantId,
  games,
  source,
}: {
  title: string;
  icon: React.ReactNode;
  shareToken: string;
  participantId?: string;
  games: GameInput[];
  source: "POPULAR" | "TRENDING" | "COMMON";
}) {
  return (
    <section className="surface rounded-xl p-5">
      <div className="flex items-center gap-2 text-teal">
        {icon}
        <h2 className="text-xl font-black text-ink">{title}</h2>
      </div>
      <GameGrid shareToken={shareToken} participantId={participantId} games={games} source={source} empty="Add a manual game or configure IGDB credentials for live suggestions." compact />
    </section>
  );
}

function GameGrid({
  shareToken,
  participantId,
  games,
  source,
  empty,
  compact = false,
}: {
  shareToken: string;
  participantId?: string;
  games: GameInput[];
  source: "IGDB_SEARCH" | "POPULAR" | "TRENDING" | "COMMON";
  empty: string;
  compact?: boolean;
}) {
  if (games.length === 0) {
    return <p className="mt-4 rounded-lg border border-dashed border-ink/20 bg-paper p-4 text-sm leading-6 text-ink/62">{empty}</p>;
  }

  return (
    <div className={`mt-4 grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
      {games.map((game) => (
        <form key={`${source}-${game.igdbId ?? game.steamAppId ?? game.title}`} action={addSessionGameAction} className="rounded-lg border border-ink/10 bg-paper p-3">
          <input type="hidden" name="shareToken" value={shareToken} />
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="title" value={game.title} />
          {participantId ? <input type="hidden" name="participantId" value={participantId} /> : null}
          {game.igdbId ? <input type="hidden" name="igdbId" value={game.igdbId} /> : null}
          {game.steamAppId ? <input type="hidden" name="steamAppId" value={game.steamAppId} /> : null}
          {game.coverUrl ? <input type="hidden" name="coverUrl" value={game.coverUrl} /> : null}
          {game.summary ? <input type="hidden" name="summary" value={game.summary} /> : null}
          {game.popularityScore ? <input type="hidden" name="popularityScore" value={game.popularityScore} /> : null}
          <p className="font-black text-ink">{game.title}</p>
          {game.platforms?.length ? <p className="mt-1 text-xs font-bold text-ink/50">{game.platforms.slice(0, 3).join(", ")}</p> : null}
          <button className="secondary-button mt-3 w-full px-3 py-2" type="submit">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
      ))}
    </div>
  );
}
