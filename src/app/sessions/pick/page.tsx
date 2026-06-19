import Link from "next/link";
import { ArrowLeft, Gamepad2, ListChecks, UsersRound } from "lucide-react";
import { createPickSessionAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCuratedGame } from "@/lib/curated-games";

const defaultTimezone = "Europe/London";

type PageProps = {
  searchParams?: Promise<{ game?: string }>;
};

export default async function NewPickSessionPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const initialGame = query?.game ? getCuratedGame(query.game) : null;

  return (
    <main className="ui-shell pb-24 sm:pb-8">
      <Link href="/" className="secondary-button px-3 py-2">
        <ArrowLeft className="h-4 w-4" />
        Let&apos;s Play Games
      </Link>

      <section className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="surface rounded-xl p-5 lg:sticky lg:top-5 lg:self-start">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal">Pick first</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-ink">Start with the shortlist</h1>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Create one shared place to import libraries, mark what people have, and find the best group matches.
          </p>
          <div className="mt-6 grid gap-3 text-sm font-bold text-ink/70">
            <Step icon={<Gamepad2 className="h-4 w-4" />} label="Import or add games" />
            <Step icon={<UsersRound className="h-4 w-4" />} label="Compare the group" />
            <Step icon={<ListChecks className="h-4 w-4" />} label="Pick the best fit" />
          </div>
        </aside>

        <form action={createPickSessionAction} className="surface rounded-xl p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">New Pick session</p>
          <h2 className="mt-1 text-2xl font-black text-ink">Create a game shortlist</h2>
          <div className="mt-5 grid gap-4">
            <label>
              <span className="text-sm font-bold text-ink">Group name</span>
              <input name="title" required minLength={2} maxLength={120} defaultValue="Game night picks" className="field" />
            </label>
            <label>
              <span className="text-sm font-bold text-ink">Your name</span>
              <input name="hostName" required maxLength={80} placeholder="Alex" className="field" />
            </label>
            <input type="hidden" name="timezone" value={defaultTimezone} />
            {initialGame ? <input type="hidden" name="initialGameSlug" value={initialGame.slug} /> : null}
            {initialGame ? (
              <div className="rounded-lg border border-teal/20 bg-teal/10 p-4">
                <p className="text-sm font-black text-ink">Starting shortlist with {initialGame.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink/65">
                  This game will be added automatically so the group can mark who has it.
                </p>
              </div>
            ) : null}
            <div className="rounded-lg border border-ink/10 bg-paper p-4 text-sm leading-6 text-ink/65">
              Scheduling is ready when you need it. This starts in Pick mode with sensible planning defaults hidden in the background.
            </div>
            <PendingSubmitButton className="primary-button w-full py-3 text-base sm:w-fit" pendingLabel="Creating...">
              <Gamepad2 className="h-5 w-5" />
              Create Pick link
            </PendingSubmitButton>
          </div>
        </form>
      </section>
    </main>
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
