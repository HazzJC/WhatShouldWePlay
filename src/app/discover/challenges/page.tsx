import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, Gamepad2, ShieldAlert, UsersRound } from "lucide-react";
import { updateChallengeProgressAction } from "@/app/discover/challenges/actions";
import { getCurrentUser } from "@/lib/auth";
import { curatedChallenges } from "@/lib/challenges";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<{
    players?: string;
    difficulty?: string;
    maxHours?: string;
  }>;
};

export default async function ChallengesPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const players = Math.max(1, Math.min(16, Number(query?.players ?? 1) || 1));
  const difficulty = Math.max(1, Math.min(5, Number(query?.difficulty ?? 1) || 1));
  const maxHours = Math.max(0, Number(query?.maxHours ?? 0) || 0);
  const user = await getCurrentUser();
  const progress = user
    ? await prisma.userChallenge.findMany({
        where: {
          userId: user.id,
          challengeId: { in: curatedChallenges.map((challenge) => challenge.id) },
        },
      })
    : [];
  const progressByChallenge = new Map(progress.map((entry) => [entry.challengeId, entry.status]));
  const challenges = curatedChallenges.filter(
    (challenge) =>
      challenge.maxPlayers >= players &&
      challenge.difficulty >= difficulty &&
      (!maxHours || !challenge.estimatedMinMinutes || challenge.estimatedMinMinutes <= maxHours * 60),
  );

  return (
    <main className="ui-shell pb-16">
      <nav className="flex flex-wrap items-center justify-between gap-3 py-1.5">
        <Link href="/discover" className="secondary-button">
          <ArrowLeft className="h-4 w-4" />
          Discovery
        </Link>
        <Link href="/sessions/pick" className="primary-button">
          <Gamepad2 className="h-4 w-4" />
          Start Pick
        </Link>
      </nav>

      <header className="mt-5 max-w-3xl">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Co-op challenges</p>
        <h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Hard things worth attempting together</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-ink/62">
          Sourced group activities with realistic attempt windows, player requirements, and caveats. Completion time includes learning and retries where practical.
        </p>
      </header>

      <form className="surface mt-4 grid gap-3 p-4 sm:grid-cols-4 sm:items-end">
        <label>
          <span className="text-sm font-black text-ink">At least players</span>
          <input name="players" type="number" min={1} max={16} defaultValue={players} className="field" />
        </label>
        <label>
          <span className="text-sm font-black text-ink">Difficulty</span>
          <select name="difficulty" defaultValue={difficulty} className="field">
            <option value="1">Any</option>
            <option value="3">Hard+</option>
            <option value="4">Very hard+</option>
            <option value="5">Extreme</option>
          </select>
        </label>
        <label>
          <span className="text-sm font-black text-ink">Attempt budget</span>
          <select name="maxHours" defaultValue={maxHours} className="field">
            <option value="0">Any time</option>
            <option value="2">Up to 2 hours</option>
            <option value="5">Up to 5 hours</option>
            <option value="20">Up to 20 hours</option>
            <option value="100">Up to 100 hours</option>
          </select>
        </label>
        <button className="secondary-button h-11 justify-center">Apply filters</button>
      </form>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        {challenges.map((challenge) => {
          const status = progressByChallenge.get(challenge.id);

          return (
            <article key={challenge.id} className="surface flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-teal">{challenge.game.title}</p>
                  <h2 className="mt-1 text-xl font-black text-ink">{challenge.title}</h2>
                </div>
                <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-800">
                  {challenge.difficulty}/5
                </span>
              </div>
              <p className="mt-3 text-sm font-bold leading-6 text-ink/62">{challenge.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-ink/65">
                <span className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-1">
                  <UsersRound className="h-3.5 w-3.5 text-teal" />
                  {challenge.minPlayers === challenge.maxPlayers ? challenge.maxPlayers : `${challenge.minPlayers}–${challenge.maxPlayers}`} players
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-1">
                  <Clock3 className="h-3.5 w-3.5 text-teal" />
                  {formatDuration(challenge.estimatedMinMinutes, challenge.estimatedMaxMinutes)}
                </span>
                <span className="rounded-md bg-paper px-2 py-1">{challenge.platform}</span>
              </div>
              {challenge.caveat ? (
                <p className="mt-3 flex gap-2 rounded-md border border-gold/30 bg-gold/10 p-3 text-xs font-bold leading-5 text-ink/65">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {challenge.caveat}
                </p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                <a href={challenge.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-teal underline underline-offset-4">
                  {challenge.sourceName}
                </a>
                {user?.username ? (
                  <form action={updateChallengeProgressAction} className="flex items-center gap-2">
                    <input type="hidden" name="challengeId" value={challenge.id} />
                    <select name="status" defaultValue={status ?? "SAVED"} className="field mt-0 w-auto py-2 text-xs">
                      <option value="SAVED">Saved</option>
                      <option value="IN_PROGRESS">Attempting</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="ABANDONED">Abandoned</option>
                    </select>
                    <button className="secondary-button px-3 py-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Save
                    </button>
                  </form>
                ) : (
                  <Link href="/account?returnTo=%2Fdiscover%2Fchallenges" className="secondary-button px-3 py-2">Sign in to track</Link>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function formatDuration(min?: number, max?: number) {
  if (!min && !max) return "Unknown";
  const format = (minutes: number) => minutes >= 60 ? `${Math.round(minutes / 60)}h` : `${minutes}m`;
  if (!min) return `Up to ${format(max!)}`;
  if (!max || min === max) return format(min);
  return `${format(min)}–${format(max)}`;
}
