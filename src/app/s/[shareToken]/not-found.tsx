import Link from "next/link";

export default function SessionNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ember">Session not found</p>
      <h1 className="mt-3 text-4xl font-bold text-ink">That game night link does not work.</h1>
      <p className="mt-4 leading-7 text-ink/68">Ask the host for a fresh link, or make a new plan.</p>
      <Link href="/sessions/new" className="focus-ring mt-6 inline-flex w-fit rounded-md bg-ink px-4 py-2 font-semibold text-white">
        Plan a game night
      </Link>
    </main>
  );
}
