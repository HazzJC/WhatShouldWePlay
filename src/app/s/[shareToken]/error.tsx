"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function SessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="ui-shell grid place-items-center">
      <section className="surface max-w-xl rounded-xl p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-coral/10 text-coral">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-coral">Session could not load</p>
        <h1 className="mt-2 text-3xl font-black text-ink">Something went wrong opening this session.</h1>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          This is usually temporary. Try again, and if it keeps happening, reopen the link in a moment.
        </p>
        {error.digest ? <p className="mt-3 text-xs font-bold text-ink/45">Digest: {error.digest}</p> : null}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="primary-button">
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link href="/" className="secondary-button">
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
