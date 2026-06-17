import { Gamepad2 } from "lucide-react";

export default function SessionLoading() {
  return (
    <main className="ui-shell">
      <nav className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </div>
      </nav>

      <section className="surface mt-6 grid min-h-[22rem] place-items-center rounded-xl p-6 text-center">
        <div>
          <span className="loading-spinner mx-auto h-8 w-8 text-coral" aria-hidden="true" />
          <p className="mt-4 text-lg font-black text-ink">Loading session...</p>
          <p className="mt-2 text-sm font-bold text-ink/55">Checking the latest plans and picks.</p>
        </div>
      </section>
    </main>
  );
}
