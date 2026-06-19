import Link from "next/link";

export function SessionTabs({
  shareToken,
  participantId,
  activeTab,
}: {
  shareToken: string;
  participantId?: string;
  activeTab: "plan" | "pick";
}) {
  const tabs = [
    ["plan", "Plan time", "Collect availability"],
    ["pick", "Pick game", "Compare libraries"],
  ] as const;

  return (
    <div className="mt-5 flex rounded-xl border border-ink/10 bg-white/75 p-1 shadow-sm">
      {tabs.map(([tab, label, description]) => {
        const href = `/s/${shareToken}?tab=${tab}${participantId ? `&participant=${participantId}` : ""}`;
        const active = activeTab === tab;

        return (
          <Link
            key={tab}
            href={href}
            className={`focus-ring flex-1 rounded-lg px-4 py-3 text-center text-sm font-black transition ${
              active ? "bg-teal text-white shadow-card" : "text-ink/65 hover:bg-paper hover:text-ink"
            }`}
          >
            <span className="block">{label}</span>
            <span className={`mt-0.5 block text-xs font-bold ${active ? "text-white/72" : "text-ink/45"}`}>{description}</span>
          </Link>
        );
      })}
    </div>
  );
}
