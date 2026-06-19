import Link from "next/link";
import { ArrowLeft, Bell, CalendarPlus, Clock3, Gamepad2, UsersRound } from "lucide-react";
import { createSessionAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

const defaultTimezone = "Europe/London";
const hours = Array.from({ length: 24 }, (_, hour) => hour);
const finishHours = Array.from({ length: 24 }, (_, index) => index + 1);

function supportedTimezones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported("timeZone") : [];

  if (zones.length > 0) {
    return zones.includes(defaultTimezone) ? zones : [defaultTimezone, ...zones];
  }

  return [defaultTimezone, "Europe/Dublin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"];
}

const timezones = supportedTimezones();

export default function NewSessionPage() {
  return (
    <main className="ui-shell pb-24 sm:pb-8">
      <Link href="/" className="secondary-button px-3 py-2">
        <ArrowLeft className="h-4 w-4" />
        Let&apos;s Play Games
      </Link>

      <form action={createSessionAction} className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="surface rounded-xl p-4 lg:sticky lg:top-4 lg:self-start">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Planner</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-ink sm:text-4xl">Plan a game night</h1>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Set the basics, choose the time window, and share one link with everyone.
          </p>
          <div className="mt-4 grid gap-2 text-sm font-bold text-ink/70">
            <Step icon={<Gamepad2 className="h-4 w-4" />} label="Basics" />
            <Step icon={<Clock3 className="h-4 w-4" />} label="Timing" />
            <Step icon={<UsersRound className="h-4 w-4" />} label="Players" />
            <Step icon={<Bell className="h-4 w-4" />} label="Optional details" />
          </div>
        </aside>

        <div className="grid gap-4">
          <Panel title="Basics" eyebrow="Step 1">
            <label>
              <span className="text-sm font-bold text-ink">Session name</span>
              <input name="title" required minLength={2} maxLength={120} defaultValue="Game night" className="field" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-bold text-ink">Your name</span>
                <input name="hostName" required maxLength={80} placeholder="Alex" className="field" />
              </label>
              <label>
                <span className="text-sm font-bold text-ink">Location</span>
                <select name="mode" defaultValue="ONLINE" className="field">
                  <option value="ONLINE">Online</option>
                  <option value="IN_PERSON">In person</option>
                </select>
              </label>
            </div>
          </Panel>

          <Panel title="Timing" eyebrow="Step 2">
            <fieldset>
              <legend className="sr-only">Date range</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["tonight", "Tonight", "Just today"],
                  ["this_week", "This week", "Today through Sunday"],
                  ["this_month", "This month", "The rest of this month"],
                ].map(([value, label, description]) => (
                  <label
                    key={value}
                    className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tide rounded-lg border border-ink/10 bg-paper p-3 text-ink transition has-[:checked]:border-teal has-[:checked]:bg-teal has-[:checked]:text-white"
                  >
                    <input name="datePreset" type="radio" value={value} defaultChecked={value === "this_week"} className="sr-only" />
                    <span className="block font-black">{label}</span>
                    <span className="mt-1 block text-sm opacity-75">{description}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr]">
              <HourSelect name="dailyStartHour" label="Weekday start" defaultValue="18" values={hours} />
              <HourSelect name="dailyEndHour" label="Weekday finish" defaultValue="23" values={finishHours} />
              <label>
                <span className="text-sm font-bold text-ink">Timezone</span>
                <select name="timezone" required defaultValue={defaultTimezone} className="field">
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="rounded-lg border border-ink/10 bg-paper p-3">
              <label className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                <input name="separateWeekendTimes" type="checkbox" className="h-4 w-4 accent-teal" />
                Use different times on weekends
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <HourSelect name="weekendStartHour" label="Weekend start" defaultValue="14" values={hours} />
                <HourSelect name="weekendEndHour" label="Weekend finish" defaultValue="23" values={finishHours} />
              </div>
            </fieldset>
          </Panel>

          <Panel title="Players" eyebrow="Step 3">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-bold text-ink">Duration</span>
                <select name="requiredDuration" defaultValue="2" className="field">
                  {[1, 2, 3, 4, 5, 6].map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} {duration === 1 ? "hour" : "hours"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-bold text-ink">Minimum players</span>
                <input name="minimumPlayerCount" required min={2} max={30} type="number" defaultValue={4} className="field" />
              </label>
            </div>
            <p className="text-sm leading-6 text-ink/60">
              Recommendations appear when at least this many people are available.
            </p>
          </Panel>

          <Panel title="Optional details" eyebrow="Step 4">
            <label>
              <span className="text-sm font-bold text-ink">Discord channel</span>
              <input name="discordChannel" maxLength={120} placeholder="#game-night" className="field" />
            </label>
            <fieldset>
              <legend className="text-sm font-bold text-ink">Reminder preferences</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {["No reminders", "24 hours before", "2 hours before", "15 minutes before"].map((label) => (
                  <label key={label} className="inline-flex items-center gap-2 rounded-md border border-ink/10 bg-paper px-3 py-2 text-sm font-bold text-ink">
                    <input name="reminders" type={label === "No reminders" ? "radio" : "checkbox"} value={label} className="h-4 w-4 accent-teal" />
                    {label}
                  </label>
                ))}
              </div>
              <label className="mt-3 block">
                <span className="text-sm font-bold text-ink">Custom reminder minutes before</span>
                <input name="customReminderMinutes" min={1} max={10080} type="number" placeholder="Optional" className="field" />
              </label>
              <p className="mt-2 text-xs font-bold leading-5 text-ink/50">
                Discord reminders are sent only for sessions linked to a Discord channel.
              </p>
            </fieldset>
          </Panel>

          <div className="sticky bottom-0 z-20 -mx-3 border-t border-ink/10 bg-paper/95 p-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <PendingSubmitButton className="primary-button w-full py-3 text-base sm:w-auto" pendingLabel="Creating...">
              <CalendarPlus className="h-5 w-5" />
              Create share link
            </PendingSubmitButton>
          </div>
        </div>
      </form>
    </main>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-xl p-4 sm:p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black text-ink">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function Step({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-paper px-3 py-2">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-teal/10 text-teal">{icon}</span>
      {label}
    </div>
  );
}

function HourSelect({
  name,
  label,
  defaultValue,
  values,
}: {
  name: string;
  label: string;
  defaultValue: string;
  values: number[];
}) {
  return (
    <label>
      <span className="text-sm font-bold text-ink">{label}</span>
      <select name={name} defaultValue={defaultValue} className="field">
        {values.map((hour) => (
          <option key={hour} value={hour}>
            {String(hour).padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </label>
  );
}
