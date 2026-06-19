import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Download, Gamepad2, Lock, UsersRound } from "lucide-react";
import { lockSessionAction, submitAvailabilityAction } from "@/app/actions";
import { AvailabilityForm } from "@/components/availability-form";
import { PickPanel } from "@/components/pick-panel";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { RecommendationsDisclosure } from "@/components/recommendations-disclosure";
import { SessionTabs } from "@/components/session-tabs";
import { SharePanel } from "@/components/share-panel";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/lib/auth";
import { curatedGames } from "@/lib/curated-games";
import { announceDiscordPriceAlerts } from "@/lib/discord";
import { refreshGameMetadata } from "@/lib/game-metadata";
import { commonMultiplayerGames, excludeExistingGames, rankSessionGames } from "@/lib/games";
import { defaultGroupBuyFilters, scoreGroupBuyCandidates } from "@/lib/group-buy";
import { getPopularIgdbGames, getTrendingIgdbGames, mapIgdbGame, searchIgdbGames } from "@/lib/igdb";
import { refreshGameDealsWithin } from "@/lib/itad";
import { scoreSessionGames, type ScoreMode } from "@/lib/match-scoring";
import { evaluatePriceAlerts } from "@/lib/price-alerts";
import { prisma } from "@/lib/prisma";
import {
  type BestTime,
  formatSlotRange,
  formatSlotDay,
  formatSlotTime,
  generateHourlySlots,
  isWeekendSlot,
  rankBestTimes,
  rankMaybeTimes,
  responseMap,
} from "@/lib/scheduling";

type PageProps = {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{
    participant?: string;
    tab?: string;
    gameSearch?: string;
    scoreMode?: string;
    playerCount?: string;
    selectedParticipants?: string | string[];
    groupBudget?: string;
    groupGenre?: string;
    groupMode?: string;
    groupLength?: string;
    groupPlatform?: string;
    avoidOwned?: string;
    saleOnly?: string;
  }>;
};

type RecommendationTime = BestTime & {
  combinedCount?: number;
};

