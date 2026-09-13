import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Download, Gamepad2, Lock, UsersRound } from "lucide-react";
import { joinPickWorkspaceAction, lockSessionAction, submitAvailabilityAction } from "@/app/actions";
import { AvailabilityForm } from "@/components/availability-form";
import { PickPanel } from "@/components/pick-panel";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PostImportStatus } from "@/components/post-import-status";
import { RecommendationsDisclosure } from "@/components/recommendations-disclosure";
import { SessionTabs } from "@/components/session-tabs";
import { SharePanel } from "@/components/share-panel";
import { getAppUrl } from "@/lib/app-url";
import { isActivePickUser, onboardingUrl, signInUrl } from "@/lib/accounts";
import { getCurrentUser, getParticipantId } from "@/lib/auth";
import { curatedGames } from "@/lib/curated-games";
import { commonMultiplayerGames, excludeExistingGames, rankSessionGames, searchGamesCatalog } from "@/lib/games";
import { defaultGroupBuyFilters, scoreGroupBuyCandidates } from "@/lib/group-buy";
import { getPopularIgdbGames, getTrendingIgdbGames, mapIgdbGame } from "@/lib/igdb";
import { scoreSessionGames } from "@/lib/match-scoring";
import { permittedPickParticipantIds } from "@/lib/pick/access";
import { parsePickQuery, serializePickQuery, type PickSearchParams } from "@/lib/pick/query";
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

export const metadata = { robots: { index: false, follow: false } };

type PageProps = {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<PickSearchParams & {
    participant?: string;
    tab?: string;
    gameSearch?: string;
    search?: string;
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
    imported?: string;
    sessionMinutes?: string;
    commitment?: string;
    selectionExplicit?: string;
    setup?: string;
  }>;
};

type RecommendationTime = BestTime & {
  combinedCount?: number;
};

