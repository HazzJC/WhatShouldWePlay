"use client";

import { useState } from "react";

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const finishHours = Array.from({ length: 24 }, (_, index) => index + 1);

export function PlanDateOptions() {
  const [preset, setPreset] = useState("this_week");
  const [separateWeekend, setSeparateWeekend] = useState(false);

  return (
    <>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Dates</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["tonight", "Tonight", "Just today"],
            ["this_week", "This week", "Today through Sunday"],
            ["this_month", "This month", "Rest of this month"],
            ["custom", "Custom dates", "Choose a range"],
          ].map(([value, label, description]) => (
            <label key={value} className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tide rounded-md border border-ink/10 bg-paper p-3 text-ink transition has-[:checked]:border-teal has-[:checked]:bg-teal has-[:checked]:text-white">
              <input name="datePreset" type="radio" value={value} checked={preset === value} onChange={() => setPreset(value)} className="sr-only" />
              <span className="block font-semibold">{label}</span>
              <span className="mt-1 block text-sm opacity-75">{description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {preset === "custom" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="text-sm font-semibold text-ink">Starts</span><input name="customStartDate" type="date" required className="field" /></label>
          <label><span className="text-sm font-semibold text-ink">Ends</span><input name="customEndDate" type="date" required className="field" /></label>
        </div>
      ) : null}

      <fieldset className="rounded-md border border-ink/10 bg-paper p-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <input name="separateWeekendTimes" type="checkbox" checked={separateWeekend} onChange={(event) => setSeparateWeekend(event.currentTarget.checked)} className="h-4 w-4 accent-teal" />
          Use different times on weekends
        </label>
        {separateWeekend ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <HourField name="weekendStartHour" label="Weekend start" defaultValue="14" values={hours} />
            <HourField name="weekendEndHour" label="Weekend finish" defaultValue="23" values={finishHours} />
          </div>
        ) : null}
      </fieldset>
    </>
  );
}

export function PlanReminderOptions() {
  const [enabled, setEnabled] = useState(false);
  const [custom, setCustom] = useState(false);

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">Reminders</legend>
      <label className="mt-2 flex items-center justify-between gap-4 rounded-md border border-ink/10 bg-paper p-3">
        <span>
          <span className="block text-sm font-semibold text-ink">Send Discord reminders</span>
          <span className="mt-1 block text-xs text-ink/50">Available when this Game Night is linked to Discord.</span>
        </span>
        <input name="remindersEnabled" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} className="h-5 w-5 accent-teal" />
      </label>
      {enabled ? (
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap gap-2">
            {["24 hours before", "2 hours before", "15 minutes before"].map((label) => (
              <label key={label} className="inline-flex items-center gap-2 rounded-md border border-ink/10 bg-paper px-3 py-2 text-sm font-medium text-ink">
                <input name="reminders" type="checkbox" value={label} className="h-4 w-4 accent-teal" />
                {label}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setCustom((value) => !value)} className="secondary-button w-fit px-3 py-2">
            {custom ? "Remove custom reminder" : "Add custom reminder"}
          </button>
          {custom ? (
            <label>
              <span className="text-sm font-semibold text-ink">Minutes before</span>
              <input name="customReminderMinutes" min={1} max={10080} type="number" required className="field max-w-xs" />
            </label>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

function HourField({ name, label, defaultValue, values }: { name: string; label: string; defaultValue: string; values: number[] }) {
  return (
    <label>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <select name={name} defaultValue={defaultValue} className="field">
        {values.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
      </select>
    </label>
  );
}
