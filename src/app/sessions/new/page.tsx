import Link from "next/link";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { createSessionAction } from "@/app/actions";

const defaultTimezone = "Europe/London";
const hours = Array.from({ length: 24 }, (_, hour) => hour);
const finishHours = Array.from({ length: 24 }, (_, index) => index + 1);

export default function NewSessionPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-8">
      <Link
        href="/"
        className="focus-ring inline-flex items-center gap-2 rounded-md px-1 py-2 text-sm font-semibold text-ink/70 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Let&apos;s Play Games
      </Link>

      <form
        action={createSessionAction}
        className="mt-8 overflow-hidden rounded-xl border border-ink/8 bg-white/88 shadow-soft backdrop-blur"
      >
        <div className="border-b border-ink/8 px-5 py-5 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ember">Plan</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-normal text-ink sm:text-5xl">
                Plan a game night
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-ink/68">
                Configure the essentials, share one link, and let friends answer without an account.
              </p>
            </div>
            <button
              type="submit"
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-ember px-5 py-3 font-semibold text-white shadow-soft transition hover:bg-[#b74724]"
            >
              <CalendarPlus className="h-5 w-5" />
              Create share link
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
          <section className="grid content-start gap-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink/58">Basics</h2>
            <label>
              <span className="text-sm font-semibold text-ink">Session name</span>
              <input
                name="title"
                required
                minLength={2}
                maxLength={120}
                defaultValue="Game night"
                className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-paper px-3 py-3 text-ink"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-ink">Your name</span>
                <input
                  name="hostName"
                  required
                  maxLength={80}
                  placeholder="Alex"
                  className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-paper px-3 py-3 text-ink"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-ink">Location</span>
                <select
                  name="mode"
                  defaultValue="ONLINE"
                  className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-paper px-3 py-3 text-ink"
                >
                  <option value="ONLINE">Online</option>
                  <option value="IN_PERSON">In person</option>
                </select>
              </label>
            </div>
          </section>

          <section className="grid content-start gap-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink/58">
              Requirements
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-ink">Duration</span>
                <select
                  name="requiredDuration"
                  defaultValue="2"
                  className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-paper px-3 py-3 text-ink"
                >
                  {[1, 2, 3, 4, 5, 6].map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} {duration === 1 ? "hour" : "hours"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-ink">Minimum players</span>
                <input
                  name="minimumPlayerCount"
                  required
                  min={2}
                  max={30}
                  type="number"
                  defaultValue={4}
                  className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-paper px-3 py-3 text-ink"
                />
              </label>
            </div>
            <p className="text-sm leading-6 text-ink/58">
              Recommendations appear when at least this many people are available.
            </p>
          </section>

          <section className="grid content-start gap-4 lg:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink/58">
              Scheduling
            </h2>
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
                    className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tide rounded-md border border-ink/10 bg-paper p-4 text-ink transition has-[:checked]:border-tide has-[:checked]:bg-tide has-[:checked]:text-white"
                  >
                    <input
                      name="datePreset"
                      type="radio"
                      value={value}
                      defaultChecked={value === "this_week"}
                      className="sr-only"
                    />
                    <span className="block font-semibold">{label}</span>
                    <span className="mt-1 block text-sm opacity-75">{description}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
              <label>
                <span className="text-sm font-semibold text-ink">Weekday start</span>
                <select
                  name="dailyStartHour"
                  defaultValue="18"
                  className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-paper px-3 py-3 text-ink"
                >
                  {hours.map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-ink">Weekday finish</span>
                <select
                  name="dailyEndHour"
                  defaultValue="23"
                  className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-paper px-3 py-3 text-ink"
                >
                  {finishHours.map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-ink">Timezone</span>
                <input
                  name="timezone"
                  required
                  defaultValue={defaultTimezone}
                  className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-paper px-3 py-3 text-ink"
                />
              </label>
            </div>

            <fieldset className="rounded-md bg-paper p-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <input name="separateWeekendTimes" type="checkbox" className="h-4 w-4 accent-tide" />
                Use different times on weekends
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-semibold text-ink">Weekend start</span>
                  <select
                    name="weekendStartHour"
                    defaultValue="14"
                    className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-white px-3 py-3 text-ink"
                  >
                    {hours.map((hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold text-ink">Weekend finish</span>
                  <select
                    name="weekendEndHour"
                    defaultValue="23"
                    className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-white px-3 py-3 text-ink"
                  >
                    {finishHours.map((hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>
          </section>

          <section className="grid content-start gap-4 lg:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink/58">
              Notifications
            </h2>
            <label>
              <span className="text-sm font-semibold text-ink">Discord channel</span>
              <input
                name="discordChannel"
                maxLength={120}
                placeholder="#game-night"
                className="focus-ring mt-2 w-full rounded-md border border-ink/12 bg-paper px-3 py-3 text-ink"
              />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-ink">Reminder preferences</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {["24 hours before", "2 hours before", "15 minutes before"].map((label) => (
                  <label
                    key={label}
                    className="focus-within:outline-tide inline-flex items-center gap-2 rounded-md bg-paper px-3 py-2 text-sm font-medium text-ink"
                  >
                    <input name="reminders" type="checkbox" value={label} className="h-4 w-4 accent-tide" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        </div>
      </form>
    </main>
  );
}