export default async function SessionPage({ params, searchParams }: PageProps) {
  const { shareToken } = await params;
  const queryParams = await searchParams;
  const {
    gameSearch: legacyGameSearch,
    search,
    groupBudget,
    groupGenre,
    groupMode,
    groupLength,
    groupPlatform,
    avoidOwned,
    saleOnly,
    imported,
  } = queryParams;
  const gameSearch = search ?? legacyGameSearch;
  const justImportedCount = imported ? Math.max(0, Number(imported) || 0) : null;
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
      gameNight: {
        include: {
          workspaces: {
            select: { shareToken: true, workspaceType: true },
          },
        },
      },
    },
  });

  if (!session) {
    notFound();
  }

  const activeTab = session.workspaceType === "PICK" ? "pick" : "plan";
  const currentUser = await getCurrentUser();
  const activePickUser = isActivePickUser(currentUser);
  const cookieParticipantId = await getParticipantId(session.id);
  const accountParticipantId = session.participants.find((participant) => participant.userId === currentUser?.id)?.id;
  const participantId = activeTab === "pick"
    ? activePickUser ? accountParticipantId : undefined
    : accountParticipantId ?? session.participants.find((participant) => participant.id === cookieParticipantId)?.id;
  const canAccessPrivatePick = activeTab === "pick" && Boolean(currentUser && participantId && activePickUser);
  const appUrl = await getAppUrl();
  const shareUrl = session.gameNight
    ? `${appUrl}/n/${session.gameNight.shareToken}`
    : `${appUrl}/s/${session.shareToken}${activeTab === "pick" ? "?tab=pick" : ""}`;
  const planWorkspace = session.gameNight?.workspaces.find((workspace) => workspace.workspaceType === "PLAN");
  const pickWorkspace = session.gameNight?.workspaces.find((workspace) => workspace.workspaceType === "PICK");
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
  const permittedParticipantIdList = canAccessPrivatePick && currentUser
    ? await permittedPickParticipantIds({ viewerUserId: currentUser.id, participants: session.participants })
    : [];
  const parsedPickQuery = parsePickQuery(queryParams, {
    allowedParticipantIds: permittedParticipantIdList,
    defaultSelectedParticipantIds: permittedParticipantIdList,
    defaultPlayerCount: session.minimumPlayerCount,
    defaultSessionMinutes: session.requiredDuration * 60,
  });
  const selectedParticipantIds = parsedPickQuery.selectedParticipantIds;
  const selectedPlayerCount = parsedPickQuery.playerCount;
  const selectedSessionMinutes = parsedPickQuery.sessionMinutes;
  const selectedCommitment = parsedPickQuery.commitment;
  const activeScoreMode = parsedPickQuery.scoreMode;
  const defaultBuyFilters = defaultGroupBuyFilters(selectedPlayerCount);
  const groupBuyFilters = {
    ...parsedPickQuery.groupBuy,
    playerCount: selectedPlayerCount,
    budget: groupBudget === undefined ? defaultBuyFilters.budget : parsedPickQuery.groupBuy.budget,
    genre: groupGenre === undefined ? defaultBuyFilters.genre : parsedPickQuery.groupBuy.genre,
    mode: groupMode === undefined ? defaultBuyFilters.mode : parsedPickQuery.groupBuy.mode,
    sessionLength: groupLength === undefined ? defaultBuyFilters.sessionLength : parsedPickQuery.groupBuy.sessionLength,
    platform: groupPlatform === undefined ? defaultBuyFilters.platform : parsedPickQuery.groupBuy.platform,
    avoidOwned: avoidOwned === undefined ? defaultBuyFilters.avoidOwned : parsedPickQuery.groupBuy.avoidOwned,
    saleOnly: saleOnly === undefined ? defaultBuyFilters.saleOnly : parsedPickQuery.groupBuy.saleOnly,
  };
  const pickQuery = { ...parsedPickQuery, groupBuy: groupBuyFilters };
  const preservedPickParams = serializePickQuery(pickQuery);
  preservedPickParams.set("tab", "pick");
  const pickDestination = `/s/${shareToken}?${preservedPickParams.toString()}`;
  const [initialSessionGameRows, searchResults, popularGames, trendingGames] =
    canAccessPrivatePick
      ? await Promise.all([
          prisma.sessionGame.findMany({
            where: { sessionId: session.id },
            include: {
              game: { include: { steamStorePrice: true, deals: { where: { country: session.dealCountry }, take: 1 } } },
              signals: true,
              interests: true,
            },
          }),
          gameSearch ? searchGamesCatalog(gameSearch) : Promise.resolve([]),
          getPopularIgdbGames().then((games) => games.map(mapIgdbGame)),
          getTrendingIgdbGames().then((games) => games.map(mapIgdbGame)),
        ])
      : [[], [], [], []];
  const initialSessionGames = initialSessionGameRows.map((sessionGame) => ({
    ...sessionGame,
    game: {
      ...sessionGame.game,
      deal: sessionGame.game.deals[0] ?? null,
    },
  }));
  const sessionGames =
    activeTab === "pick"
      ? rankSessionGames(initialSessionGames)
      : [];
  const permittedParticipantIdsSet = new Set(permittedParticipantIdList);
  const participantUserIds = session.participants
    .filter((participant) => permittedParticipantIdsSet.has(participant.id))
    .map((participant) => participant.userId)
    .filter((userId): userId is string => Boolean(userId));
  const selectedUserIdSet = new Set(
    session.participants
      .filter((participant) => selectedParticipantIds.includes(participant.id))
      .map((participant) => participant.userId)
      .filter((userId): userId is string => Boolean(userId)),
  );
  const playtimeUserIds = [...new Set(participantUserIds)];
  const profileCandidateDbRows =
    canAccessPrivatePick && selectedUserIdSet.size > 0
      ? await prisma.userGame.findMany({
          where: {
            userId: { in: [...selectedUserIdSet] },
            OR: [
              { ownership: "HAVE" },
              { wishlist: true },
              { favourite: true },
              { rating: { gte: 7 } },
              { interest: "WANT_TO_PLAY" },
            ],
          },
          include: {
            game: { include: { steamStorePrice: true, deals: { where: { country: session.dealCountry }, take: 1 } } },
          },
          orderBy: [
            { favourite: "desc" },
            { rating: "desc" },
            { recentlyPlayedAt: "desc" },
            { playtimeMinutes: "desc" },
          ],
        })
      : [];
  const profileCandidateRows = profileCandidateDbRows.map((row) => ({
    ...row,
    game: { ...row.game, deal: row.game.deals[0] ?? null },
  }));
  const existingSessionGameIds = new Set(sessionGames.map((sessionGame) => sessionGame.gameId));
  const candidateGameIds = [...new Set(profileCandidateRows.map((userGame) => userGame.gameId))];
  const userGames =
    canAccessPrivatePick
      ? await prisma.userGame.findMany({
          where: {
            userId: { in: playtimeUserIds },
            gameId: {
              in: [...new Set([...sessionGames.map((sessionGame) => sessionGame.gameId), ...candidateGameIds])],
            },
          },
        })
      : [];
  const participantByUserId = new Map(
    session.participants.flatMap((participant) =>
      participant.userId ? [[participant.userId, participant] as const] : [],
    ),
  );
  const profileCandidates = [...new Set(candidateGameIds)]
    .filter((gameId) => !existingSessionGameIds.has(gameId))
    .map((gameId) => {
      const rows = profileCandidateRows.filter((row) => row.gameId === gameId);
      const game = rows[0]?.game;

      if (!game) {
        return null;
      }

      return {
        id: `profile:${gameId}`,
        sessionId: session.id,
        gameId,
        addedByParticipantId: null,
        addedByUserId: null,
        source: "PROFILE_MATCH",
        createdAt: new Date(0),
        updatedAt: new Date(0),
        game,
        signals: rows.flatMap((row) => {
          const participant = participantByUserId.get(row.userId);

          if (!participant || row.ownership === "UNKNOWN") {
            return [];
          }

          return [{
            id: `profile-signal:${row.id}`,
            sessionGameId: `profile:${gameId}`,
            participantId: participant.id,
            signal: row.ownership === "HAVE" ? "OWNED" : "NOT_AVAILABLE",
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }];
        }),
        interests: [],
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const scoringGames = [...sessionGames, ...profileCandidates];
  const scoredGames =
    activeTab === "pick"
      ? scoreSessionGames({
          sessionGames: scoringGames,
          participants: session.participants,
          userGames,
          selectedParticipantIds,
          playerCount: selectedPlayerCount,
          sessionMinutes: selectedSessionMinutes,
          commitment: selectedCommitment,
          mode: activeScoreMode,
          setup: parsedPickQuery.setup,
          selectionExplicit: parsedPickQuery.selectionExplicit,
        })
      : [];
  const [priceAlertEvents, latestFriendInvite, savedFriends, friendGroups] =
    canAccessPrivatePick
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
          currentUser
            ? prisma.friendGroup.findMany({
                where: { ownerId: currentUser.id },
                include: {
                  members: { select: { id: true, status: true } },
                  invites: {
                    where: { expiresAt: { gt: new Date() }, acceptedAt: null },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { token: true, expiresAt: true, acceptedAt: true },
                  },
                },
                orderBy: { updatedAt: "desc" },
                take: 5,
              })
            : Promise.resolve([]),
        ])
      : [[], null, [], []];
  const curatedSteamAppIds = curatedGames.map((game) => game.steamAppId).filter((steamAppId): steamAppId is number => Boolean(steamAppId));
  const curatedDbGames =
    canAccessPrivatePick
      ? await prisma.game.findMany({
          where: { steamAppId: { in: curatedSteamAppIds } },
          include: { deals: { where: { country: session.dealCountry }, take: 1 } },
        })
      : [];
  const groupBuyDeals = new Map(
    curatedDbGames
      .filter((game) => game.deals[0])
      .map((game) => [
        game.title,
        {
          currentPrice: game.deals[0]!.currentPrice,
          currency: game.deals[0]!.currency,
          discountPercent: game.deals[0]!.discountPercent,
        },
      ]),
  );
  const ownedGameIds = new Set(userGames.filter((userGame) => userGame.ownership === "HAVE").map((userGame) => userGame.gameId));
  const ownedTitles = [...profileCandidateRows, ...sessionGames.map((sessionGame) => ({ gameId: sessionGame.gameId, game: sessionGame.game }))]
    .filter((row) => ownedGameIds.has(row.gameId))
    .map((row) => row.game.title);
  const groupBuyRecommendations =
    canAccessPrivatePick
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
      <nav className="flex flex-wrap items-center justify-between gap-3 py-1.5">
        <Link href="/" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white shadow-card">
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

      {activeTab === "pick" ? (
        <section className="mt-4 flex flex-col gap-3 border-b border-ink/10 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal">Pick workspace</p>
            <h1 className="mt-1 text-3xl font-black text-ink sm:text-4xl">{session.title}</h1>
            <p className="mt-2 text-sm text-ink/60">
              {session.participants.length} {session.participants.length === 1 ? "player" : "players"} joined · {session.participants.filter((participant) => participant.user?.steamAccount).length} libraries connected
            </p>
          </div>
          <p className="rounded-md bg-gold/15 px-3 py-2 text-sm font-semibold text-ink">
            {session.participants.length < session.minimumPlayerCount
              ? `Early matching · ${session.participants.length} of ${session.minimumPlayerCount} players`
              : "Ready to compare"}
          </p>
        </section>
      ) : (
      <section className="relative mt-4 overflow-hidden rounded-xl border border-ink/10 bg-ink text-white shadow-soft">
        <Image src="/assets/game-night-hero.webp" alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/35" />
        <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_340px] lg:p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-gold">Game night</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">{session.title}</h1>
            <p className="mt-2 text-sm font-bold text-white/70">
              {session.mode === "ONLINE" ? "Online" : "In person"} - {session.requiredDuration} {session.requiredDuration === 1 ? "hour" : "hours"} - Min {session.minimumPlayerCount} players
            </p>
            {locked ? (
              <div className="mt-4 inline-flex flex-wrap items-center gap-3 rounded-lg bg-moss px-4 py-2.5 text-white">
                <Lock className="h-5 w-5" />
                <span className="font-black">
                  Locked: {formatSlotRange(session.lockedStartTime!, session.lockedEndTime!, session.timezone)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl bg-white/95 p-3 text-ink shadow-card backdrop-blur sm:p-4">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">{bestMatchLabel}</p>
            <h2 className="mt-1 text-2xl font-black leading-tight">
              {bestTimes[0]
                ? formatSlotRange(bestTimes[0].startsAt, bestTimes[0].endsAt, session.timezone)
                : maybeTimes[0]
                  ? formatSlotRange(maybeTimes[0].startsAt, maybeTimes[0].endsAt, session.timezone)
                  : "No good time yet"}
            </h2>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-linen">
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
      )}

      <SessionTabs
        shareToken={session.shareToken}
        participantId={participantId}
        activeTab={activeTab}
        planHref={planWorkspace ? `/s/${planWorkspace.shareToken}` : undefined}
        pickHref={pickWorkspace ? `/s/${pickWorkspace.shareToken}?tab=pick` : undefined}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm">
        <p className="font-medium text-ink/65">
          {currentParticipant ? (
            <>Responding as <strong className="text-ink">{currentParticipant.name}</strong> · Saved to this Game Night</>
          ) : activeTab === "pick" ? (
            currentUser
              ? <>Join this Pick workspace to see and contribute private group matches.</>
              : <>Sign in to join this Pick workspace. Steam is optional.</>
          ) : (
            <>Choose your name when you make your first response.</>
          )}
        </p>
        {currentParticipant && activeTab === "plan" ? <Link href={`/s/${session.shareToken}`} className="font-semibold text-teal">Switch participant</Link> : null}
      </div>

      {activeTab === "pick" && justImportedCount !== null ? (
        <PostImportStatus importedCount={justImportedCount} />
      ) : null}

      {activeTab === "pick" ? (
        canAccessPrivatePick ? <PickPanel
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
          selectedSessionMinutes={selectedSessionMinutes}
          selectedCommitment={selectedCommitment}
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
          friendGroups={friendGroups}
          libraryConnectionSummary={libraryConnectionSummary}
          isHost={isCurrentHost}
          selectedSessionGameId={session.gameNight?.selectedSessionGameId}
          query={pickQuery}
        /> : (
          <section className="surface mt-4 rounded-xl p-5">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">Private group matching</p>
            <h2 className="mt-2 text-2xl font-black text-ink">Join before viewing the group&apos;s games</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/62">
              Membership keeps ownership, ratings, playtime and recommendations inside this Pick workspace. You can join without connecting Steam.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!currentUser ? (
                <Link href={signInUrl(pickDestination)} className="primary-button">Sign in to join</Link>
              ) : !activePickUser ? (
                <Link href={onboardingUrl(pickDestination)} className="primary-button">Finish account setup</Link>
              ) : (
                <form action={joinPickWorkspaceAction}>
                  <input type="hidden" name="shareToken" value={session.shareToken} />
                  <input type="hidden" name="returnTo" value={pickDestination} />
                  <PendingSubmitButton className="primary-button" pendingLabel="Joining...">Join this Pick</PendingSubmitButton>
                </form>
              )}
            </div>
          </section>
        )
      ) : (
      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-4">
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
            revision={currentParticipant?.availabilityRevision ?? 0}
            groupedSlots={groupedSlots}
            currentResponses={currentResponseRecord}
            compact={compactAvailability}
          />
        </div>

        <aside className="grid content-start gap-4">
          <section className="surface rounded-xl p-4">
            <h2 className="text-xl font-black text-ink">People</h2>
            <div className="mt-3 grid gap-2">
              {session.participants.length > 0 ? (
                session.participants.map((participant) => {
                  const responseCount = participant.responses.length;
                  return (
                    <div key={participant.id} className="rounded-lg border border-ink/10 bg-paper p-2.5">
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

          <section className="surface rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={<UsersRound className="h-5 w-5" />} label="Players" value={`${totalPeople}`} />
              <InfoCard icon={<CalendarCheck className="h-5 w-5" />} label="Duration" value={`${session.requiredDuration}h`} />
              <InfoCard icon={<Gamepad2 className="h-5 w-5" />} label="Mode" value={session.mode === "ONLINE" ? "Online" : "In person"} />
              <InfoCard icon={<Lock className="h-5 w-5" />} label="Status" value={locked ? "Locked" : "Collecting"} />
            </div>
            {session.discordChannel ? (
              <div className="mt-3 rounded-lg border border-ink/10 bg-paper p-3">
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
