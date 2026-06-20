import { Gamepad2, Monitor, Smartphone, Users } from "lucide-react";
import type { LocalSetup } from "@/lib/curated-games";

const ICONS: Record<LocalSetup, typeof Gamepad2> = {
  phones: Smartphone,
  controllers: Gamepad2,
  "shared-controller": Users,
  "pass-and-play": Users,
  "single-device": Monitor,
};

export function LocalSetupBadge({ setup, requirement }: { setup?: LocalSetup; requirement: string }) {
  const Icon = setup ? ICONS[setup] : Gamepad2;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-gold/20 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-ink">
      <Icon className="h-3.5 w-3.5" />
      {requirement}
    </span>
  );
}
