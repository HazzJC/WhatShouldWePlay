"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

// Shown right after a Steam import lands on the Pick tab. The import writes all
// of its data before redirecting, but the App Router can paint the destination
// from its client cache before the fresh server render arrives — which is why
// recommendations could read 0 until a manual refresh. This component gives the
// user an honest "calculating" status and pulls a fresh server render once, so
// scores and ownership appear without anyone thinking the import failed.
export function PostImportStatus({ importedCount }: { importedCount: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"calculating" | "ready">("calculating");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    // Pull fresh server data, then clear the flag from the URL once scores show.
    const refreshTimer = setTimeout(() => {
      router.refresh();
      setPhase("ready");
    }, 1200);

    const cleanupTimer = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("imported");
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }, 4200);

    return () => {
      clearTimeout(refreshTimer);
      clearTimeout(cleanupTimer);
    };
  }, [router]);

  const countLabel =
    importedCount > 0 ? `Imported ${importedCount} game${importedCount === 1 ? "" : "s"}.` : "Library imported.";

  return (
    <div
      className="mt-5 flex items-center gap-3 rounded-xl border border-teal/20 bg-teal/10 p-4"
      aria-live="polite"
    >
      {phase === "calculating" ? (
        <>
          <span className="loading-spinner text-teal" aria-hidden="true" />
          <p className="text-sm font-bold leading-6 text-ink/80">
            {countLabel} Calculating your group&apos;s best picks and ownership matches…
          </p>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-5 w-5 shrink-0 text-moss" aria-hidden="true" />
          <p className="text-sm font-bold leading-6 text-ink/80">
            {countLabel} Recommendations are ready below.
          </p>
        </>
      )}
    </div>
  );
}
