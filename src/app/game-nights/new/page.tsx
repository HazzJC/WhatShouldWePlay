import Link from "next/link";
import { CalendarDays, Gamepad2, Layers3 } from "lucide-react";
import { createCombinedGameNightAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCurrentUser } from "@/lib/auth";
import { TimezoneInput } from "@/components/timezone-input";

export default async function NewGameNightPage() {
  const user = await getCurrentUser();

  return (
    <main className="ui-shell">
      <header className="mx-auto max-w-4xl py-7">
        <p className="text-sm font-semibold text-coral">New Game Night</p>
        <h1 className="mt-1 text-4xl font-black text-ink">What do you want to organise?</h1>
        <p className="mt-3 text-ink/60">Start with one workspace or prepare the date and game together.</p>
      </header>
      <section className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
        <Choice href="/sessions/new" icon={<CalendarDays className="h-6 w-6" />} title="Plan" detail="Find a time. No account required." />
        <Choice href="/sessions/pick" icon={<Gamepad2 className="h-6 w-6" />} title="Pick" detail="Compare persistent game profiles." />
        <article className="surface rounded-lg p-5 md:col-span-3">
          <div className="flex items-center gap-2 text-teal"><Layers3 className="h-5 w-5" /><h2 className="text-xl font-bold text-ink">Plan and Pick</h2></div>
          <p className="mt-2 text-sm text-ink/60">Create one shared overview with separate availability and shortlist workspaces.</p>
          {user?.username ? (
            <form action={createCombinedGameNightAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label><span className="text-sm font-semibold text-ink">Game Night name</span><input name="title" required defaultValue="Game night" className="field" /></label>
              <label><span className="text-sm font-semibold text-ink">Your name</span><input name="hostName" required defaultValue={user.displayName} className="field" /></label>
              <label><span className="text-sm font-semibold text-ink">Where</span><select name="mode" defaultValue="ONLINE" className="field"><option value="ONLINE">Online</option><option value="IN_PERSON">In person</option></select></label>
              <label><span className="text-sm font-semibold text-ink">Minimum players</span><input name="minimumPlayerCount" type="number" min={2} max={30} defaultValue={4} className="field" /></label>
              <label><span className="text-sm font-semibold text-ink">Duration (hours)</span><input name="requiredDuration" type="number" min={1} max={8} defaultValue={2} className="field" /></label>
              <label><span className="text-sm font-semibold text-ink">Date window</span><select name="datePreset" defaultValue="this_week" className="field"><option value="tonight">Tonight</option><option value="this_week">This week</option><option value="this_month">This month</option></select></label>
              <label><span className="text-sm font-semibold text-ink">From</span><input name="dailyStartHour" type="number" min={0} max={23} defaultValue={18} className="field" /></label>
              <label><span className="text-sm font-semibold text-ink">Until</span><input name="dailyEndHour" type="number" min={1} max={24} defaultValue={23} className="field" /></label>
              <TimezoneInput defaultTimezone={user.timezone ?? "Europe/London"} />
              <PendingSubmitButton className="primary-button w-fit sm:col-span-2" pendingLabel="Creating both workspaces...">Create both</PendingSubmitButton>
            </form>
          ) : (
            <Link href="/account?returnTo=%2Fgame-nights%2Fnew" className="primary-button mt-4">Sign in to create both</Link>
          )}
        </article>
      </section>
    </main>
  );
}

function Choice({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <Link href={href} className="surface rounded-lg p-5 transition hover:border-teal/40">
      <span className="text-teal">{icon}</span>
      <h2 className="mt-3 text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60">{detail}</p>
    </Link>
  );
}