export default async function SessionPage({ params, searchParams }: PageProps) {
  const { shareToken } = await params;
  const {
    participant: participantId,
    tab,
    gameSearch,
    scoreMode,
    playerCount,
    selectedParticipants,
    groupBudget,
    groupGenre,
    groupMode,
    groupLength,
    groupPlatform,
    avoidOwned,
    saleOnly,
  } = await searchParams;
  const activeTab = tab === "pick" ? "pick" : "plan";
  const activeScoreMode = parseScoreMode(scoreMode);
  const session = await prisma.session.findUnique({
    where: { shareToken },
    include: {
      participants: {
        orderBy: [{ isHost: "desc" }, { createdAt: "asc" }],
        include: {
          responses: true,
          preference: true,
          user: { include: { preference: true, steamAccount: true } },
        },
      },
    },
  });

  if (!session) {
    notFound();
  }

  const appUrl = await getAppUrl();
  const shareUrl = `${appUrl}/s/${session.shareToken}${activeTab === "pick" ? "?tab=pick" : ""}`;
  const slots = generateHourlySlots(session);
  const participantAvailability = session.participants.map((participant) => ({
    participantId: participant.id,
    name: participant.name,
    responses: responseMap(participant.responses),
  }));
  const groupedSlots = slots.reduce<
    Array<{
      day: string;
      toneIndex: number;
      isWeekend: boolean;
      slots: Array<{
        key: string;
        time: string;
        availableCount: number;
        maybeCount: number;
        totalCount: number;
      }>;
    }>
  >((groups, slot) => {
    const day = formatSlotDay(slot.startsAt, session.timezone);
    const isWeekend = isWeekendSlot(slot.startsAt, session.timezone);
    const statusCounts = participantAvailability.reduce(
      (counts, participant) => {
        const status = participant.responses.get(slot.startsAt.toISOString());
        if (status === "AVAILABLE") {
          counts.availableCount += 1;
        }
        if (status === "MAYBE") {
          counts.maybeCount += 1;
        }
        return counts;
      },
      { availableCount: 0, maybeCount: 0 },
    );
    const slotView = {
      key: slot.startsAt.toISOString(),
      time: formatSlotTime(slot.startsAt, slot.endsAt, session.timezone),
      availableCount: statusCounts.availableCount,
      maybeCount: statusCounts.maybeCount,
      totalCount: session.participants.length,
    };
    const existing = groups.find((group) => group.day === day);

    if (existing) {
      existing.slots.push(slotView);
    } else {
      groups.push({ day, toneIndex: groups.length % 7, isWeekend, slots: [slotView] });
    }

    return groups;
  }, []);
  const currentParticipant = session.participants.find((participant) => participant.id === participantId);
  const isCurrentHost = currentParticipant?.isHost === true;
  const currentResponses = responseMap(currentParticipant?.responses ?? []);
  const currentUser = await getCurrentUser();
  const bestTimes = rankBestTimes(session, participantAvailability).slice(0, 5);
  const maybeTimes = rankMaybeTimes(session, participantAvailability).slice(0, 5);
  const locked = session.lockedStartTime && session.lockedEndTime;
  const totalPeople = session.participants.length;
  const submittedAvailability = participantAvailability.filter((participant) => participant.responses.size > 0);
  const submittedPeople = submittedAvailability.length;
  const needsMoreSubmissions = submittedPeople > 0 && submittedPeople < session.minimumPlayerCount;
  const currentRankingInput = {
    ...session,
    minimumPlayerCount: Math.max(submittedPeople, 1),
  };
  const shortfallTimes: RecommendationTime[] = needsMoreSubmissions
    ? [...rankBestTimes(currentRankingInput, submittedAvailability), ...rankMaybeTimes(currentRankingInput, submittedAvailability)]
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          if (b.availableCount !== a.availableCount) {
            return b.availableCount - a.availableCount;
          }
          return a.startsAt.getTime() - b.startsAt.getTime();
        })
        .slice(0, 5)
    : [];
  const compactAvailability = groupedSlots.length > 10;
  const currentResponseRecord = Object.fromEntries(currentResponses);
  const responseTotal = session.participants.reduce((total, participant) => total + participant.responses.length, 0);
  const possibleResponses = Math.max(session.participants.length * slots.length, 1);
  const responsePercent = Math.round((responseTotal / possibleResponses) * 100);
  const bestMatchLabel = submittedPeople >= session.minimumPlayerCount ? "Best match" : submittedPeople > 0 ? "Best so far" : "Waiting for responses";
  const selectedParticipantIds = normalizeSelectedParticipants(selectedParticipants, session.participants.map((participant) => participant.id));
  const selectedPlayerCount = Math.max(1, Number(playerCount ?? session.minimumPlayerCount) || session.minimumPlayerCount);
  const [initialSessionGames, searchResults, popularGames, trendingGames] =
    activeTab === "pick"
      ? await Promise.all([
          prisma.sessionGame.findMany({
            where: { sessionId: session.id },
            include: {
              game: { include: { steamStorePrice: true, deal: true } },
              signals: true,
              interests: true,
            },
          }),
          gameSearch ? searchIgdbGames(gameSearch).then((games) => games.map(mapIgdbGame)) : Promise.resolve([]),
          getPopularIgdbGames().then((games) => games.map(mapIgdbGame)),
          getTrendingIgdbGames().then((games) => games.map(mapIgdbGame)),
        ])
      : [[], [], [], []];
  if (activeTab === "pick") {
    const gameIds = initialSessionGames.map((sessionGame) => sessionGame.gameId);

    await Promise.all([
      withTimeout(refreshGameMetadata(gameIds), 700),
      refreshGameDealsWithin({
        gameIds,
        country: session.dealCountry,
        currency: session.dealCurrency,
      }),
    ]);
  }
  const sessionGames =
    activeTab === "pick"
      ? rankSessionGames(initialSessionGames)
      : [];
  const participantUserIds = session.participants
    .map((participant) => participant.userId)
    .filter((userId): userId is string => Boolean(userId));
  const sessionGameUserIds = sessionGames
    .map((sessionGame) => sessionGame.addedByUserId)
    .filter((userId): userId is string => Boolean(userId));
  const playtimeUserIds = [...new Set([...participantUserIds, ...sessionGameUserIds])];
  const userGames =
    activeTab === "pick"
      ? await prisma.userGame.findMany({
          where: {
            userId: { in: playtimeUserIds },
            gameId: { in: sessionGames.map((sessionGame) => sessionGame.gameId) },
          },
        })
      : [];
  const scoredGames =
    activeTab === "pick"
      ? scoreSessionGames({
          sessionGames,
          participants: session.participants,
          userGames,
          selectedParticipantIds,
          playerCount: selectedPlayerCount,
          mode: activeScoreMode,
        })
      : [];
  if (activeTab === "pick") {
    await evaluatePriceAlerts({
      sessionId: session.id,
      sessionGames,
      selectedCount: selectedParticipantIds.length,
      currency: session.dealCurrency,
    });
    await announceDiscordPriceAlerts(session.id);
  }
  const [priceAlertEvents, latestFriendInvite, savedFriends] =
    activeTab === "pick"
      ? await Promise.all([
          prisma.priceAlertEvent.findMany({
            where: { sessionId: session.id },
            orderBy: { triggeredAt: "desc" },
            take: 6,
          }),
          currentUser
            ? prisma.friendInvite.findFirst({
                where: {
                  inviterId: currentUser.id,
                  expiresAt: { gt: new Date() },
                  acceptedAt: null,
                },
                orderBy: { createdAt: "desc" },
              })
            : Promise.resolve(null),
          currentUser
            ? prisma.userFriend.findMany({
                where: { userId: currentUser.id },
                include: { friend: true },
                orderBy: { createdAt: "desc" },
              })
            : Promise.resolve([]),
        ])
      : [[], null, []];
  const groupBuyFilters = parseGroupBuyFilters({
    groupBudget,
    groupGenre,
    groupMode,
    groupLength,
    groupPlatform,
    avoidOwned,
    saleOnly,
    selectedPlayerCount,
  });
  const curatedSteamAppIds = curatedGames.map((game) => game.steamAppId).filter((steamAppId): steamAppId is number => Boolean(steamAppId));
  const curatedDbGames =
    activeTab === "pick"
      ? await prisma.game.findMany({
          where: { steamAppId: { in: curatedSteamAppIds } },
          include: { deal: true },
        })
      : [];
  const groupBuyDeals = new Map(
    curatedDbGames
      .filter((game) => game.deal)
      .map((game) => [
        game.title,
        {
          currentPrice: game.deal!.currentPrice,
          currency: game.deal!.currency,
          discountPercent: game.deal!.discountPercent,
        },
      ]),
  );
  const ownedTitles = sessionGames
    .filter((sessionGame) => sessionGame.signals.some((signal) => selectedParticipantIds.includes(signal.participantId) && (signal.signal === "OWNED" || signal.signal === "AVAILABLE_TO_PLAY")))
    .map((sessionGame) => sessionGame.game.title);
  const groupBuyRecommendations =
    activeTab === "pick"
      ? scoreGroupBuyCandidates({
          filters: groupBuyFilters,
          ownedTitles,
          deals: groupBuyDeals,
        })
      : [];
  const commonGames =
    activeTab === "pick"
      ? excludeExistingGames(
          commonMultiplayerGames,
          sessionGames.map((sessionGame) => sessionGame.game),
        )
      : commonMultiplayerGames;
  const currentParticipantHasPickSignals =
    activeTab === "pick" && currentParticipant
      ? sessionGames.some((sessionGame) => sessionGame.signals.some((signal) => signal.participantId === currentParticipant.id))
      : false;
  const libraryConnectionSummary = {
    connected: session.participants.filter((participant) => participant.user?.steamAccount).length,
    total: session.participants.length,
  };

  return (
    <main className="ui-shell">
      <nav className="flex flex-wrap items-center justify-between gap-3 py-2">
        <Link href="/" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
        <div className="flex flex-wrap gap-2">
          <SharePanel url={shareUrl} title={session.title} />
          {locked ? (
            <a href={`/s/${session.shareToken}/ics`} className="primary-button">
              <Download className="h-4 w-4" />
              Calendar
            </a>
          ) : null}
        </div>
      </nav>

      <section className="relative mt-6 overflow-hidden rounded-xl border border-ink/10 bg-ink text-white shadow-soft">
        <Image src="/assets/game-night-hero.webp" alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/35" />
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_360px] lg:p-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-gold">Game night</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">{session.title}</h1>
            <p className="mt-3 text-sm font-bold text-white/70">
              {session.mode === "ONLINE" ? "Online" : "In person"} - {session.requiredDuration} {session.requiredDuration === 1 ? "hour" : "hours"} - Min {session.minimumPlayerCount} players
            </p>
            {locked ? (
              <div className="mt-6 inline-flex flex-wrap items-center gap-3 rounded-lg bg-moss px-4 py-3 text-white">
                <Lock className="h-5 w-5" />
                <span className="font-black">
                  Locked: {formatSlotRange(session.lockedStartTime!, session.lockedEndTime!, session.timezone)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl bg-white/95 p-4 text-ink shadow-card backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">{bestMatchLabel}</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">
              {bestTimes[0]
                ? formatSlotRange(bestTimes[0].startsAt, bestTimes[0].endsAt, session.timezone)
                : maybeTimes[0]
                  ? formatSlotRange(maybeTimes[0].startsAt, maybeTimes[0].endsAt, session.timezone)
                  : "No good time yet"}
            </h2>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-linen">
              <div className="h-full rounded-full bg-gradient-to-r from-coral via-gold to-teal transition-all" style={{ width: `${responsePercent}%` }} />
            </div>
            <p className="mt-2 text-sm font-bold text-ink/60">{responsePercent}% of availability filled</p>
            {needsMoreSubmissions ? (
              <p className="mt-2 text-xs font-bold text-ink/50">
                Waiting for {session.minimumPlayerCount - submittedPeople} more player{session.minimumPlayerCount - submittedPeople === 1 ? "" : "s"} to submit.
              </p>
            ) : submittedPeople === 0 ? (
              <p className="mt-2 text-xs font-bold text-ink/50">
                Share the link to start collecting availability.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <SessionTabs shareToken={session.shareToken} participantId={participantId} activeTab={activeTab} />

      {activeTab === "pick" ? (
        <PickPanel
          shareToken={session.shareToken}
          participantId={currentParticipant?.id ?? participantId}
          currentUser={currentUser}
          sessionGames={sessionGames}
          searchResults={searchResults}
          popularGames={popularGames}
          trendingGames={trendingGames}
          commonGames={commonGames}
          searchQuery={gameSearch ?? ""}
          currentParticipantHasPickSignals={currentParticipantHasPickSignals}
          participants={session.participants}
          selectedParticipantIds={selectedParticipantIds}
          selectedPlayerCount={selectedPlayerCount}
          scoreMode={activeScoreMode}
          scoredGames={scoredGames}
          dealCountry={session.dealCountry}
          dealCurrency={session.dealCurrency}
          priceAlertEvents={priceAlertEvents}
          groupBuyFilters={groupBuyFilters}
          groupBuyRecommendations={groupBuyRecommendations}
          dealLookupConfigured={Boolean(process.env.ITAD_API_KEY)}
          friendInviteUrl={latestFriendInvite ? `${appUrl}/friends/invite/${latestFriendInvite.token}` : null}
          savedFriends={savedFriends.map((friend) => friend.friend)}
          libraryConnectionSummary={libraryConnectionSummary}
        />
      ) : (
      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          <RecommendationsDisclosure isCurrentHost={isCurrentHost} needsMoreSubmissions={needsMoreSubmissions}>
            <div className={`mt-5 grid gap-4 ${needsMoreSubmissions ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
              <RecommendationList
                title="Available"
                empty={`No time has ${session.minimumPlayerCount} confirmed available yet.`}
                times={bestTimes}
                totalPeople={totalPeople}
                shareToken={session.shareToken}
                timezone={session.timezone}
                tone="available"
              />
              <RecommendationList
                title="Including maybes"
                empty="No extra times become viable by counting maybes yet."
                times={maybeTimes}
                totalPeople={totalPeople}
                shareToken={session.shareToken}
                timezone={session.timezone}
                tone="maybe"
              />
              {needsMoreSubmissions ? (
                <RecommendationList
                  title="Not enough players"
                  empty="No submitted availability to compare yet."
                  times={shortfallTimes}
                  totalPeople={submittedPeople}
                  shareToken={session.shareToken}
                  timezone={session.timezone}
                  tone="shortfall"
                  note={`Best matches from ${submittedPeople}/${session.minimumPlayerCount} submitted player${submittedPeople === 1 ? "" : "s"}. This section disappears once enough people submit.`}
                />
              ) : null}
            </div>
          </RecommendationsDisclosure>

          <AvailabilityForm
            action={submitAvailabilityAction}
            shareToken={session.shareToken}
            participantId={currentParticipant?.id}
            participantName={currentParticipant?.name}
            groupedSlots={groupedSlots}
            currentResponses={currentResponseRecord}
            compact={compactAvailability}
          />
        </div>

        <aside className="grid content-start gap-5">
          <section className="surface rounded-xl p-5">
            <h2 className="text-xl font-black text-ink">People</h2>
            <div className="mt-4 grid gap-3">
              {session.participants.length > 0 ? (
                session.participants.map((participant) => {
                  const responseCount = participant.responses.length;
                  return (
                    <div key={participant.id} className="rounded-lg border border-ink/10 bg-paper p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-ink">
                          {participant.name}
                          {participant.isHost ? <span className="ml-2 text-xs font-bold text-coral">Host</span> : null}
                        </p>
                        <p className="text-sm font-bold text-ink/60">
                          {responseCount}/{slots.length}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm leading-6 text-ink/60">No one has responded yet.</p>
              )}
            </div>
          </section>

          <section className="surface rounded-xl p-5">
            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={<UsersRound className="h-5 w-5" />} label="Players" value={`${totalPeople}`} />
              <InfoCard icon={<CalendarCheck className="h-5 w-5" />} label="Duration" value={`${session.requiredDuration}h`} />
              <InfoCard icon={<Gamepad2 className="h-5 w-5" />} label="Mode" value={session.mode === "ONLINE" ? "Online" : "In person"} />
              <InfoCard icon={<Lock className="h-5 w-5" />} label="Status" value={locked ? "Locked" : "Collecting"} />
            </div>
            {session.discordChannel ? (
              <div className="mt-4 rounded-lg border border-ink/10 bg-paper p-3">
                <p className="text-sm font-black text-ink">Discord</p>
                <p className="mt-1 text-sm text-ink/60">{session.discordChannel}</p>
              </div>
            ) : null}
          </section>
        </aside>
      </section>
      )}
    </main>
  );
}

function parseGroupBuyFilters({
  groupBudget,
  groupGenre,
  groupMode,
  groupLength,
  groupPlatform,
  avoidOwned,
  saleOnly,
  selectedPlayerCount,
}: {
  groupBudget?: string;
  groupGenre?: string;
  groupMode?: string;
  groupLength?: string;
  groupPlatform?: string;
  avoidOwned?: string;
  saleOnly?: string;
  selectedPlayerCount: number;
}) {
  const defaults = defaultGroupBuyFilters(selectedPlayerCount);

  return {
    budget: groupBudget ? Math.max(0, Math.round(Number(groupBudget) * 100)) : defaults.budget,
    genre: groupGenre ?? defaults.genre,
    playerCount: selectedPlayerCount,
    mode: groupMode === "local" || groupMode === "either" ? groupMode : defaults.mode,
    sessionLength: groupLength === "one-night" || groupLength === "long-term" || groupLength === "campaign" ? groupLength : defaults.sessionLength,
    platform: groupPlatform ?? defaults.platform,
    avoidOwned: avoidOwned !== "off",
    saleOnly: saleOnly === "on",
  };
}

function parseScoreMode(value?: string): ScoreMode {
  if (value === "coop" || value === "backlog" || value === "cheap" || value === "familiar" || value === "fresh") {
    return value;
  }

  return "balanced";
}

function normalizeSelectedParticipants(value: string | string[] | undefined, fallback: string[]) {
  if (!value) {
    return fallback;
  }

  const values = Array.isArray(value) ? value : value.split(",");
  const selected = values.flatMap((candidate) => candidate.split(",")).filter(Boolean);

  return selected.length > 0 ? selected : fallback;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  await Promise.race([
    promise.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function RecommendationList({
  title,
  empty,
  times,
  totalPeople,
  shareToken,
  timezone,
  tone,
  note,
}: {
  title: string;
  empty: string;
  times: Array<{
    startsAt: Date;
    endsAt: Date;
    availableCount: number;
    maybeCount: number;
    unavailableCount?: number;
    combinedCount?: number;
  }>;
  totalPeople: number;
  shareToken: string;
  timezone: string;
  tone: "available" | "maybe" | "shortfall";
  note?: string;
}) {
  const titleClass = {
    available: "text-moss",
    maybe: "text-gold",
    shortfall: "text-red-700",
  }[tone];
  const buttonClass = {
    available: "bg-moss hover:bg-[#346748] text-white",
    maybe: "bg-gold hover:bg-[#d59a20] text-ink",
    shortfall: "bg-red-700 hover:bg-red-800 text-white",
  }[tone];
  const cardClass = tone === "shortfall" ? "border-red-200 bg-red-50" : "border-ink/10 bg-paper";

  return (
    <div>
      <h3 className={`text-sm font-black uppercase tracking-[0.14em] ${titleClass}`}>{title}</h3>
      {note ? <p className="mt-1 text-xs font-bold leading-5 text-ink/50">{note}</p> : null}
      <div className="mt-3 grid gap-3">
        {times.length > 0 ? (
          times.map((time) => (
            <div key={time.startsAt.toISOString()} className={`rounded-lg border p-3 ${cardClass}`}>
              <p className="font-black text-ink">{formatSlotRange(time.startsAt, time.endsAt, timezone)}</p>
              <p className="mt-1 text-sm leading-6 text-ink/60">
                {tone === "available"
                  ? `${time.availableCount}/${totalPeople} available, ${time.maybeCount} maybe, ${time.unavailableCount ?? 0} unavailable`
                  : `${time.availableCount} available, ${time.maybeCount} maybe, ${time.combinedCount ?? time.availableCount + time.maybeCount}/${totalPeople} possible`}
              </p>
              <form action={lockSessionAction} className="mt-3">
                <input type="hidden" name="shareToken" value={shareToken} />
                <input type="hidden" name="startsAt" value={time.startsAt.toISOString()} />
                <input type="hidden" name="endsAt" value={time.endsAt.toISOString()} />
                <PendingSubmitButton
                  className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-black transition disabled:cursor-wait disabled:opacity-75 ${buttonClass}`}
                  pendingLabel="Locking..."
                >
                  {tone === "shortfall" ? "Lock anyway" : "Lock this time"}
                </PendingSubmitButton>
              </form>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-ink/20 bg-paper p-4 text-sm leading-6 text-ink/60">{empty}</div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper p-3">
      <div className="text-teal">{icon}</div>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-ink/40">{label}</p>
      <p className="mt-1 font-black text-ink">{value}</p>
    </div>
  );
}
