import type { Game, GameDeal, GameInterestSignal, Participant, ParticipantPreference, PriceAlertEvent, SessionGame, SessionGameInterest, SessionGameSignal, SteamAccount, SteamStorePrice, User, UserPreference } from "@prisma/client";
import { Bell, Check, Gamepad2, Heart, Link as LinkIcon, LogOut, Plus, Search, Sparkles, TrendingUp, UsersRound, X } from "lucide-react";
import {
  addSessionGameAction,
  createFriendInviteAction,
  createPriceAlertRuleAction,
  importSteamLibraryAction,
  markGameInterestAction,
  markGameAvailableAction,
  removeSessionGameAction,
  updateDealSettingsAction,
  updatePreferenceAction,
  updateQuickPreferenceAction,
} from "@/app/actions";
import { countDontHaveSignals, countHaveSignals, signalMeansHave, type GameInput } from "@/lib/games";
import type { GroupBuyFilters, GroupBuyRecommendation } from "@/lib/group-buy";
import { formatMinorPrice } from "@/lib/itad";
import { isBarelyPlayedGroupPick, isHeavilyPlayedGroupPick, scoreModeLabels, type MatchCategory, type ScoredGame, type ScoreMode } from "@/lib/match-scoring";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { SteamImportSubmitButton } from "@/components/steam-import-submit-button";

type SessionGameView = SessionGame & {
  game: Game & { steamStorePrice?: SteamStorePrice | null; deal?: GameDeal | null };
  signals: SessionGameSignal[];
  interests: SessionGameInterest[];
};

type ParticipantView = Participant & {
  preference: ParticipantPreference | null;
  user: (User & { preference: UserPreference | null; steamAccount?: SteamAccount | null }) | null;
};

