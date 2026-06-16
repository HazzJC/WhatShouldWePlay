"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { FormEvent } from "react";
import { Check, HelpCircle, X, type LucideIcon } from "lucide-react";
import type { AvailabilityStatus } from "@/lib/scheduling";

type SlotView = {
  key: string;
  time: string;
  availableCount: number;
  maybeCount: number;
  totalCount: number;
};

type DayView = {
  day: string;
  toneIndex: number;
  isWeekend: boolean;
  slots: SlotView[];
};

type AvailabilityFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  shareToken: string;
  participantId?: string;
  participantName?: string;
  groupedSlots: DayView[];
  currentResponses: Record<string, AvailabilityStatus>;
  compact: boolean;
};

const statusOptions: Array<{
  value: AvailabilityStatus;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  buttonClass: string;
  selectedClass: string;
}> = [
  {
    value: "AVAILABLE",
    label: "Available",
    shortLabel: "All",
    Icon: Check,
    buttonClass: "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    selectedClass: "border-emerald-600 bg-emerald-500 text-white shadow-sm",
  },
  {
    value: "MAYBE",
    label: "Maybe",
    shortLabel: "Maybe",
    Icon: HelpCircle,
    buttonClass: "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
    selectedClass: "border-amber-500 bg-amber-400 text-amber-950 shadow-sm",
  },
  {
    value: "UNAVAILABLE",
    label: "Unavailable",
    shortLabel: "Out",
    Icon: X,
    buttonClass: "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100",
    selectedClass: "border-slate-900 bg-slate-900 text-white shadow-sm",
  },
];

const dayToneClasses = [
  "border-sky-300 bg-gradient-to-br from-sky-100 to-white",
  "border-emerald-300 bg-gradient-to-br from-emerald-100 to-white",
  "border-amber-300 bg-gradient-to-br from-amber-100 to-white",
  "border-cyan-300 bg-gradient-to-br from-cyan-100 to-white",
  "border-violet-300 bg-gradient-to-br from-violet-100 to-white",
  "border-orange-300 bg-gradient-to-br from-orange-100 to-white",
  "border-rose-300 bg-gradient-to-br from-rose-100 to-white",
];

const nextStatus: Record<AvailabilityStatus | "EMPTY", AvailabilityStatus> = {
  EMPTY: "AVAILABLE",
  AVAILABLE: "MAYBE",
  MAYBE: "UNAVAILABLE",
  UNAVAILABLE: "AVAILABLE",
};

