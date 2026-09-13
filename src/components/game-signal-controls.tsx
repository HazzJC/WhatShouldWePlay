"use client";

import { Check, Heart, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [isPending, setIsPending] = useState(false);
  const latestMutation = useRef(0);
  const mutationPending = useRef(false);
  const isMounted = useRef(true);
  const lastServerValues = useRef({ signal: initialSignal, interest: initialInterest });
  const hasOptimisticSignal = useRef(false);
  const hasOptimisticInterest = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const serverValuesChanged =
      lastServerValues.current.signal !== initialSignal ||
      lastServerValues.current.interest !== initialInterest;

    const signalMatchesOptimistic = signal === initialSignal;
    const interestMatchesOptimistic = interest === initialInterest;

    if (!mutationPending.current && serverValuesChanged) {
      lastServerValues.current = { signal: initialSignal, interest: initialInterest };
      if (!hasOptimisticSignal.current || signalMatchesOptimistic) {
        hasOptimisticSignal.current = false;
        setSignal(initialSignal);
      }
      if (!hasOptimisticInterest.current || interestMatchesOptimistic) {
        hasOptimisticInterest.current = false;
        setInterest(initialInterest);
      }
    }
  }, [initialInterest, initialSignal, interest, signal]);

  function beginMutation() {
    latestMutation.current += 1;
    mutationPending.current = true;
    setIsPending(true);
    setStatus("Saving...");
    return latestMutation.current;
  }

  function isCurrentMutation(mutationId: number) {
    return isMounted.current && latestMutation.current === mutationId;
  }

  async function saveSignal(formData: FormData) {
    if (mutationPending.current) {
      return;
    }

    const next = String(formData.get("signal"));
    const previous = signal;
    const mutationId = beginMutation();
    hasOptimisticSignal.current = true;
    setSignal(next);
    try {
      await markGameAvailableAction(formData);
      if (isCurrentMutation(mutationId)) {
        setStatus("Saved");
      }
    } catch {
      if (isCurrentMutation(mutationId)) {
        setSignal(previous);
        setStatus("Could not save. Try again.");
      }
    } finally {
      if (isCurrentMutation(mutationId)) {
        mutationPending.current = false;
        setIsPending(false);
      }
    }
  }

  async function saveInterest(formData: FormData) {
    if (mutationPending.current) {
      return;
    }

    const next = String(formData.get("interest")) as typeof interest;
    const previous = interest;
    const mutationId = beginMutation();
    hasOptimisticInterest.current = true;
    setInterest(next);
    try {
      await markGameInterestAction(formData);
      if (isCurrentMutation(mutationId)) {
        setStatus("Saved");
      }
    } catch {
      if (isCurrentMutation(mutationId)) {
        setInterest(previous);
        setStatus("Could not save. Try again.");
      }
    } finally {
      if (isCurrentMutation(mutationId)) {
        mutationPending.current = false;
        setIsPending(false);
      }
    }
  }

  return (
    <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          { value: "OWNED", label: "Have", icon: Check },
          { value: "NOT_AVAILABLE", label: "Don't have", icon: X },
        ].map(({ value, label, icon: Icon }) => (
          <form
            key={value}
            onSubmit={(event) => {
              event.preventDefault();
              void saveSignal(new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="shareToken" value={shareToken} />
            <input type="hidden" name="sessionGameId" value={sessionGameId} />
            <input type="hidden" name="participantId" value={participantId} />
            <input type="hidden" name="signal" value={value} />
            <button disabled={isPending} className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${signal === value ? value === "OWNED" ? "border-moss bg-moss text-white" : "border-red-700 bg-red-700 text-white" : value === "OWNED" ? "border-moss/25 bg-moss/10 text-moss" : "border-red-200 bg-red-50 text-red-800"}`}>
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
            <form
              key={value}
              onSubmit={(event) => {
                event.preventDefault();
                void saveInterest(new FormData(event.currentTarget));
              }}
            >
              <input type="hidden" name="shareToken" value={shareToken} />
              <input type="hidden" name="sessionGameId" value={sessionGameId} />
              <input type="hidden" name="participantId" value={participantId} />
              <input type="hidden" name="interest" value={value} />
              <button disabled={isPending} className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm font-semibold ${interest === value ? "border-teal bg-teal text-white" : "border-ink/10 bg-white text-ink"}`}>
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
