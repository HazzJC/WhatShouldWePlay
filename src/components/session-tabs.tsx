import Link from "next/link";

export function SessionTabs({
  shareToken,
  participantId,
  activeTab,
  planHref,
  pickHref,
}: {
  shareToken: string;
  participantId?: string;
  activeTab: "plan" | "pick";
  planHref?: string;
  pickHref?: string;
}) {
  const tabs = [
    ["plan", "Plan", "Collect availability"],
    ["pick", "Pick", "Compare libraries"],
  ] as const;

  return (
    <div className="mt-3 flex rounded-lg border border-ink/10 bg-white/75 p-1 shadow-sm">
      {tabs.map(([tab, label, description]) => {
        const linkedHref = tab === "plan" ? planHref : pickHref;
        const href = linkedHref ?? `/s/${shareToken}?tab=${tab}${participantId ? `&participant=${participantId}` : ""}`;
        const active = activeTab === tab;

        return (
          <Link
            key={tab}
            href={href}
            className={`focus-ring min-w-0 flex-1 rounded-md px-3 py-2 text-center text-sm font-black transition ${
              active ? "bg-teal text-white shadow-card" : "text-ink/65 hover:bg-paper hover:text-ink"
            }`}
          >
            <span className="block truncate">{label}</span>
            <span className={`mt-0.5 block text-xs font-bold ${active ? "text-white/72" : "text-ink/45"}`}>{description}</span>
          </Link>
        );
      })}
    </div>
  );
}