export function AvailabilityForm({
  action,
  shareToken,
  participantId,
  participantName,
  groupedSlots,
  currentResponses,
  compact,
}: AvailabilityFormProps) {
  const [responses, setResponses] = useState<Record<string, AvailabilityStatus>>(currentResponses);
  const paintingStatus = useRef<AvailabilityStatus | null>(null);
  const allSlots = useMemo(() => groupedSlots.flatMap((group) => group.slots), [groupedSlots]);
  const allSlotKeys = allSlots.map((slot) => slot.key);
  const timeColumns = Array.from(new Set(allSlots.map((slot) => slot.time))).sort(
    (a, b) => timeStartMinutes(a) - timeStartMinutes(b),
  );
  const filledCount = allSlotKeys.filter((slotKey) => responses[slotKey]).length;
  const completionPercent = allSlotKeys.length > 0 ? Math.round((filledCount / allSlotKeys.length) * 100) : 0;
  const remainingCount = allSlotKeys.length - filledCount;
  const dayGridClass = compact
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    : groupedSlots.length > 1
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      : "grid-cols-1";

  useEffect(() => {
    const clearPaint = () => {
      paintingStatus.current = null;
    };

    window.addEventListener("pointerup", clearPaint);
    return () => window.removeEventListener("pointerup", clearPaint);
  }, []);

  function setSlots(slotKeys: string[], status: AvailabilityStatus) {
    setResponses((current) => {
      const next = { ...current };
      for (const slotKey of slotKeys) {
        next[slotKey] = status;
      }
      return next;
    });
  }

  function cycleSlot(slotKey: string) {
    setResponses((current) => ({
      ...current,
      [slotKey]: nextStatus[current[slotKey] ?? "EMPTY"],
    }));
  }

  function paintSlot(slotKey: string) {
    if (!paintingStatus.current) {
      return;
    }

    setResponses((current) => ({
      ...current,
      [slotKey]: paintingStatus.current!,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const missingCount = allSlotKeys.length - Object.keys(responses).length;

    if (missingCount === 0) {
      return;
    }

    event.preventDefault();

    const fillRemaining = window.confirm(
      `You have not filled in ${missingCount} of ${allSlotKeys.length} times. Fill the remaining times with Maybe?`,
    );

    if (!fillRemaining) {
      return;
    }

    const missingSlotKeys = allSlotKeys.filter((slotKey) => !responses[slotKey]);
    setSlots(missingSlotKeys, "MAYBE");
    window.setTimeout(() => event.currentTarget.requestSubmit(), 0);
  }

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl border border-ink/10 bg-white/90 shadow-soft backdrop-blur"
    >
      <input type="hidden" name="shareToken" value={shareToken} />
      {participantId ? <input type="hidden" name="participantId" value={participantId} /> : null}
      {Object.entries(responses).map(([slotKey, status]) => (
        <input key={slotKey} type="hidden" name={`status:${slotKey}`} value={status} />
      ))}

      <div className="sticky top-0 z-10 border-b border-ink/10 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-56 flex-1">
            <span className="sr-only">Your name</span>
            <input
              name="participantName"
              required
              maxLength={80}
              defaultValue={participantName ?? ""}
              placeholder="Your name"
              className="focus-ring w-full rounded-md border border-ink/12 bg-paper px-3 py-2.5 text-sm font-medium text-ink"
            />
          </label>
          <div className="min-w-36 flex-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-400 transition-all duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs font-medium text-ink/58">
              {filledCount}/{allSlotKeys.length} times filled
            </p>
          </div>
          <button className="focus-ring rounded-md bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:scale-[1.01] hover:from-violet-700 hover:to-cyan-700">
            Save
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-5">
        <section className="rounded-xl bg-[#111827] p-3 text-white shadow-soft">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-black">Set whole days</h2>
              <p className="mt-1 text-sm text-white/65">Start broad, then fine-tune below.</p>
            </div>
            {remainingCount > 0 ? (
              <button
                type="button"
                onClick={() => setSlots(allSlotKeys.filter((slotKey) => !responses[slotKey]), "MAYBE")}
                className="focus-ring rounded-md border border-amber-300 bg-amber-300 px-3 py-2 text-sm font-black text-amber-950 transition hover:scale-[1.02] hover:bg-amber-200"
              >
                Fill blanks as maybe
              </button>
            ) : (
              <span className="rounded-full bg-emerald-400 px-3 py-2 text-sm font-black text-emerald-950">
                All days complete
              </span>
            )}
          </div>

          <div className={`mt-3 grid items-stretch gap-3 ${dayGridClass}`}>
            {groupedSlots.map((group) => (
              <DayCard
                key={group.day}
                group={group}
                compact={compact}
                responses={responses}
                onSetDay={setSlots}
                onSetSlot={setSlots}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-ink">Availability heatmap</h2>
              <p className="mt-1 text-sm text-ink/60">
                Click a cell to cycle your answer. Drag over cells to paint the same answer.
              </p>
            </div>
            <div className="flex gap-2 text-xs font-semibold text-ink/62">
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Available</span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">Maybe</span>
              <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-700">Out</span>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-ink/10 bg-[#101828] p-2 shadow-inner">
            <div
              className="grid min-w-max gap-1"
              style={{ gridTemplateColumns: `8.5rem repeat(${timeColumns.length}, minmax(3.5rem, 1fr))` }}
            >
              <div />
              {timeColumns.map((time) => (
                <div key={time} className="px-1 py-1 text-center text-xs font-bold text-white/65">
                  {time.split("-")[0]}
                </div>
              ))}

              {groupedSlots.map((group) => (
                <HeatmapRow
                  key={group.day}
                  group={group}
                  timeColumns={timeColumns}
                  responses={responses}
                  onCycle={cycleSlot}
                  onPaint={paintSlot}
                  paintingStatus={paintingStatus}
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-ink/8 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
        <p className="text-sm font-bold text-ink">{completionPercent}% done</p>
        <button className="focus-ring rounded-md bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white">
          Save
        </button>
      </div>
    </form>
  );
}

function HeatmapRow({
  group,
  timeColumns,
  responses,
  onCycle,
  onPaint,
  paintingStatus,
}: {
  group: DayView;
  timeColumns: string[];
  responses: Record<string, AvailabilityStatus>;
  onCycle: (slotKey: string) => void;
  onPaint: (slotKey: string) => void;
  paintingStatus: MutableRefObject<AvailabilityStatus | null>;
}) {
  return (
    <>
      <div
        className={`truncate rounded-md px-2 py-2 text-sm font-semibold text-ink ${
          group.isWeekend ? "bg-orange-400 text-white" : "bg-white/95"
        }`}
        title={group.day}
      >
        {group.day.replace(/ \d+ /, " ")}
      </div>
      {timeColumns.map((time) => {
        const slot = group.slots.find((candidate) => candidate.time === time);
        if (!slot) {
          return <div key={`${group.day}-${time}`} className="rounded-md bg-white/40" />;
        }

        const status = responses[slot.key];
        return (
          <button
            key={slot.key}
            type="button"
            title={`${group.day}, ${slot.time}: ${slot.availableCount} available, ${slot.maybeCount} maybe`}
            onPointerDown={() => {
              const next = nextStatus[status ?? "EMPTY"];
              paintingStatus.current = next;
              onCycle(slot.key);
            }}
            onPointerEnter={() => onPaint(slot.key)}
            className={`focus-ring min-h-10 rounded-md text-xs font-black transition hover:scale-[1.04] ${heatCellClass(
              slot,
              status,
            )}`}
          >
            {slot.availableCount + slot.maybeCount}
          </button>
        );
      })}
    </>
  );
}

function DayCard({
  group,
  compact,
  responses,
  onSetDay,
  onSetSlot,
}: {
  group: DayView;
  compact: boolean;
  responses: Record<string, AvailabilityStatus>;
  onSetDay: (slotKeys: string[], status: AvailabilityStatus) => void;
  onSetSlot: (slotKeys: string[], status: AvailabilityStatus) => void;
}) {
  const slotKeys = group.slots.map((slot) => slot.key);
  const answeredCount = slotKeys.filter((slotKey) => responses[slotKey]).length;
  const complete = answeredCount === slotKeys.length;
  const selectedCounts = slotKeys.reduce(
    (counts, slotKey) => {
      const status = responses[slotKey];
      if (status) {
        counts[status] += 1;
      }
      return counts;
    },
    { AVAILABLE: 0, MAYBE: 0, UNAVAILABLE: 0 },
  );
  const dominantStatus =
    selectedCounts.AVAILABLE >= selectedCounts.MAYBE &&
    selectedCounts.AVAILABLE >= selectedCounts.UNAVAILABLE
      ? "AVAILABLE"
      : selectedCounts.MAYBE >= selectedCounts.UNAVAILABLE
        ? "MAYBE"
        : "UNAVAILABLE";

  return (
    <details
      className={`group min-w-0 overflow-hidden rounded-xl border transition duration-200 hover:-translate-y-0.5 hover:shadow-soft ${
        complete
          ? `${dominantCardClass(dominantStatus)} ring-2 ring-white/35`
          : (dayToneClasses[group.toneIndex] ?? "border-ink/10 bg-paper")
      }`}
    >
      <summary className="flex cursor-pointer list-none flex-col gap-2 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`truncate text-left text-sm font-black ${complete ? "text-white" : "text-ink"}`} title={group.day}>
              {group.day}
            </h3>
            <p className={`mt-0.5 text-left text-[11px] font-bold ${complete ? "text-white/75" : "text-ink/55"}`}>
              {group.slots[0]?.time.split("-")[0]} - {group.slots.at(-1)?.time.split("-")[1]}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${complete ? "bg-white text-ink" : pillClass(dominantStatus)}`}>
            {complete ? "Done" : `${answeredCount}/${slotKeys.length}`}
          </span>
        </div>

        <div className={`h-1.5 overflow-hidden rounded-full ${complete ? "bg-white/25" : "bg-ink/10"}`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressClass(dominantStatus)}`}
            style={{ width: `${Math.round((answeredCount / slotKeys.length) * 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onSetDay(slotKeys, option.value);
              }}
              className={`focus-ring flex min-h-8 items-center justify-center gap-1 rounded-md border px-1.5 text-xs font-black transition hover:scale-[1.03] ${
                complete ? wholeDayButtonOnComplete(option.value, dominantStatus) : option.buttonClass
              }`}
            >
              <option.Icon className="h-3.5 w-3.5" />
              <span>{option.shortLabel}</span>
            </button>
          ))}
        </div>
      </summary>

      <div className={`${compact ? "gap-2" : "gap-2"} grid border-t border-white/20 bg-white/80 p-3`}>
        {group.slots.map((slot) => (
          <div key={slot.key} className="grid grid-cols-[4.25rem_1fr] items-center gap-2 rounded-md bg-white p-2 shadow-sm">
            <p className="text-sm font-semibold text-ink">{slot.time}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {statusOptions.map((option) => {
                const selected = responses[slot.key] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    onClick={() => onSetSlot([slot.key], option.value)}
                    className={`focus-ring flex min-h-9 items-center justify-center rounded-md border transition ${
                      selected ? option.selectedClass : option.buttonClass
                    }`}
                  >
                    <option.Icon className="h-4 w-4" />
                    <span className="sr-only">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function heatCellClass(slot: SlotView, status?: AvailabilityStatus) {
  if (status === "AVAILABLE") {
    return "bg-emerald-500 text-white ring-2 ring-emerald-300/50";
  }

  if (status === "MAYBE") {
    return "bg-amber-400 text-amber-950 ring-2 ring-amber-200/60";
  }

  if (status === "UNAVAILABLE") {
    return "bg-slate-950 text-white ring-2 ring-slate-500/40";
  }

  const possible = slot.availableCount + slot.maybeCount;
  const ratio = slot.totalCount > 0 ? possible / slot.totalCount : 0;

  if (ratio >= 0.8) {
    return "bg-emerald-400 text-emerald-950";
  }
  if (ratio >= 0.5) {
    return "bg-cyan-400 text-cyan-950";
  }
  if (ratio > 0) {
    return "bg-amber-300 text-amber-950";
  }

  return "bg-white/10 text-white/55";
}

function pillClass(status: AvailabilityStatus) {
  if (status === "AVAILABLE") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "MAYBE") {
    return "bg-amber-100 text-amber-900";
  }
  return "bg-slate-200 text-slate-700";
}

function progressClass(status: AvailabilityStatus) {
  if (status === "AVAILABLE") {
    return "bg-emerald-400";
  }
  if (status === "MAYBE") {
    return "bg-amber-300";
  }
  return "bg-slate-800";
}

function dominantCardClass(status: AvailabilityStatus) {
  if (status === "AVAILABLE") {
    return "border-emerald-300 bg-gradient-to-br from-emerald-500 to-teal-600";
  }
  if (status === "MAYBE") {
    return "border-amber-300 bg-gradient-to-br from-amber-400 to-orange-500";
  }
  return "border-slate-500 bg-gradient-to-br from-slate-800 to-slate-950";
}

function wholeDayButtonOnComplete(option: AvailabilityStatus, dominant: AvailabilityStatus) {
  if (option === dominant) {
    if (option === "AVAILABLE") {
      return "border-white/60 bg-white text-emerald-700";
    }
    if (option === "MAYBE") {
      return "border-white/60 bg-white text-amber-700";
    }
    return "border-white/60 bg-white text-slate-900";
  }

  return "border-white/20 bg-white/10 text-white hover:bg-white/20";
}

function timeStartMinutes(time: string) {
  const [hour = "0", minute = "0"] = time.split("-")[0].split(":");

  return Number(hour) * 60 + Number(minute);
}
