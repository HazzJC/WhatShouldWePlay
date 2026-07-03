"use client";

import { Check, Heart, X } from "lucide-react";
import { useState } from "react";
import { markGameAvailableAction, markGameInterestAction } from "@/app/actions";

export function GameSignalControls({
  shareToken,
  participantId,
  sessionGameId,
  initialSignal,
  initialInterest,
}: {
  shareToken: string;
  participantId: string;
  sessionGameId: string;
  initialSignal: string | null;
  initialInterest: "WANT_TO_PLAY" | "NEUTRAL" | "NOT_TONIGHT";
}) {
  const [signal, setSignal] = useState(initialSignal);
  const [interest, setInterest] = useState(initialInterest);
  const [status, setStatus] = useState("");

  async function saveSignal(formData: FormData) {
    const next = String(formData.get("signal"));
    const previous = signal;
    setSignal(next);
    setStatus("Saving...");
    try {
      await markGameAvailableAction(formData);
      setStatus("Saved");
    } catch {
      setSignal(previous);
      setStatus("Could not save. Try again.");
    }
  }

  async function saveInterest(formData: FormData) {
    const next = String(formData.get("interest")) as typeof interest;
    const previous = interest;
    setInterest(next);
    setStatus("Saving...");
    try {
      await markGameInterestAction(formData);
      setStatus("Saved");
    } catch {
      setInterest(previous);
      setStatus("Could not save. Try again.");
    }
  }

  return (
    <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          { value: "OWNED", label: "Have", icon: Check },
          { value: "NOT_AVAILABLE", label: "Don't have", icon: X },
        ].map(({ value, label, icon: Icon }) => (
          <form key={value} action={saveSignal}>
            <input type="hidden" name="shareToken" value={shareToken} />
            <input type="hidden" name="sessionGameId" value={sessionGameId} />
            <input type="hidden" name="participantId" value={participantId} />
            <input type="hidden" name="signal" value={value} />
            <button className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${signal === value ? value === "OWNED" ? "border-moss bg-moss text-white" : "border-red-700 bg-red-700 text-white" : value === "OWNED" ? "border-moss/25 bg-moss/10 text-moss" : "border-red-200 bg-red-50 text-red-800"}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          </form>
        ))}
      </div>
      {signal ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["WANT_TO_PLAY", "Want to play"],
            ["NEUTRAL", "Neutral"],
            ["NOT_TONIGHT", "Not tonight"],
          ].map(([value, label]) => (
            <form key={value} action={saveInterest}>
              <input type="hidden" name="shareToken" value={shareToken} />
              <input type="hidden" name="sessionGameId" value={sessionGameId} />
              <input type="hidden" name="participantId" value={participantId} />
              <input type="hidden" name="interest" value={value} />
              <button className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm font-semibold ${interest === value ? "border-teal bg-teal text-white" : "border-ink/10 bg-white text-ink"}`}>
                <Heart className="h-4 w-4" />{label}
              </button>
            </form>
          ))}
        </div>
      ) : null}
      <p aria-live="polite" className={`mt-2 min-h-4 text-xs font-medium ${status.startsWith("Could") ? "text-red-800" : "text-ink/45"}`}>{status}</p>
    </>
  );
}
