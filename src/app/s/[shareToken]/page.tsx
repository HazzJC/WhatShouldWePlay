import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Download, Gamepad2, Lock, UsersRound } from "lucide-react";
import { lockSessionAction, submitAvailabilityAction } from "@/app/actions";
import { AvailabilityForm } from "@/components/availability-form";
import { CopyLinkButton } from "@/components/copy-link-button";
import { getAppUrl } from "@/lib/app-url";
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
  searchParams: Promise<{ participant?: string }>;
};

type RecommendationTime = BestTime & {
  combinedCount?: number;
};

export default async function SessionPage({ params, searchParams }: PageProps) {
  const { shareToken } = await params;
  const { participant: participantId } = await searchParams;
  const session = await prisma.session.findUnique({
    where: { shareToken },
    include: {
      participants: {
        orderBy: [{ isHost: "desc" }, { createdAt: "asc" }],
        include: { responses: true },
      },
    },
  });

  if (!session) {
    notFound();
  }

  const appUrl = await getAppUrl();
  const shareUrl = `${appUrl}/s/${session.shareToken}`;
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
          <CopyLinkButton url={shareUrl} />
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
            <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">Best match</p>
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
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          <section className="surface rounded-xl p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-moss">Recommendations</p>
                <h2 className="mt-1 text-2xl font-black text-ink">Times worth locking</h2>
              </div>
              <p className="text-sm font-bold text-ink/60">Available first, maybes second</p>
            </div>
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
          </section>

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
                <button className={`focus-ring w-full rounded-md px-3 py-2 text-sm font-black transition ${buttonClass}`}>
                  {tone === "shortfall" ? "Lock anyway" : "Lock this time"}
                </button>
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
