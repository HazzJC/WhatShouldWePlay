import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function RecommendationsDisclosure({
  isCurrentHost,
  needsMoreSubmissions,
  children,
}: {
  isCurrentHost: boolean;
  needsMoreSubmissions: boolean;
  children: ReactNode;
}) {
  return (
    <details className="surface group rounded-xl p-0" open={isCurrentHost} data-testid="recommendations-disclosure">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-moss">Recommendations</p>
          <h2 className="mt-1 text-2xl font-black text-ink">Times worth locking</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-bold text-ink/60">
            {isCurrentHost ? "Expanded for host" : needsMoreSubmissions ? "Tap to view current best times" : "Tap to view best times"}
          </p>
          <span className="grid h-9 w-9 place-items-center rounded-md border border-ink/10 bg-paper text-ink transition group-open:rotate-180">
            <ChevronDown className="h-5 w-5" />
          </span>
        </div>
      </summary>
      <div className="border-t border-ink/10 px-5 pb-5">{children}</div>
    </details>
  );
}
