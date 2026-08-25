"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";

type ThemeMode = "light" | "dark" | "system";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const hydrated = useHydrated();
  const [selectedMode, setSelectedMode] = useState<ThemeMode | null>(null);
  const saved = hydrated ? window.localStorage.getItem("theme-mode") : null;
  const mode: ThemeMode = selectedMode ?? (saved === "light" || saved === "dark" || saved === "system" ? saved : "system");

  function updateMode(nextMode: ThemeMode) {
    setSelectedMode(nextMode);
    window.localStorage.setItem("theme-mode", nextMode);
    if (nextMode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = nextMode;
    }
  }

  return (
    <div className="grid grid-cols-3 gap-1 rounded-md border border-ink/10 bg-paper p-1" role="group" aria-label={compact ? "Quick colour theme" : "Colour theme"}>
      <ThemeButton compact={compact} active={mode === "light"} label="Light" onClick={() => updateMode("light")} icon={<Sun className="h-4 w-4" />} />
      <ThemeButton compact={compact} active={mode === "dark"} label="Dark" onClick={() => updateMode("dark")} icon={<Moon className="h-4 w-4" />} />
      <ThemeButton compact={compact} active={mode === "system"} label="System" onClick={() => updateMode("system")} icon={<Laptop className="h-4 w-4" />} />
    </div>
  );
}

function ThemeButton({
  active,
  compact,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  compact: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring inline-flex items-center justify-center gap-1 rounded text-xs font-semibold ${compact ? "h-8 w-8 p-0" : "px-2 py-2"} ${
        active ? "bg-teal text-white" : "text-ink/65 hover:bg-white"
      }`}
    >
      {icon}
      <span className={compact ? "sr-only" : "hidden sm:inline"}>{label}</span>
    </button>
  );
}
