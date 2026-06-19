"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { FormEvent } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, HelpCircle, X, type LucideIcon } from "lucide-react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
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
    shortLabel: "All in",
    Icon: Check,
    buttonClass: "border-moss/25 bg-moss/10 text-moss hover:bg-moss/15",
    selectedClass: "border-moss bg-moss text-white shadow-sm",
  },
  {
    value: "MAYBE",
    label: "Maybe",
    shortLabel: "Maybe",
    Icon: HelpCircle,
    buttonClass: "border-gold/35 bg-gold/10 text-ink hover:bg-gold/20",
    selectedClass: "border-gold bg-gold text-ink shadow-sm",
  },
  {
    value: "UNAVAILABLE",
    label: "Unavailable",
    shortLabel: "Out",
    Icon: X,
    buttonClass: "border-slate/20 bg-slate/10 text-slate hover:bg-slate/15",
    selectedClass: "border-slate bg-slate text-white shadow-sm",
  },
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
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [incompletePromptOpen, setIncompletePromptOpen] = useState(false);
  const [allowIncompleteSubmit, setAllowIncompleteSubmit] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const paintingStatus = useRef<AvailabilityStatus | null>(null);
  const allSlots = useMemo(() => groupedSlots.flatMap((group) => group.slots), [groupedSlots]);
  const allSlotKeys = allSlots.map((slot) => slot.key);
  const timeColumns = Array.from(new Set(allSlots.map((slot) => slot.time))).sort(
    (a, b) => timeStartMinutes(a) - timeStartMinutes(b),
  );
  const filledCount = allSlotKeys.filter((slotKey) => responses[slotKey]).length;
  const completionPercent = allSlotKeys.length > 0 ? Math.round((filledCount / allSlotKeys.length) * 100) : 0;
  const remainingCount = allSlotKeys.length - filledCount;
  const activeDay = groupedSlots[activeDayIndex] ?? groupedSlots[0];
  const activeDaySlotKeys = activeDay?.slots.map((slot) => slot.key) ?? [];
  const activeDayAnswered = activeDaySlotKeys.filter((slotKey) => responses[slotKey]).length;
  const desktopDayGridClass = compact
    ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
    : groupedSlots.length > 1
      ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      : "grid-cols-1";

  useEffect(() => {
    const clearPaint = () => {
      paintingStatus.current = null;
    };

    window.addEventListener("pointerup", clearPaint);
    return () => window.removeEventListener("pointerup", clearPaint);
  }, []);

  useEffect(() => {
    if (activeDayIndex > groupedSlots.length - 1) {
      setActiveDayIndex(Math.max(groupedSlots.length - 1, 0));
    }
  }, [activeDayIndex, groupedSlots.length]);

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
    if (allowIncompleteSubmit) {
      setAllowIncompleteSubmit(false);
      return;
    }

    const missingCount = allSlotKeys.length - Object.keys(responses).length;

    if (missingCount === 0) {
      return;
    }

    event.preventDefault();
    setIncompletePromptOpen(true);
  }

  function fillBlanksAndSubmit() {
    const missingSlotKeys = allSlotKeys.filter((slotKey) => !responses[slotKey]);
    setSlots(missingSlotKeys, "MAYBE");
    setAllowIncompleteSubmit(true);
    setIncompletePromptOpen(false);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="surface overflow-hidden rounded-xl">
      <input type="hidden" name="shareToken" value={shareToken} />
      {participantId ? <input type="hidden" name="participantId" value={participantId} /> : null}
      {Object.entries(responses).map(([slotKey, status]) => (
        <input key={slotKey} type="hidden" name={`status:${slotKey}`} value={status} />
      ))}

      <div className="sticky top-0 z-20 border-b border-ink/10 bg-white/95 p-4 backdrop-blur sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,0.7fr)_auto] lg:items-center">
          <label>
            <span className="sr-only">Your name</span>
            <input name="participantName" required maxLength={80} defaultValue={participantName ?? ""} placeholder="Your name" className="field mt-0" />
          </label>
          <div>
            <div className="h-2.5 overflow-hidden rounded-full bg-linen">
              <div
                className="h-full rounded-full bg-gradient-to-r from-coral via-gold to-teal transition-all duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs font-bold text-ink/60">
              {filledCount}/{allSlotKeys.length} times filled
            </p>
          </div>
          <PendingSubmitButton className="primary-button" pendingLabel="Saving...">
            Save availability
          </PendingSubmitButton>
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:p-4">
        <section className="lg:hidden" aria-label="Availability day wizard">
          {activeDay ? (
            <div className="rounded-xl border border-ink/10 bg-paper p-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDayIndex((index) => Math.max(index - 1, 0))}
                  disabled={activeDayIndex === 0}
                  className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-ink/10 bg-white text-ink disabled:opacity-35"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-teal">
                    Day {activeDayIndex + 1} of {groupedSlots.length}
                  </p>
                  <h2 className="truncate text-xl font-black text-ink">{activeDay.day}</h2>
                  <p className="text-sm font-bold text-ink/60">
                    {activeDayAnswered}/{activeDaySlotKeys.length} answered
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDayIndex((index) => Math.min(index + 1, groupedSlots.length - 1))}
                  disabled={activeDayIndex === groupedSlots.length - 1}
                  className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-ink/10 bg-white text-ink disabled:opacity-35"
                  aria-label="Next day"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSlots(activeDaySlotKeys, option.value)}
                    className={`focus-ring min-h-11 rounded-md border px-2 text-sm font-black transition ${option.buttonClass}`}
                  >
                    <option.Icon className="mx-auto h-4 w-4" />
                    <span className="mt-1 block">{option.shortLabel}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3">
                {activeDay.slots.map((slot) => (
                  <SlotEditor key={slot.key} slot={slot} status={responses[slot.key]} onSetSlot={(status) => setSlots([slot.key], status)} />
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-ink/10 bg-white p-3">
                <p className="text-sm font-black text-ink">Group overlap preview</p>
                <div className="mt-3 grid grid-cols-6 gap-1">
                  {activeDay.slots.slice(0, 12).map((slot) => (
                    <span key={slot.key} className={`h-8 rounded-md ${heatCellClass(slot, responses[slot.key])}`} title={`${slot.time}: ${slot.availableCount} available, ${slot.maybeCount} maybe`} />
                  ))}
                </div>
                <p className="mt-2 text-xs font-bold text-ink/55">Darker cells show stronger overlap from submitted availability.</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="hidden lg:block">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.14em] text-teal">Start broad</p>
              <h2 className="mt-1 text-xl font-black text-ink sm:text-2xl">Set whole days</h2>
            </div>
            {remainingCount > 0 ? (
              <button type="button" onClick={() => setSlots(allSlotKeys.filter((slotKey) => !responses[slotKey]), "MAYBE")} className="secondary-button">
                Fill blanks as maybe
              </button>
            ) : (
              <span className="rounded-md bg-moss px-3 py-2 text-sm font-black text-white">All days complete</span>
            )}
          </div>

          <div className={`mt-4 grid items-stretch gap-3 ${desktopDayGridClass}`}>
            {groupedSlots.map((group) => (
              <DayCard key={group.day} group={group} responses={responses} onSetDay={setSlots} onSetSlot={setSlots} />
            ))}
          </div>
        </section>

        <section className="hidden lg:block">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.14em] text-coral">Fine tune</p>
              <h2 className="mt-1 text-xl font-black text-ink sm:text-2xl">Availability heatmap</h2>
              <p className="mt-1 text-sm leading-6 text-ink/60">
                Click a cell to cycle your answer. Drag across cells to paint the same answer quickly.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-md bg-moss/10 px-2 py-1 text-moss">Available</span>
              <span className="rounded-md bg-gold/20 px-2 py-1 text-ink">Maybe</span>
              <span className="rounded-md bg-slate/10 px-2 py-1 text-slate">Out</span>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-ink/10 bg-ink p-2 shadow-inner">
            <div className="grid min-w-max gap-1" style={{ gridTemplateColumns: `8.5rem repeat(${timeColumns.length}, minmax(3.5rem, 1fr))` }}>
              <div />
              {timeColumns.map((time) => (
                <div key={time} className="px-1 py-1 text-center text-xs font-black text-white/60">
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

      <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-ink/10 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <p className="text-sm font-black text-ink">{completionPercent}% done</p>
        <PendingSubmitButton className="primary-button px-5 py-3" pendingLabel="Saving...">
          Save
        </PendingSubmitButton>
      </div>

      {incompletePromptOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/35 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="availability-incomplete-title">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-soft">
            <h2 id="availability-incomplete-title" className="text-xl font-black text-ink">Some times are blank</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              You left {remainingCount} of {allSlotKeys.length} times blank. Fill them as Maybe, or go back and review the missing times.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" className="primary-button" onClick={fillBlanksAndSubmit}>Fill blanks as Maybe</button>
              <button type="button" className="secondary-button" onClick={() => setIncompletePromptOpen(false)}>Review missing</button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function SlotEditor({
  slot,
  status,
  onSetSlot,
}: {
  slot: SlotView;
  status?: AvailabilityStatus;
  onSetSlot: (status: AvailabilityStatus) => void;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-black text-ink">{slot.time}</p>
        <p className="text-xs font-bold text-ink/50">
          {slot.availableCount + slot.maybeCount} possible
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {statusOptions.map((option) => {
          const selected = status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              title={option.label}
              onClick={() => onSetSlot(option.value)}
              className={`focus-ring flex min-h-12 items-center justify-center gap-1 rounded-md border text-sm font-black transition ${
                selected ? option.selectedClass : option.buttonClass
              }`}
            >
              <option.Icon className="h-4 w-4" />
              <span className="sr-only">{option.label}</span>
              <span aria-hidden="true">{option.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
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
      <div className="truncate rounded-md bg-white px-2 py-2 text-sm font-black text-ink" title={group.day}>
        {group.day.replace(/ \d+ /, " ")}
      </div>
      {timeColumns.map((time) => {
        const slot = group.slots.find((candidate) => candidate.time === time);
        if (!slot) {
          return <div key={`${group.day}-${time}`} className="rounded-md bg-white/20" />;
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
            className={`focus-ring min-h-10 rounded-md text-xs font-black transition hover:scale-[1.03] ${heatCellClass(slot, status)}`}
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
  responses,
  onSetDay,
  onSetSlot,
}: {
  group: DayView;
  responses: Record<string, AvailabilityStatus>;
  onSetDay: (slotKeys: string[], status: AvailabilityStatus) => void;
  onSetSlot: (slotKeys: string[], status: AvailabilityStatus) => void;
}) {
  const slotKeys = group.slots.map((slot) => slot.key);
  const answeredCount = slotKeys.filter((slotKey) => responses[slotKey]).length;
  const complete = answeredCount === slotKeys.length;

  return (
    <details className="group min-w-0 overflow-hidden rounded-xl border border-ink/10 bg-paper transition hover:shadow-card">
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-left text-base font-black text-ink" title={group.day}>
              {group.day}
            </h3>
            <p className="mt-0.5 text-left text-xs font-bold text-ink/60">
              {group.slots[0]?.time.split("-")[0]} - {group.slots.at(-1)?.time.split("-")[1]}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <span className={`rounded-md px-2 py-1 text-xs font-black ${complete ? "bg-moss text-white" : "bg-white text-ink/65"}`}>
              {complete ? "Done" : `${answeredCount}/${slotKeys.length}`}
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-md border border-ink/10 bg-white text-ink transition group-open:rotate-180" aria-hidden="true">
              <ChevronDown className="h-4 w-4" />
            </span>
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-teal transition-all duration-300" style={{ width: `${Math.round((answeredCount / slotKeys.length) * 100)}%` }} />
        </div>

        <p className="text-xs font-black uppercase tracking-[0.12em] text-teal">Edit individual slots</p>

        <div className="grid grid-cols-3 gap-2">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onSetDay(slotKeys, option.value);
              }}
              className={`focus-ring flex min-h-9 items-center justify-center gap-1 rounded-md border px-2 text-xs font-black transition ${option.buttonClass}`}
            >
              <option.Icon className="h-3.5 w-3.5" />
              <span>{option.shortLabel}</span>
            </button>
          ))}
        </div>
      </summary>

      <div className="grid gap-2 border-t border-ink/10 bg-white/70 p-3">
        {group.slots.map((slot) => (
          <SlotEditor key={slot.key} slot={slot} status={responses[slot.key]} onSetSlot={(status) => onSetSlot([slot.key], status)} />
        ))}
      </div>
    </details>
  );
}

function heatCellClass(slot: SlotView, status?: AvailabilityStatus) {
  if (status === "AVAILABLE") {
    return "bg-moss text-white ring-2 ring-white/35";
  }

  if (status === "MAYBE") {
    return "bg-gold text-ink ring-2 ring-white/35";
  }

  if (status === "UNAVAILABLE") {
    return "bg-slate text-white ring-2 ring-white/25";
  }

  const possible = slot.availableCount + slot.maybeCount;
  const ratio = slot.totalCount > 0 ? possible / slot.totalCount : 0;

  if (ratio >= 0.8) {
    return "bg-moss/80 text-white";
  }
  if (ratio >= 0.5) {
    return "bg-teal text-white";
  }
  if (ratio > 0) {
    return "bg-gold text-ink";
  }

  return "bg-white/10 text-white/60";
}

function timeStartMinutes(time: string) {
  const [hour = "0", minute = "0"] = time.split("-")[0].split(":");
  return Number(hour) * 60 + Number(minute);
}
