import Link from "next/link";
import { ArrowLeft, Bell, CalendarDays, CalendarPlus, Clock3, Gamepad2, Sparkles, UsersRound } from "lucide-react";
import { createSessionAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PlanDateOptions, PlanReminderOptions } from "@/components/plan-options";

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

export default async function NewSessionPage({ searchParams }: { searchParams?: Promise<{ gameNight?: string }> }) {
  const query = await searchParams;
  return (
    <main className="ui-shell pb-24 sm:pb-8">
      <Link href="/" className="secondary-button px-3 py-2">
        <ArrowLeft className="h-4 w-4" />
        Let&apos;s Play Games
      </Link>

      <header className="route-hero mt-3 p-5 sm:p-7 lg:hidden">
        <span className="sticker !border-white/15 !bg-white/10 !text-white/75">No account needed</span>
        <h1 className="mt-4 text-3xl font-black leading-tight">Find a time everyone can make</h1>
        <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-white/65">Choose some dates, share the link, and let people mark when they are free.</p>
      </header>

      <form action={createSessionAction} className="mt-4 grid gap-4 lg:grid-cols-[290px_1fr]">
        {query?.gameNight ? <input type="hidden" name="gameNightId" value={query.gameNight} /> : null}
        <aside className="quest-map hidden overflow-hidden rounded-3xl p-5 shadow-soft lg:sticky lg:top-24 lg:block lg:self-start">
          <span className="sticker !border-white/15 !bg-white/10 !text-white/75"><Sparkles className="mr-1 h-3 w-3" />No account needed</span>
          <h1 className="mt-5 text-3xl font-black leading-tight text-white">Plan a game night</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-white/62">
            Choose the dates and group size, then share one link for everyone to answer.
          </p>
          <div className="mt-6 grid gap-3 text-sm font-bold text-white/76">
            <Step number="1" icon={<Gamepad2 className="h-4 w-4" />} label="Name the night" />
            <Step number="2" icon={<Clock3 className="h-4 w-4" />} label="Set the window" />
            <Step number="3" icon={<UsersRound className="h-4 w-4" />} label="Set the headcount" />
            <Step number="4" icon={<Bell className="h-4 w-4" />} label="Add extras" />
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-4"><CalendarDays className="h-5 w-5 text-teal" /><p className="mt-2 text-sm font-black text-white">What happens next?</p><p className="mt-1 text-xs font-bold leading-5 text-white/52">You get a share link. Friends mark their availability, and the strongest overlap appears at the top.</p></div>
        </aside>

        <div className="grid gap-4">
          <Panel number="1" title="Name the night" description="Give people enough context to recognise it in the group chat." tone="coral" icon={<Gamepad2 className="h-5 w-5" />}>
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

          <Panel number="2" title="When could it happen?" description="Choose a useful window—not every evening for the rest of time." tone="purple" icon={<Clock3 className="h-5 w-5" />}>
            <PlanDateOptions />

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

          </Panel>

          <Panel number="3" title="What counts as a go?" description="We’ll only call a time a winner when enough people can make it." tone="teal" icon={<UsersRound className="h-5 w-5" />}>
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

          <Panel number="4" title="Useful extras" description="Skip these unless your group actually needs them." tone="gold" icon={<Bell className="h-5 w-5" />}>
            <label>
              <span className="text-sm font-bold text-ink">Discord channel</span>
              <input name="discordChannel" maxLength={120} placeholder="#game-night" className="field" />
            </label>
            <PlanReminderOptions />
          </Panel>

          <div className="sticky bottom-0 z-20 -mx-3 border-t border-ink/10 bg-paper/95 p-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <PendingSubmitButton className="primary-button w-full py-3 text-base sm:w-auto" pendingLabel="Creating...">
              <CalendarPlus className="h-5 w-5" />
              Make the share link
            </PendingSubmitButton>
          </div>
        </div>
      </form>
    </main>
  );
}

function Panel({ number, title, description, tone, icon, children }: { number: string; title: string; description: string; tone: "coral" | "purple" | "teal" | "gold"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="step-panel surface p-4 sm:p-6" data-step={number} data-tone={tone}>
      <div className="relative z-10 flex items-start gap-3">
        <span className="step-badge">{icon}</span>
        <div><p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-ink/42">Step {number} of 4</p><h2 className="mt-1 text-2xl font-black text-ink">{title}</h2><p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-ink/55">{description}</p></div>
      </div>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function Step({ number, icon, label }: { number: string; icon: React.ReactNode; label: string }) {
  return (
    <div className="quest-step flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-teal">{icon}</span>
      <span><span className="mr-2 text-white/35">{number}.</span>{label}</span>
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
