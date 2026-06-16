import { addDays, addHours, endOfMonth, endOfWeek, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type AvailabilityStatus = "AVAILABLE" | "MAYBE" | "UNAVAILABLE";

export type HourSlot = {
  startsAt: Date;
  endsAt: Date;
};

export type CandidateWindow = {
  startsAt: Date;
  endsAt: Date;
  slots: HourSlot[];
};

export type ParticipantAvailability = {
  participantId: string;
  name: string;
  responses: Map<string, AvailabilityStatus>;
};

export type BestTime = {
  startsAt: Date;
  endsAt: Date;
  availableCount: number;
  maybeCount: number;
  unavailableCount: number;
  meetsMinimum: boolean;
  score: number;
};

export type MaybeTime = BestTime & {
  combinedCount: number;
};

type WindowInput = {
  dateRangeStart: Date | string;
  dateRangeEnd: Date | string;
  dailyStartHour: number;
  dailyEndHour: number;
  weekendStartHour?: number | null;
  weekendEndHour?: number | null;
  requiredDuration: number;
  minimumPlayerCount?: number;
  timezone: string;
};

export type DatePreset = "tonight" | "this_week" | "this_month";

const hourKey = (date: Date) => date.toISOString();

const asDateKey = (value: Date | string, timezone: string) => {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return formatInTimeZone(value, timezone, "yyyy-MM-dd");
};

function isWeekendDayKey(dayKey: string) {
  const day = parseISO(`${dayKey}T00:00:00`).getDay();

  return day === 0 || day === 6;
}

function hoursForDay(input: WindowInput, dayKey: string) {
  if (isWeekendDayKey(dayKey) && input.weekendStartHour != null && input.weekendEndHour != null) {
    return {
      startHour: input.weekendStartHour,
      endHour: input.weekendEndHour,
    };
  }

  return {
    startHour: input.dailyStartHour,
    endHour: input.dailyEndHour,
  };
}

export function generateHourlySlots(input: WindowInput): HourSlot[] {
  const startKey = asDateKey(input.dateRangeStart, input.timezone);
  const endKey = asDateKey(input.dateRangeEnd, input.timezone);
  const slots: HourSlot[] = [];

  let cursor = parseISO(`${startKey}T00:00:00`);
  const lastDay = parseISO(`${endKey}T00:00:00`);

  while (cursor <= lastDay) {
    const dayKey = format(cursor, "yyyy-MM-dd");
    const { startHour, endHour } = hoursForDay(input, dayKey);

    for (let hour = startHour; hour < endHour; hour += 1) {
      const localStart = `${dayKey}T${String(hour).padStart(2, "0")}:00:00`;
      const startsAt = fromZonedTime(localStart, input.timezone);
      slots.push({
        startsAt,
        endsAt: addHours(startsAt, 1),
      });
    }

    cursor = addDays(cursor, 1);
  }

  return slots;
}

export function generateCandidateWindows(input: WindowInput): CandidateWindow[] {
  const slots = generateHourlySlots(input);
  const byDay = new Map<string, HourSlot[]>();

  for (const slot of slots) {
    const dayKey = formatInTimeZone(slot.startsAt, input.timezone, "yyyy-MM-dd");
    byDay.set(dayKey, [...(byDay.get(dayKey) ?? []), slot]);
  }

  return Array.from(byDay.values()).flatMap((daySlots) => {
    const sortedSlots = daySlots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const windows: CandidateWindow[] = [];

    for (let index = 0; index <= sortedSlots.length - input.requiredDuration; index += 1) {
      const windowSlots = sortedSlots.slice(index, index + input.requiredDuration);
      windows.push({
        startsAt: windowSlots[0].startsAt,
        endsAt: windowSlots[windowSlots.length - 1].endsAt,
        slots: windowSlots,
      });
    }

    return windows;
  });
}

function statusForWindow(participant: ParticipantAvailability, candidate: CandidateWindow) {
  const statuses = candidate.slots.map((slot) => participant.responses.get(hourKey(slot.startsAt)));

  if (statuses.some((status) => status === "UNAVAILABLE" || status === undefined)) {
    return "UNAVAILABLE";
  }

  if (statuses.some((status) => status === "MAYBE")) {
    return "MAYBE";
  }

  return "AVAILABLE";
}

export function rankBestTimes(
  input: WindowInput,
  participants: ParticipantAvailability[],
): BestTime[] {
  if (participants.length === 0) {
    return [];
  }

  const minimumPlayers = input.minimumPlayerCount ?? 1;

  return generateCandidateWindows(input)
    .map((candidate) => {
      const counts = participants.reduce(
        (total, participant) => {
          const status = statusForWindow(participant, candidate);
          total[status] += 1;
          return total;
        },
        { AVAILABLE: 0, MAYBE: 0, UNAVAILABLE: 0 },
      );

      return {
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
        availableCount: counts.AVAILABLE,
        maybeCount: counts.MAYBE,
        unavailableCount: counts.UNAVAILABLE,
        meetsMinimum: counts.AVAILABLE >= minimumPlayers,
        score: counts.AVAILABLE * 10 + counts.MAYBE * 3,
      };
    })
    .filter((time) => time.meetsMinimum)
    .sort((a, b) => {
      if (b.availableCount !== a.availableCount) {
        return b.availableCount - a.availableCount;
      }

      if (b.maybeCount !== a.maybeCount) {
        return b.maybeCount - a.maybeCount;
      }

      return a.startsAt.getTime() - b.startsAt.getTime();
    });
}

export function rankMaybeTimes(
  input: WindowInput,
  participants: ParticipantAvailability[],
): MaybeTime[] {
  if (participants.length === 0) {
    return [];
  }

  const minimumPlayers = input.minimumPlayerCount ?? 1;

  return generateCandidateWindows(input)
    .map((candidate) => {
      const counts = participants.reduce(
        (total, participant) => {
          const status = statusForWindow(participant, candidate);
          total[status] += 1;
          return total;
        },
        { AVAILABLE: 0, MAYBE: 0, UNAVAILABLE: 0 },
      );
      const combinedCount = counts.AVAILABLE + counts.MAYBE;

      return {
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
        availableCount: counts.AVAILABLE,
        maybeCount: counts.MAYBE,
        unavailableCount: counts.UNAVAILABLE,
        combinedCount,
        meetsMinimum: combinedCount >= minimumPlayers,
        score: counts.AVAILABLE * 10 + counts.MAYBE * 3,
      };
    })
    .filter((time) => time.meetsMinimum && time.availableCount < minimumPlayers)
    .sort((a, b) => {
      if (b.combinedCount !== a.combinedCount) {
        return b.combinedCount - a.combinedCount;
      }

      if (b.availableCount !== a.availableCount) {
        return b.availableCount - a.availableCount;
      }

      if (b.maybeCount !== a.maybeCount) {
        return b.maybeCount - a.maybeCount;
      }

      return a.startsAt.getTime() - b.startsAt.getTime();
    });
}

export function formatSlotRange(startsAt: Date, endsAt: Date, timezone: string) {
  const day = formatInTimeZone(startsAt, timezone, "EEE d MMM");
  const start = formatInTimeZone(startsAt, timezone, "HH:mm");
  const end = formatInTimeZone(endsAt, timezone, "HH:mm");

  return `${day}, ${start}-${end}`;
}

export function formatSlotDay(startsAt: Date, timezone: string) {
  return formatInTimeZone(startsAt, timezone, "d MMM - EEEE");
}

export function isWeekendSlot(startsAt: Date, timezone: string) {
  const dayName = formatInTimeZone(startsAt, timezone, "EEE");

  return dayName === "Sat" || dayName === "Sun";
}

export function formatSlotTime(startsAt: Date, endsAt: Date, timezone: string) {
  const start = formatInTimeZone(startsAt, timezone, "HH:mm");
  const end = formatInTimeZone(endsAt, timezone, "HH:mm");

  return `${start}-${end}`;
}

export function dateRangeFromPreset(preset: DatePreset, timezone: string, now = new Date()) {
  const todayKey = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const today = parseISO(`${todayKey}T00:00:00`);
  const end =
    preset === "tonight"
      ? today
      : preset === "this_week"
        ? endOfWeek(today, { weekStartsOn: 1 })
        : endOfMonth(today);

  return {
    startsOn: todayKey,
    endsOn: format(end, "yyyy-MM-dd"),
  };
}

export function responseMap(
  responses: Array<{ slotStart: Date; status: AvailabilityStatus }>,
) {
  return new Map(responses.map((response) => [hourKey(response.slotStart), response.status]));
}
