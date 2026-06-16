import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCheck,
  Download,
  Gamepad2,
  Lock,
  UsersRound,
} from "lucide-react";
import { lockSessionAction, submitAvailabilityAction } from "@/app/actions";
import { AvailabilityForm } from "@/components/availability-form";
import { CopyLinkButton } from "@/components/copy-link-button";
import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import {
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

export default async function SessionPage({ params, searchParams }: PageProps) {
  const { shareToken } = await params;
  const { participant: participantId } = await searchParams;
  const session = await prisma.session.findUnique({
    where: { shareToken },
    include: {
      participants: {
        orderBy: [{ isHost: "desc" }, { createdAt: "asc" }],
        include: {
          responses: true,
        },
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
  const compactAvailability = groupedSlots.length > 10;
  const currentResponseRecord = Object.fromEntries(currentResponses);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-8">
      <nav className="flex flex-wrap items-center justify-between gap-3 py-2">
        <Link href="/" className="font-semibold text-ink">
          Let&apos;s Play Games
        </Link>
        <div className="flex flex-wrap gap-2">
          <CopyLinkButton url={shareUrl} />
          {locked ? (
            <a
              href={`/s/${session.shareToken}/ics`}
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-black"
            >
              <Download className="h-4 w-4" />
              Download calendar invite
            </a>
          ) : null}
        </div>
      </nav>

      <section className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-[#111827] text-white shadow-soft">
          <div className="p-5">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">
              Game night
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-normal sm:text-5xl">{session.title}</h1>
            <p className="mt-3 text-sm font-semibold text-white/62">
              {session.mode === "ONLINE" ? "Online" : "In person"} • {session.requiredDuration} {session.requiredDuration === 1 ? "hour" : "hours"} • Min {session.minimumPlayerCount} players
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px bg-white/10">
            <InfoCard icon={<Gamepad2 className="h-5 w-5" />} label="Mode" value={session.mode === "ONLINE" ? "Online" : "In person"} tone="cyan" />
            <InfoCard icon={<UsersRound className="h-5 w-5" />} label="Minimum" value={`${session.minimumPlayerCount} available`} tone="emerald" />
            <InfoCard icon={<CalendarCheck className="h-5 w-5" />} label="Duration" value={`${session.requiredDuration} ${session.requiredDuration === 1 ? "hour" : "hours"}`} tone="amber" />
            <InfoCard icon={<Lock className="h-5 w-5" />} label="Status" value={locked ? "Locked" : "Collecting"} tone={locked ? "emerald" : "violet"} />
          </div>

          {locked ? (
            <div className="border-t border-white/10 bg-emerald-400 p-4 text-emerald-950">
              <p className="text-sm font-black uppercase tracking-[0.14em]">Locked time</p>
              <p className="mt-1 text-xl font-black">
                {formatSlotRange(session.lockedStartTime!, session.lockedEndTime!, session.timezone)}
              </p>
            </div>
          ) : null}
        </div>

        <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white/90 shadow-soft">
          <div className="bg-[#111827] p-5 text-white">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">
                Best match
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-normal">
                {bestTimes[0]
                  ? formatSlotRange(bestTimes[0].startsAt, bestTimes[0].endsAt, session.timezone)
                  : maybeTimes[0]
                    ? formatSlotRange(maybeTimes[0].startsAt, maybeTimes[0].endsAt, session.timezone)
                    : "No good time yet"}
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-white/70">
                Available matches first, then times that work if maybes can join.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-5">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-emerald-700">
                Available
              </h3>
              <div className="mt-2 grid gap-3">
            {bestTimes.length > 0 ? (
              bestTimes.map((time) => (
                <div key={time.startsAt.toISOString()} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${bestTimeClass(time.availableCount, totalPeople)}`}>
                  <div>
                    <p className="font-semibold text-ink">
                      {formatSlotRange(time.startsAt, time.endsAt, session.timezone)}
                    </p>
                    <p className="mt-1 text-sm text-ink/62">
                      {time.availableCount}/{totalPeople} available, {time.maybeCount} maybe, {time.unavailableCount} unavailable
                    </p>
                  </div>
                  <form action={lockSessionAction}>
                    <input type="hidden" name="shareToken" value={session.shareToken} />
                    <input type="hidden" name="startsAt" value={time.startsAt.toISOString()} />
                    <input type="hidden" name="endsAt" value={time.endsAt.toISOString()} />
                    <button className="focus-ring rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700">
                      Lock this time
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-ink/18 bg-paper p-4 text-sm leading-6 text-ink/64">
                No time has {session.minimumPlayerCount} confirmed available yet.
              </div>
            )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-amber-700">
                Including maybes
              </h3>
              <div className="mt-2 grid gap-3">
                {maybeTimes.length > 0 ? (
                  maybeTimes.map((time) => (
                    <div
                      key={time.startsAt.toISOString()}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-100 p-3"
                    >
                      <div>
                        <p className="font-semibold text-ink">
                          {formatSlotRange(time.startsAt, time.endsAt, session.timezone)}
                        </p>
                        <p className="mt-1 text-sm text-ink/62">
                          {time.availableCount} available, {time.maybeCount} maybe, {time.combinedCount}/{totalPeople} possible
                        </p>
                      </div>
                      <form action={lockSessionAction}>
                        <input type="hidden" name="shareToken" value={session.shareToken} />
                        <input type="hidden" name="startsAt" value={time.startsAt.toISOString()} />
                        <input type="hidden" name="endsAt" value={time.endsAt.toISOString()} />
                        <button className="focus-ring rounded-md bg-amber-500 px-3 py-2 text-sm font-bold text-amber-950 transition hover:bg-amber-400">
                          Lock this time
                        </button>
                      </form>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-yellow-300/70 bg-yellow-50/70 p-4 text-sm leading-6 text-ink/64">
                    No extra times become viable by counting maybes yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </section>

      <section
        className={`mt-6 grid gap-5 ${
          compactAvailability ? "" : "lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]"
        }`}
      >
        <AvailabilityForm
          action={submitAvailabilityAction}
          shareToken={session.shareToken}
          participantId={currentParticipant?.id}
          participantName={currentParticipant?.name}
          groupedSlots={groupedSlots}
          currentResponses={currentResponseRecord}
          compact={compactAvailability}
        />

        <aside className="rounded-lg border border-ink/10 bg-white/82 p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ink">People</h2>
          <div className="mt-4 grid gap-3">
            {session.participants.length > 0 ? (
              session.participants.map((participant) => {
                const responseCount = participant.responses.length;
                return (
                  <div key={participant.id} className="rounded-md border border-ink/10 bg-paper p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">
                        {participant.name}
                        {participant.isHost ? <span className="ml-2 text-xs font-medium text-ember">Host</span> : null}
                      </p>
                      <p className="text-sm text-ink/58">
                        {responseCount} / {slots.length}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm leading-6 text-ink/64">No one has responded yet.</p>
            )}
          </div>

          {session.discordChannel ? (
            <div className="mt-5 rounded-md border border-ink/10 bg-paper p-3">
              <p className="text-sm font-semibold text-ink">Discord</p>
              <p className="mt-1 text-sm text-ink/62">{session.discordChannel}</p>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function bestTimeClass(availableCount: number, totalPeople: number) {
  if (totalPeople > 0 && availableCount === totalPeople) {
    return "border-emerald-400 bg-emerald-100";
  }

  if (totalPeople > 0 && availableCount / totalPeople >= 0.75) {
    return "border-cyan-400 bg-cyan-100";
  }

  return "border-violet-300 bg-violet-100";
}

function InfoCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "amber" | "violet";
}) {
  const toneClass = {
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
  }[tone];

  return (
    <div className="bg-white/[0.06] p-4">
      <div className={toneClass}>{icon}</div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}