type UserWithSteam =
  | (User & {
      steamAccount: SteamAccount | null;
      preference: UserPreference | null;
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
  currentParticipantHasPickSignals,
  participants,
  selectedParticipantIds,
  selectedPlayerCount,
  scoreMode,
  scoredGames,
  dealCountry,
  dealCurrency,
  priceAlertEvents,
  groupBuyFilters,
  groupBuyRecommendations,
  dealLookupConfigured,
  friendInviteUrl,
  savedFriends,
  libraryConnectionSummary,
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
  currentParticipantHasPickSignals: boolean;
  participants: ParticipantView[];
  selectedParticipantIds: string[];
  selectedPlayerCount: number;
  scoreMode: ScoreMode;
  scoredGames: ScoredGame[];
  dealCountry: string;
  dealCurrency: string;
  priceAlertEvents: PriceAlertEvent[];
  groupBuyFilters: GroupBuyFilters;
  groupBuyRecommendations: GroupBuyRecommendation[];
  dealLookupConfigured: boolean;
  friendInviteUrl: string | null;
  savedFriends: User[];
  libraryConnectionSummary: { connected: number; total: number };
}) {
  const steamAccount = currentUser?.steamAccount;
  const importStatus = steamAccount?.lastImportStatus ?? null;
  const importMessage = importStatus ? steamImportMessage(importStatus) : null;
  const showFullGroupList = Boolean(participantId && currentParticipantHasPickSignals);
  const reviewTitle = showFullGroupList ? "Best shared options" : "Review games already added";
  const reviewEyebrow = showFullGroupList ? "Group match" : "Start here";

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
                  <p className="mt-1 text-xs font-bold leading-5 text-ink/45">
                    We import ownership, playtime, and recent-played signals. Large libraries can take a little while.
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
                  <SteamImportSubmitButton />
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
          <LibraryConnectionNotice summary={libraryConnectionSummary} />
        </section>

        <nav aria-label="Pick workspace" className="grid gap-2 rounded-xl border border-ink/10 bg-white/75 p-2 shadow-sm sm:grid-cols-4">
          {[
            ["#match", "Match", "Best options"],
            ["#review-games", "My games", "Have / don't have"],
            ["#add-games", "Add games", "Search and suggestions"],
            ["#pick-tools", "Tools", "Deals and preferences"],
          ].map(([href, label, description]) => (
            <a key={href} href={href} className="focus-ring rounded-lg px-3 py-2 text-sm font-black text-ink/70 transition hover:bg-paper hover:text-ink">
              <span className="block">{label}</span>
              <span className="mt-0.5 block text-xs font-bold text-ink/45">{description}</span>
            </a>
          ))}
        </nav>

        <MatchDashboard
          id="match"
          shareToken={shareToken}
          participantId={participantId}
          participants={participants}
          selectedParticipantIds={selectedParticipantIds}
          selectedPlayerCount={selectedPlayerCount}
          scoreMode={scoreMode}
          scoredGames={scoredGames}
        />

        <section id="pick-tools" className="surface rounded-xl p-5">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-coral">Tools</p>
          <h2 className="mt-1 text-2xl font-black text-ink">Deals, friends, and preferences</h2>
          <div className="mt-4 grid gap-3">
            <details className="rounded-lg border border-ink/10 bg-paper p-4">
              <summary className="cursor-pointer list-none font-black text-ink">Price alerts and reusable friends</summary>
              <div className="mt-4">
                <DealAndFriendsPanel
                  shareToken={shareToken}
                  participantId={participantId}
                  currentUser={currentUser}
                  dealCountry={dealCountry}
                  dealCurrency={dealCurrency}
                  priceAlertEvents={priceAlertEvents}
                  friendInviteUrl={friendInviteUrl}
                  savedFriends={savedFriends}
                  dealLookupConfigured={dealLookupConfigured}
                />
              </div>
            </details>
            <details className="rounded-lg border border-ink/10 bg-paper p-4">
              <summary className="cursor-pointer list-none font-black text-ink">All buy a new game</summary>
              <div className="mt-4">
                <GroupBuyPanel
                  shareToken={shareToken}
                  participantId={participantId}
                  filters={groupBuyFilters}
                  recommendations={groupBuyRecommendations}
                  currency={dealCurrency}
                  dealLookupConfigured={dealLookupConfigured}
                />
              </div>
            </details>
            <PreferencePanel
              shareToken={shareToken}
              participantId={participantId}
              currentUser={currentUser}
              currentParticipant={participants.find((participant) => participant.id === participantId)}
              hasPickSignals={currentParticipantHasPickSignals}
            />
          </div>
        </section>

        <section id="review-games" className="surface rounded-xl p-5 scroll-mt-5">
          {!showFullGroupList && participantId ? (
            <div className="mb-4 rounded-lg border border-teal/20 bg-teal/10 p-4">
              <p className="font-black text-ink">Import or mark what you have</p>
              <p className="mt-1 text-sm leading-6 text-ink/62">
                Connect Steam for the fastest match, or open the review list and mark the games you have.
              </p>
            </div>
          ) : null}

          <details open={showFullGroupList} className="group" data-testid="session-games-review">
            <summary className="flex cursor-pointer list-none flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-moss">{reviewEyebrow}</p>
                <h2 className="mt-1 text-2xl font-black text-ink">{reviewTitle}</h2>
              </div>
              <p className="text-sm font-bold text-ink/60">
                {showFullGroupList ? "Owned games first" : "Open to mark Have / Don't have"}
              </p>
            </summary>
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
          </details>
        </section>

        <section id="add-games" className="surface rounded-xl p-5 scroll-mt-5">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-coral">Add games</p>
          <h2 className="mt-1 text-2xl font-black text-ink">Search by title</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" action={`/s/${shareToken}`}>
            <input type="hidden" name="tab" value="pick" />
            {participantId ? <input type="hidden" name="participant" value={participantId} /> : null}
            <input name="gameSearch" defaultValue={searchQuery} placeholder="Search games..." className="field mt-0" />
            <PendingSubmitButton className="primary-button" pendingLabel="Searching...">
              <Search className="h-4 w-4" />
              Search
            </PendingSubmitButton>
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

  if (status.includes("_imported:")) {
    const count = status.split(":")[1] ?? "some";
    return {
      className: "bg-moss/10 text-moss",
      text: `Imported ${count} Steam game${count === "1" ? "" : "s"} from your public Steam profile.`,
    };
  }

  const messages: Record<string, string> = {
    missing_key:
      "Steam import isn't available right now. You can still add games manually.",
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
    http_401_xml_private_or_empty:
      "Steam rejected the API key, and your public Steam profile did not expose a visible game library. Check the key and Steam privacy settings.",
    http_403_xml_private_or_empty:
      "Steam refused the API request, and your public Steam profile did not expose a visible game library. Check the key and Steam privacy settings.",
    missing_key_xml_private_or_empty:
      "We couldn't see any games on your Steam profile. Your game details may be private. You can still add games manually.",
    network_error_xml_private_or_empty:
      "We couldn't reach Steam just now. Try again in a moment, or add games manually.",
  };

  return {
    className: "bg-red-50 text-red-800",
    text:
      messages[status] ??
      `Steam import failed with status "${status}". We could not import your full library. You can still add games manually.`,
  };
}

