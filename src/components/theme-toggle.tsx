"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark" | "system";

const modes: Array<{ mode: ThemeMode; label: string; icon: React.ReactNode }> = [
  { mode: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
  { mode: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
  { mode: "system", label: "System", icon: <Laptop className="h-3.5 w-3.5" /> },
];

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const saved = window.localStorage.getItem("theme-mode");
    if (saved === "light" || saved === "dark" || saved === "system") {
      setMode(saved);
    }
  }, []);

  function updateMode(nextMode: ThemeMode) {
    setMode(nextMode);
    window.localStorage.setItem("theme-mode", nextMode);

    if (nextMode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = nextMode;
    }
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-lg border border-ink/10 bg-white/85 p-1 shadow-card backdrop-blur" aria-label="Colour theme">
      <div className="flex gap-1">
        {modes.map((item) => {
          const active = mode === item.mode;

          return (
            <button
              key={item.mode}
              type="button"
              className={`focus-ring inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-black transition ${
                active ? "bg-ink text-paper" : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
              aria-pressed={active}
              onClick={() => updateMode(item.mode)}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
