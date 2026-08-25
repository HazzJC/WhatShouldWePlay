import { Gamepad2, Sparkles } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "h-9 w-9" : "h-11 w-11"}`} aria-hidden="true">
      <span className="brand-mark-tile brand-mark-tile-back"><Sparkles className="h-3 w-3" /></span>
      <span className="brand-mark-tile brand-mark-tile-front"><Gamepad2 className={compact ? "h-4 w-4" : "h-5 w-5"} /></span>
    </span>
  );
}
