"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { DownloadCloud } from "lucide-react";

const importSteps = [
  { label: "Contacting Steam", progress: 18 },
  { label: "Reading your library", progress: 38 },
  { label: "Saving owned games", progress: 64 },
  { label: "Matching this shortlist", progress: 82 },
  { label: "Finishing import", progress: 94 },
];

export function SteamImportSubmitButton() {
  const { pending } = useFormStatus();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!pending) {
      setStepIndex(0);
      return;
    }

    const timeouts = importSteps.slice(1).map((_, index) =>
      window.setTimeout(() => setStepIndex(index + 1), 1500 + index * 2200),
    );

    return () => {
      timeouts.forEach(window.clearTimeout);
    };
  }, [pending]);

  if (!pending) {
    return (
      <button className="primary-button" type="submit">
        <DownloadCloud className="h-4 w-4" />
        Import Steam library
      </button>
    );
  }

  const step = importSteps[stepIndex] ?? importSteps.at(-1)!;

  return (
    <div className="min-w-[16rem]" aria-live="polite">
      <button className="primary-button w-full" type="submit" disabled aria-busy="true">
        <span className="loading-spinner" aria-hidden="true" />
        {step.label}
      </button>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-linen">
        <div className="h-full rounded-full bg-gradient-to-r from-coral via-gold to-teal transition-all duration-500" style={{ width: `${step.progress}%` }} />
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-ink/55">
        Large Steam libraries can take a minute while we save playtime and ownership data.
      </p>
    </div>
  );
}
