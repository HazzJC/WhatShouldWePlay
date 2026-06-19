"use client";

import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark" | "system";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("theme-mode");
    if (saved === "light" || saved === "dark" || saved === "system") {
      setMode(saved);
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);

    function handleChange(event: MediaQueryListEvent) {
      setSystemDark(event.matches);
    }

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
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

  const darkActive = mode === "dark" || (mode === "system" && systemDark);

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-xl border border-ink/10 bg-white/90 p-2 shadow-soft backdrop-blur" aria-label="Colour theme">
      <button
        type="button"
        className="focus-ring inline-flex items-center gap-3 rounded-lg px-2 py-1.5 text-left"
        aria-pressed={darkActive}
        onClick={() => updateMode(darkActive ? "light" : "dark")}
      >
        <span className="hidden text-xs font-black uppercase tracking-[0.12em] text-ink/55 sm:block">Dark mode</span>
        <span
          className={`relative inline-flex h-8 w-16 items-center rounded-full border p-1 transition ${
            darkActive ? "border-teal/40 bg-ink" : "border-ink/15 bg-linen"
          }`}
        >
          <span
            className={`grid h-6 w-6 place-items-center rounded-full bg-paper text-ink shadow-card transition-transform ${
              darkActive ? "translate-x-8" : "translate-x-0"
            }`}
          >
            {darkActive ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </span>
        </span>
      </button>
      <button
        type="button"
        className={`focus-ring inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-black transition ${
          mode === "system" ? "bg-ink text-paper" : "text-ink/65 hover:bg-paper hover:text-ink"
        }`}
        aria-pressed={mode === "system"}
        onClick={() => updateMode("system")}
      >
        <Laptop className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">System</span>
      </button>
    </div>
  );
}
