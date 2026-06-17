import type { Game, GameInterestSignal, Participant, ParticipantPreference, SessionGame, SessionGameInterest, SessionGameSignal, SteamAccount, SteamStorePrice, User, UserPreference } from "@prisma/client";
import { Check, Gamepad2, Heart, LogOut, Plus, Search, Sparkles, TrendingUp, X } from "lucide-react";
import {
  addSessionGameAction,
  importSteamLibraryAction,
  markGameInterestAction,
  markGameAvailableAction,
  removeSessionGameAction,
  updatePreferenceAction,
} from "@/app/actions";
import { countDontHaveSignals, countHaveSignals, signalMeansHave, type GameInput } from "@/lib/games";
import { scoreModeLabels, type MatchCategory, type ScoredGame, type ScoreMode } from "@/lib/match-scoring";
import { PendingSubmitButton } from "@/components/pending-submit-button";

type SessionGameView = SessionGame & {
  game: Game & { steamStorePrice?: SteamStorePrice | null };
  signals: SessionGameSignal[];
  interests: SessionGameInterest[];
};

type ParticipantView = Participant & {
  preference: ParticipantPreference | null;
  user: (User & { preference: UserPreference | null }) | null;
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
                  {importMessage ? (
                    <p className={`mt-2 rounded-md px-3 py-2 text-sm font-bold ${importMessage.className}`}>
                      {importMessage.text}
                    </p>
                  ) : null}
                </div>
                <form action={importSteamLibraryAction}>
                  <input type="hidden" name="shareToken" value={shareToken} />
                  {participantId ? <input type="hidden" name="participantId" value={participantId} /> : null}
                  <PendingSubmitButton className="primary-button" pendingLabel="Importing...">
                    Import Steam library
                  </PendingSubmitButton>
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

        <MatchDashboard
          shareToken={shareToken}
          participantId={participantId}
          participants={participants}
          selectedParticipantIds={selectedParticipantIds}
          selectedPlayerCount={selectedPlayerCount}
          scoreMode={scoreMode}
          scoredGames={scoredGames}
        />

        <PreferencePanel
          shareToken={shareToken}
          participantId={participantId}
          currentUser={currentUser}
          currentParticipant={participants.find((participant) => participant.id === participantId)}
          hasPickSignals={currentParticipantHasPickSignals}
        />

        <section className="surface rounded-xl p-5">
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

        <section className="surface rounded-xl p-5">
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
      text: `Imported ${count} Steam game${count === "1" ? "" : "s"} from your public Steam profile. The Web API path was unavailable, so we used Steam's public library feed instead.`,
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
    http_401_xml_private_or_empty:
      "Steam rejected the API key, and your public Steam profile did not expose a visible game library. Check the key and Steam privacy settings.",
    http_403_xml_private_or_empty:
      "Steam refused the API request, and your public Steam profile did not expose a visible game library. Check the key and Steam privacy settings.",
    missing_key_xml_private_or_empty:
      "No Steam API key is configured, and your public Steam profile did not expose a visible game library.",
    network_error_xml_private_or_empty:
      "The Steam Web API could not be reached, and the public Steam profile fallback did not expose a visible library.",
  };

  return {
    className: "bg-red-50 text-red-800",
    text:
      messages[status] ??
      `Steam import failed with status "${status}". We could not import your full library. You can still add games manually.`,
  };
}

function MatchDashboard({
  shareToken,
  participantId,
  participants,
  selectedParticipantIds,
  selectedPlayerCount,
  scoreMode,
  scoredGames,
}: {
  shareToken: string;
  participantId?: string;
  participants: ParticipantView[];
  selectedParticipantIds: string[];
  selectedPlayerCount: number;
  scoreMode: ScoreMode;
  scoredGames: ScoredGame[];
}) {
  const categorySections: Array<{ id: MatchCategory; title: string; empty: string }> = [
    { id: "perfect", title: "Perfect matches", empty: "No game is owned by everyone and confirmed for this group size yet." },
    { id: "hiddenBacklog", title: "Hidden backlog", empty: "No shared low-playtime backlog picks yet." },
    { id: "oldFavourites", title: "Old favourites", empty: "No heavily played group favourites yet." },
    { id: "almostReady", title: "Almost ready", empty: "No one-missing games yet." },
    { id: "saleOpportunity", title: "Sale opportunity", empty: "No discounted missing-player games found yet." },
  ];
  const filters = [
    ["Everyone owns", scoredGames.filter((game) => game.ownership.have === game.ownership.selected).length],
    ["Most people own", scoredGames.filter((game) => game.ownership.have >= Math.max(1, game.ownership.selected - 1)).length],
    ["Only one missing", scoredGames.filter((game) => game.ownership.missing === 1).length],
    ["Online co-op", scoredGames.filter((game) => game.factors.coopFit >= 80).length],
    ["Local co-op", scoredGames.filter((game) => game.factors.coopFit >= 80).length],
    ["Played heavily", scoredGames.filter((game) => game.playtimeMinutes >= 600).length],
    ["Barely played", scoredGames.filter((game) => game.playtimeMinutes < 120).length],
  ] as const;

  return (
    <section className="surface rounded-xl p-5">
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

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map(([label, count]) => (
          <span key={label} className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs font-black text-ink/65">
            {label}: {count}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        {categorySections.map((section) => {
          const games = scoredGames.filter((game) => game.categories.includes(section.id)).slice(0, 4);

          return (
            <section key={section.id} className="rounded-lg border border-ink/10 bg-paper p-4">
              <h3 className="text-lg font-black text-ink">{section.title}</h3>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {games.length > 0 ? (
                  games.map((game) => <ScoredGameCard key={`${section.id}-${game.sessionGameId}`} game={game} />)
                ) : (
                  <p className="rounded-md border border-dashed border-ink/15 bg-white p-3 text-sm leading-6 text-ink/55">{section.empty}</p>
                )}
              </div>
            </section>
          );
        })}
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
    </div>
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

  return (
    <details className="surface rounded-xl p-5" open={hasPickSignals}>
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

  return (
    <div className="rounded-lg border border-ink/10 bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-ink">{sessionGame.game.title}</p>
          <p className="mt-1 text-sm text-ink/60">
            {haveCount} have, {dontHaveCount} don&apos;t
          </p>
        </div>
        <form action={removeSessionGameAction}>
          <input type="hidden" name="shareToken" value={shareToken} />
          <input type="hidden" name="sessionGameId" value={sessionGame.id} />
          <PendingSubmitButton className="secondary-button px-3 py-2" pendingLabel="Removing...">
            Remove
          </PendingSubmitButton>
        </form>
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
      {participantId ? (
        <InterestControls shareToken={shareToken} participantId={participantId} sessionGame={sessionGame} />
      ) : null}
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
          <p className="font-black text-ink">{game.title}</p>
          {game.platforms?.length ? <p className="mt-1 text-xs font-bold text-ink/50">{game.platforms.slice(0, 3).join(", ")}</p> : null}
          <PendingSubmitButton className="secondary-button mt-3 w-full px-3 py-2" pendingLabel="Adding...">
            <Plus className="h-4 w-4" />
            Add
          </PendingSubmitButton>
        </form>
      ))}
    </div>
  );
}