function LibraryConnectionNotice({ summary }: { summary: { connected: number; total: number } }) {
  if (summary.total === 0) {
    return null;
  }

  if (summary.connected === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-ink/20 bg-white p-3 text-sm font-bold leading-6 text-ink/62">
        No one has connected Steam yet. You can still plan a time. Connect Steam later to find games everyone owns.
      </p>
    );
  }

  if (summary.connected < summary.total) {
    return (
      <p className="mt-3 rounded-lg border border-teal/20 bg-teal/10 p-3 text-sm font-bold leading-6 text-ink/70">
        {summary.connected} of {summary.total} libraries connected. Recommendations will improve as more people connect.
      </p>
    );
  }

  return (
    <p className="mt-3 rounded-lg border border-moss/20 bg-moss/10 p-3 text-sm font-bold leading-6 text-moss">
      All {summary.total} Steam libraries are connected.
    </p>
  );
}

function MatchDashboard({
  id,
  shareToken,
  participantId,
  participants,
  selectedParticipantIds,
  selectedPlayerCount,
  scoreMode,
  scoredGames,
}: {
  id?: string;
  shareToken: string;
  participantId?: string;
  participants: ParticipantView[];
  selectedParticipantIds: string[];
  selectedPlayerCount: number;
  scoreMode: ScoreMode;
  scoredGames: ScoredGame[];
}) {
  const compatibleGames = scoredGames.filter((game) => game.playerCountStatus === "supported");
  const uncertainGames = scoredGames.filter((game) => game.playerCountStatus === "uncertain");
  const closeGames = compatibleGames
    .filter((game) => !game.categories.includes("perfect"))
    .sort((a, b) => b.ownership.have - a.ownership.have || a.ownership.missing - b.ownership.missing || b.score - a.score)
    .slice(0, 3);
  const categorySections: Array<{ id: MatchCategory; title: string; empty: string }> = [
    { id: "perfect", title: "Perfect matches", empty: "No game is owned by everyone, but these are close." },
    { id: "hiddenBacklog", title: "Hidden backlog", empty: "No shared low-playtime backlog picks yet." },
    { id: "oldFavourites", title: "Old favourites", empty: "No heavily played group favourites yet." },
    { id: "almostReady", title: "Almost ready", empty: "No one-missing games yet." },
    { id: "saleOpportunity", title: "Sale opportunity", empty: "No discounted missing-player games found yet." },
  ];
  const filters = [
    ["Everyone owns", compatibleGames.filter((game) => game.ownership.have === game.ownership.selected).length],
    ["Most people own", compatibleGames.filter((game) => game.ownership.have >= Math.max(1, game.ownership.selected - 1)).length],
    ["Only one missing", compatibleGames.filter((game) => game.ownership.missing === 1).length],
    ["Online co-op", compatibleGames.filter((game) => game.factors.onlineCoop >= 80).length],
    ["Local co-op", compatibleGames.filter((game) => game.factors.localCoop >= 80).length],
    ["Played heavily", compatibleGames.filter((game) => isHeavilyPlayedGroupPick(game.playtimeMinutes)).length],
    ["Barely played", compatibleGames.filter((game) => isBarelyPlayedGroupPick(game.playtimeMinutes)).length],
  ] as const;

  return (
    <section id={id} className="surface rounded-xl p-5 scroll-mt-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">Group matching</p>
          <h2 className="mt-1 text-2xl font-black text-ink">Best fit for this crew</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/62">
            Scores combine ownership, player count, playtime, interest, preferences, and best-effort sale data.
          </p>
        </div>
      </div>

      <form className="mt-4 grid gap-4 rounded-lg border border-ink/10 bg-paper p-4" action={`/s/${shareToken}`}>
        <input type="hidden" name="tab" value="pick" />
        {participantId ? <input type="hidden" name="participant" value={participantId} /> : null}
        <div className="grid gap-3 md:grid-cols-[1fr_11rem_12rem_auto] md:items-end">
          <fieldset>
            <legend className="text-sm font-black text-ink">Players</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {participants.map((participant) => (
                <label key={participant.id} className="inline-flex items-center gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm font-bold text-ink">
                  <input
                    name="selectedParticipants"
                    type="checkbox"
                    value={participant.id}
                    defaultChecked={selectedParticipantIds.includes(participant.id)}
                    className="h-4 w-4 accent-teal"
                  />
                  {participant.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span className="text-sm font-black text-ink">Player count</span>
            <input name="playerCount" type="number" min={1} max={30} defaultValue={selectedPlayerCount} className="field" />
          </label>
          <label>
            <span className="text-sm font-black text-ink">Score mode</span>
            <select name="scoreMode" defaultValue={scoreMode} className="field">
              {Object.entries(scoreModeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button className="secondary-button h-11" type="submit">Update match</button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Match summary counts">
        {filters.map(([label, count]) => (
          <span key={label} className="rounded-md bg-linen px-3 py-2 text-xs font-black text-ink/65">
            <span className="text-ink">{count}</span> {label.toLowerCase()}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        {categorySections.map((section) => {
          const games = compatibleGames.filter((game) => game.categories.includes(section.id)).slice(0, 4);

          return (
            <section key={section.id} id={`category-${section.id}`} className="rounded-lg border border-ink/10 bg-paper p-4 scroll-mt-5">
              <h3 className="text-lg font-black text-ink">{section.title}</h3>
              {section.id === "perfect" && games.length === 0 && closeGames.length > 0 ? (
                <p className="mt-2 text-sm font-bold leading-6 text-ink/60">{section.empty}</p>
              ) : null}
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {games.length > 0 ? (
                  games.map((game) => <ScoredGameCard key={`${section.id}-${game.sessionGameId}`} game={game} />)
                ) : section.id === "perfect" && closeGames.length > 0 ? (
                  closeGames.map((game) => <ScoredGameCard key={`close-${game.sessionGameId}`} game={game} />)
                ) : (
                  <p className="rounded-md border border-dashed border-ink/15 bg-white p-3 text-sm leading-6 text-ink/55">{section.empty}</p>
                )}
              </div>
            </section>
          );
        })}
        {uncertainGames.length > 0 ? (
          <section className="rounded-lg border border-gold/35 bg-gold/10 p-4">
            <h3 className="text-lg font-black text-ink">Needs player-count metadata</h3>
            <p className="mt-1 text-sm leading-6 text-ink/62">
              These games are not hidden because their player limit is unknown. Add curated metadata or pick a known-capacity game for stronger recommendations.
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {uncertainGames.slice(0, 4).map((game) => <ScoredGameCard key={`uncertain-${game.sessionGameId}`} game={game} />)}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function ScoredGameCard({ game }: { game: ScoredGame }) {
  const alignmentClass = {
    High: "bg-moss/10 text-moss",
    Medium: "bg-gold/20 text-ink",
    Low: "bg-red-50 text-red-800",
  }[game.alignment];

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-ink">{game.title}</p>
          <p className="mt-1 text-sm font-bold text-ink/60">
            {game.ownership.have}/{game.ownership.selected} have it
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-teal">{game.score}</p>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/40">match</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-md px-2 py-1 text-xs font-black ${alignmentClass}`}>Alignment: {game.alignment}</span>
        {game.discountPercent > 0 ? <span className="rounded-md bg-coral/10 px-2 py-1 text-xs font-black text-coral">{game.discountPercent}% off</span> : null}
      </div>
      <ul className="mt-3 grid gap-1 text-sm leading-6 text-ink/62">
        {game.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {game.alignmentReasons.length > 0 ? (
        <div className="mt-3 rounded-md border border-ink/10 bg-paper p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Alignment check</p>
          <ul className="mt-2 grid gap-1 text-xs font-bold leading-5 text-ink/60">
            {game.alignmentReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="mt-3 grid gap-2">
        {game.factorBreakdown.slice(0, 6).map((factor) => (
          <div key={factor.key} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-2 text-xs font-bold text-ink/55">
            <span>{factor.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-linen">
              <span className="block h-full rounded-full bg-teal" style={{ width: `${Math.max(4, factor.value)}%` }} />
            </span>
            <span className="text-right">{Math.round(factor.points)} pts</span>
          </div>
        ))}
      </div>
      {game.reviewSummary ? (
        <p className="mt-3 text-xs font-bold leading-5 text-ink/45">{game.reviewSummary}</p>
      ) : null}
    </div>
  );
}

function DealAndFriendsPanel({
  shareToken,
  participantId,
  currentUser,
  dealCountry,
  dealCurrency,
  priceAlertEvents,
  friendInviteUrl,
  savedFriends,
  dealLookupConfigured,
}: {
  shareToken: string;
  participantId?: string;
  currentUser: UserWithSteam;
  dealCountry: string;
  dealCurrency: string;
  priceAlertEvents: PriceAlertEvent[];
  friendInviteUrl: string | null;
  savedFriends: User[];
  dealLookupConfigured: boolean;
}) {
  return (
    <section>
      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">Deals</p>
          <h2 className="mt-1 text-2xl font-black text-ink">Price alerts</h2>
          <form action={updateDealSettingsAction} className="mt-4 grid gap-3 rounded-lg border border-ink/10 bg-paper p-3 sm:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="shareToken" value={shareToken} />
            <label>
              <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Country</span>
              <input name="dealCountry" defaultValue={dealCountry} maxLength={2} className="field" />
            </label>
            <label>
              <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Currency</span>
              <input name="dealCurrency" defaultValue={dealCurrency} maxLength={3} className="field" />
            </label>
            <PendingSubmitButton className="secondary-button self-end" pendingLabel="Saving...">Save</PendingSubmitButton>
          </form>
          <form action={createPriceAlertRuleAction} className="mt-3 grid gap-3 rounded-lg border border-ink/10 bg-paper p-3 sm:grid-cols-[1fr_8rem_auto]">
            <input type="hidden" name="shareToken" value={shareToken} />
            {participantId ? <input type="hidden" name="participantId" value={participantId} /> : null}
            <select name="type" className="field mt-0" defaultValue="UNDER_PRICE">
              <option value="UNDER_PRICE">Alert under price</option>
              <option value="GROUP_ON_SALE">Group on sale</option>
              <option value="MISSING_PLAYERS_ONLY">Missing players only</option>
              <option value="HISTORICAL_LOW">Historical low</option>
              <option value="OWNED_COUNT_DISCOUNTED">N/M owned discounted</option>
            </select>
            <input name="thresholdPrice" type="number" step="0.01" defaultValue="10" className="field mt-0" />
            <PendingSubmitButton className="primary-button" pendingLabel="Adding...">
              <Bell className="h-4 w-4" />
              Add alert
            </PendingSubmitButton>
          </form>
          <div className="mt-3 grid gap-2">
            {priceAlertEvents.length > 0 ? (
              priceAlertEvents.map((event) => (
                <a key={event.id} href={event.url ?? "#"} className="rounded-lg border border-coral/20 bg-coral/10 p-3 text-sm font-bold text-ink">
                  {event.message}
                </a>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-ink/20 bg-paper p-3 text-sm leading-6 text-ink/55">
                {dealLookupConfigured
                  ? "No sale alerts yet. We'll show one here when a shortlisted game is discounted."
                  : "Live prices and sale alerts aren't available yet."}
              </p>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-moss">Friends</p>
          <h2 className="mt-1 text-2xl font-black text-ink">Reusable group</h2>
          {currentUser ? (
            <>
              <form action={createFriendInviteAction} className="mt-4">
                <input type="hidden" name="redirectTo" value={`/s/${shareToken}?tab=pick${participantId ? `&participant=${participantId}` : ""}`} />
                <PendingSubmitButton className="primary-button" pendingLabel="Creating...">
                  <LinkIcon className="h-4 w-4" />
                  Create friend invite
                </PendingSubmitButton>
              </form>
              {friendInviteUrl ? (
                <div className="mt-3 rounded-lg border border-ink/10 bg-paper p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Latest invite</p>
                  <p className="mt-1 break-all text-sm font-bold text-ink">{friendInviteUrl}</p>
                </div>
              ) : null}
              <div className="mt-3 grid gap-2">
                {savedFriends.length > 0 ? (
                  savedFriends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-2 rounded-lg border border-ink/10 bg-paper p-3">
                      <UsersRound className="h-4 w-4 text-teal" />
                      <span className="text-sm font-black text-ink">{friend.displayName}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-ink/20 bg-paper p-3 text-sm leading-6 text-ink/55">
                    Invite signed-in friends once, then reuse them for future Pick sessions.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-ink/20 bg-paper p-3 text-sm leading-6 text-ink/55">
              Sign in with Steam to create reusable friend invites.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function GroupBuyPanel({
  shareToken,
  participantId,
  filters,
  recommendations,
  currency,
  dealLookupConfigured,
}: {
  shareToken: string;
  participantId?: string;
  filters: GroupBuyFilters;
  recommendations: GroupBuyRecommendation[];
  currency: string;
  dealLookupConfigured: boolean;
}) {
  const labels: Record<GroupBuyRecommendation["section"], string> = {
    bestOverall: "Best overall group buy",
    cheapest: "Cheapest good option",
    longTerm: "Best long-term game",
    oneNight: "Best one-night game",
    trending: "Best new or trending option",
  };

  return (
    <section>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-gold">All buy a new game</p>
      <h2 className="mt-1 text-2xl font-black text-ink">Find a group buy</h2>
      {!dealLookupConfigured ? (
        <p className="mt-3 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm font-bold leading-6 text-ink/70">
          Live prices and discounts aren&apos;t available yet. You can still shortlist and compare games.
        </p>
      ) : null}
      <form className="mt-4 grid gap-3 rounded-lg border border-ink/10 bg-paper p-4 md:grid-cols-4" action={`/s/${shareToken}`}>
        <input type="hidden" name="tab" value="pick" />
        {participantId ? <input type="hidden" name="participant" value={participantId} /> : null}
        <label>
          <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Budget</span>
          <input name="groupBudget" type="number" step="0.01" defaultValue={filters.budget / 100} className="field" />
        </label>
        <label>
          <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Genre</span>
          <input name="groupGenre" defaultValue={filters.genre} placeholder="co-op survival" className="field" />
        </label>
        <label>
          <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Mode</span>
          <select name="groupMode" defaultValue={filters.mode} className="field">
            <option value="online">Online</option>
            <option value="local">Local</option>
            <option value="either">Either</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Length</span>
          <select name="groupLength" defaultValue={filters.sessionLength} className="field">
            <option value="any">Any</option>
            <option value="one-night">One night</option>
            <option value="long-term">Long-term</option>
            <option value="campaign">Campaign</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Platform</span>
          <input name="groupPlatform" defaultValue={filters.platform} placeholder="PC, Switch..." className="field" />
        </label>
        <div className="rounded-md border border-ink/10 bg-white px-3 py-2">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Players</p>
          <p className="mt-1 font-black text-ink">{filters.playerCount}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-bold text-ink">
          <input name="avoidOwned" type="checkbox" defaultChecked={filters.avoidOwned} className="h-4 w-4 accent-teal" />
          Avoid already-owned
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-bold text-ink">
          <input name="saleOnly" type="checkbox" defaultChecked={filters.saleOnly} className="h-4 w-4 accent-teal" />
          Sale only
        </label>
        <button className="secondary-button md:col-span-2" type="submit">Update group buy</button>
      </form>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {recommendations.length > 0 ? (
          recommendations.map((recommendation) => (
            <div key={`${recommendation.section}-${recommendation.game.slug}`} className="rounded-lg border border-ink/10 bg-paper p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-teal">{labels[recommendation.section]}</p>
              <h3 className="mt-1 text-lg font-black text-ink">{recommendation.game.title}</h3>
              <p className="mt-1 text-sm font-black text-teal">Group buy score: {recommendation.score}</p>
              <p className="mt-1 text-sm leading-6 text-ink/60">{recommendation.game.description}</p>
              <p className="mt-2 text-sm font-black text-coral">
                {recommendation.price !== null && recommendation.price !== undefined
                  ? formatMinorPrice(recommendation.price, recommendation.currency ?? currency)
                  : dealLookupConfigured
                    ? "No live price found yet"
                    : "Price lookup not configured"}
              </p>
              <ul className="mt-2 grid gap-1 text-sm text-ink/60">
                {recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-ink/20 bg-paper p-4 text-sm leading-6 text-ink/55">
            No group-buy candidates match those filters yet.
          </p>
        )}
      </div>
    </section>
  );
}

function PreferencePanel({
  shareToken,
  participantId,
  currentUser,
  currentParticipant,
  hasPickSignals,
}: {
  shareToken: string;
  participantId?: string;
  currentUser: UserWithSteam;
  currentParticipant?: ParticipantView;
  hasPickSignals: boolean;
}) {
  if (!participantId) {
    return null;
  }

  const preference = currentUser?.preference ?? currentParticipant?.preference;
  const showNudge = hasPickSignals && !currentParticipant?.preferenceNudgeDismissedAt && !preference;

  return (
    <section>
      {showNudge ? (
        <div className="mb-4 rounded-lg border border-teal/20 bg-teal/10 p-4">
          <p className="font-black text-ink">Quick match tune-up</p>
          <form action={updateQuickPreferenceAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <input type="hidden" name="shareToken" value={shareToken} />
            <input type="hidden" name="participantId" value={participantId} />
            <label>
              <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Co-op preference</span>
              <select name="coOpVsCompetitive" className="field">
                <option value="80">Prefer co-op</option>
                <option value="50">Either</option>
                <option value="25">Competitive is fine</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">Tonight</span>
              <select name="familiarVsNew" className="field">
                <option value="35">Something familiar</option>
                <option value="50">Either</option>
                <option value="75">Something new</option>
              </select>
            </label>
            <PendingSubmitButton className="primary-button" pendingLabel="Saving...">Save</PendingSubmitButton>
          </form>
          <form action={updateQuickPreferenceAction} className="mt-2">
            <input type="hidden" name="shareToken" value={shareToken} />
            <input type="hidden" name="participantId" value={participantId} />
            <input type="hidden" name="dismiss" value="true" />
            <PendingSubmitButton className="secondary-button px-3 py-2" pendingLabel="Skipping...">Skip</PendingSubmitButton>
          </form>
        </div>
      ) : null}
    <details open={hasPickSignals}>
      <summary className="cursor-pointer list-none">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-coral">Preferences</p>
        <h2 className="mt-1 text-2xl font-black text-ink">Tune your match</h2>
        <p className="mt-2 text-sm leading-6 text-ink/62">
          Optional. Signed-in users save this to their account; anonymous players save it for this session.
        </p>
      </summary>
      <form action={updatePreferenceAction} className="mt-4 grid gap-4 rounded-lg border border-ink/10 bg-paper p-4">
        <input type="hidden" name="shareToken" value={shareToken} />
        <input type="hidden" name="participantId" value={participantId} />
        <PreferenceSlider name="familiarVsNew" label="Familiar vs new" left="Familiar" right="New" value={preference?.familiarVsNew ?? 50} />
        <PreferenceSlider name="coOpVsCompetitive" label="Co-op vs competitive" left="Competitive" right="Co-op" value={preference?.coOpVsCompetitive ?? 75} />
        <PreferenceSlider name="priceImportance" label="Price matters" left="Not much" right="A lot" value={preference?.priceImportance ?? 50} />
        <PreferenceSlider name="genreImportance" label="Genre matters" left="Flexible" right="Important" value={preference?.genreImportance ?? 50} />
        <PreferenceSlider name="ownershipImportance" label="Already owned matters" left="Flexible" right="Important" value={preference?.ownershipImportance ?? 75} />
        <PreferenceSlider name="backlogImportance" label="Clear the backlog" left="Not now" right="Yes" value={preference?.backlogImportance ?? 50} />
        <PreferenceSlider name="shortVsLong" label="Short sessions vs campaigns" left="Short" right="Campaign" value={preference?.shortVsLong ?? 50} />
        <PreferenceSlider name="chillVsIntense" label="Chill vs intense" left="Chill" right="Intense" value={preference?.chillVsIntense ?? 50} />
        <PendingSubmitButton className="primary-button w-fit" pendingLabel="Saving...">
          Save preferences
        </PendingSubmitButton>
      </form>
    </details>
    </section>
  );
}

function PreferenceSlider({ name, label, left, right, value }: { name: string; label: string; left: string; right: string; value: number }) {
  return (
    <label>
      <span className="text-sm font-black text-ink">{label}</span>
      <input name={name} type="range" min={0} max={100} defaultValue={value} className="mt-2 w-full accent-teal" />
      <span className="mt-1 flex justify-between text-xs font-bold text-ink/50">
        <span>{left}</span>
        <span>{right}</span>
      </span>
    </label>
  );
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
  const haveCount = countHaveSignals(sessionGame);
  const dontHaveCount = countDontHaveSignals(sessionGame);
  const currentSignal = participantId ? sessionGame.signals.find((signal) => signal.participantId === participantId)?.signal : null;
  const currentHas = signalMeansHave(currentSignal);
  const currentDoesNotHave = currentSignal === "NOT_AVAILABLE";
  const playerMetadata = formatGamePlayerMetadata(sessionGame.game);

  return (
    <div className="rounded-lg border border-ink/10 bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-ink">{sessionGame.game.title}</p>
          <p className="mt-1 text-sm text-ink/60">
            {haveCount} have, {dontHaveCount} don&apos;t
          </p>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-teal">{playerMetadata}</p>
          {sessionGame.game.capabilitySource ? (
            <p className="mt-1 text-xs font-bold text-ink/45">Player data: {formatCapabilitySource(sessionGame.game.capabilitySource)}</p>
          ) : null}
        </div>
      </div>
      {participantId ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { signal: "OWNED", label: "Have", selected: currentHas },
            { signal: "NOT_AVAILABLE", label: "Don't have", selected: currentDoesNotHave },
          ].map((option) => (
            <form key={option.signal} action={markGameAvailableAction}>
              <input type="hidden" name="shareToken" value={shareToken} />
              <input type="hidden" name="sessionGameId" value={sessionGame.id} />
              <input type="hidden" name="participantId" value={participantId} />
              <input type="hidden" name="signal" value={option.signal} />
              <PendingSubmitButton
                className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-black transition ${
                  option.signal === "OWNED"
                    ? option.selected
                      ? "border-moss bg-moss text-white"
                      : "border-moss/25 bg-moss/10 text-moss hover:bg-moss/15"
                    : option.selected
                      ? "border-red-700 bg-red-700 text-white"
                      : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                }`}
                pendingLabel="Saving..."
              >
                {option.signal === "OWNED" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {option.label}
              </PendingSubmitButton>
            </form>
          ))}
        </div>
      ) : null}
      {participantId && currentSignal ? (
        <InterestControls shareToken={shareToken} participantId={participantId} sessionGame={sessionGame} />
      ) : null}
      <details className="mt-3">
        <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.12em] text-ink/45">Manage game</summary>
        <form action={removeSessionGameAction} className="mt-2">
          <input type="hidden" name="shareToken" value={shareToken} />
          <input type="hidden" name="sessionGameId" value={sessionGame.id} />
          <PendingSubmitButton className="secondary-button px-3 py-2" pendingLabel="Removing...">
            Remove from shortlist
          </PendingSubmitButton>
        </form>
      </details>
    </div>
  );
}

function InterestControls({
  shareToken,
  participantId,
  sessionGame,
}: {
  shareToken: string;
  participantId: string;
  sessionGame: SessionGameView;
}) {
  const currentInterest = sessionGame.interests.find((interest) => interest.participantId === participantId)?.interest ?? "NEUTRAL";
  const options: Array<{ interest: GameInterestSignal; label: string }> = [
    { interest: "WANT_TO_PLAY", label: "Want to play" },
    { interest: "NEUTRAL", label: "Neutral" },
    { interest: "NOT_TONIGHT", label: "Not tonight" },
  ];

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {options.map((option) => (
        <form key={option.interest} action={markGameInterestAction}>
          <input type="hidden" name="shareToken" value={shareToken} />
          <input type="hidden" name="sessionGameId" value={sessionGame.id} />
          <input type="hidden" name="participantId" value={participantId} />
          <input type="hidden" name="interest" value={option.interest} />
          <PendingSubmitButton
            className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-black transition ${
              currentInterest === option.interest ? "border-teal bg-teal text-white" : "border-ink/10 bg-white text-ink hover:bg-paper"
            }`}
            pendingLabel="Saving..."
          >
            <Heart className="h-4 w-4" />
            {option.label}
          </PendingSubmitButton>
        </form>
      ))}
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
      <PendingSubmitButton className="primary-button" pendingLabel="Adding...">
        <Plus className="h-4 w-4" />
        Add
      </PendingSubmitButton>
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
          {game.genres?.length ? <input type="hidden" name="genres" value={JSON.stringify(game.genres)} /> : null}
          {game.platforms?.length ? <input type="hidden" name="platforms" value={JSON.stringify(game.platforms)} /> : null}
          {game.gameModes?.length ? <input type="hidden" name="gameModes" value={JSON.stringify(game.gameModes)} /> : null}
          {game.minPlayers ? <input type="hidden" name="minPlayers" value={game.minPlayers} /> : null}
          {game.maxPlayers ? <input type="hidden" name="maxPlayers" value={game.maxPlayers} /> : null}
          {game.onlineCoop !== null && game.onlineCoop !== undefined ? <input type="hidden" name="onlineCoop" value={String(game.onlineCoop)} /> : null}
          {game.localCoop !== null && game.localCoop !== undefined ? <input type="hidden" name="localCoop" value={String(game.localCoop)} /> : null}
          {game.capabilitySource ? <input type="hidden" name="capabilitySource" value={game.capabilitySource} /> : null}
          {game.capabilityConfidence !== null && game.capabilityConfidence !== undefined ? <input type="hidden" name="capabilityConfidence" value={game.capabilityConfidence} /> : null}
          <p className="font-black text-ink">{game.title}</p>
          {game.platforms?.length ? <p className="mt-1 text-xs font-bold text-ink/50">{game.platforms.slice(0, 3).join(", ")}</p> : null}
          <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-teal">{formatGamePlayerMetadata(game)}</p>
          <PendingSubmitButton className="secondary-button mt-3 w-full px-3 py-2" pendingLabel="Adding...">
            <Plus className="h-4 w-4" />
            Add
          </PendingSubmitButton>
        </form>
      ))}
    </div>
  );
}

function formatGamePlayerMetadata(game: Pick<GameInput, "minPlayers" | "maxPlayers" | "onlineCoop" | "localCoop">) {
  const minPlayers = game.minPlayers ?? null;
  const maxPlayers = game.maxPlayers ?? null;
  const playerText =
    minPlayers && maxPlayers
      ? minPlayers === maxPlayers
        ? `${maxPlayers} player${maxPlayers === 1 ? "" : "s"}`
        : `${minPlayers}-${maxPlayers} players`
      : maxPlayers
        ? `Up to ${maxPlayers} players`
        : "Player count unknown";
  const modes = [
    game.onlineCoop ? "online" : null,
    game.localCoop ? "local" : null,
  ].filter(Boolean);

  return modes.length > 0 ? `${playerText} · ${modes.join(" + ")}` : playerText;
}

function formatCapabilitySource(source: string) {
  if (source === "curated") {
    return "curated list";
  }

  if (source.startsWith("igdb")) {
    return "IGDB";
  }

  return source;
}
