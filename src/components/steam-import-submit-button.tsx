"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { DownloadCloud } from "lucide-react";

const importSteps = [
  "Contacting Steam",
  "Reading your library",
  "Saving owned games",
  "Matching this shortlist",
  "Calculating your best picks",
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
        {step}…
      </button>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-linen">
        <div className="indeterminate-bar h-full rounded-full bg-gradient-to-r from-coral via-gold to-teal" />
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-ink/55">
        Large Steam libraries can take a minute while we save playtime and ownership data.
      </p>
    </div>
  );
}
