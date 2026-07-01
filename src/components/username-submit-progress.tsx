"use client";

import { useFormStatus } from "react-dom";
import { ShieldCheck } from "lucide-react";

export function UsernameSubmitProgress() {
  const { pending } = useFormStatus();

  return (
    <div className="grid gap-3">
      <button type="submit" className="primary-button justify-center py-3" disabled={pending} aria-busy={pending}>
        {pending ? <span className="loading-spinner" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" />}
        {pending ? "Creating your profile..." : "Save and continue"}
      </button>
      {pending ? (
        <div role="status" aria-live="polite" className="rounded-lg border border-teal/20 bg-teal/10 p-3">
          <div className="h-2 overflow-hidden rounded-full bg-ink/10">
            <span className="block h-full w-2/3 animate-pulse rounded-full bg-teal" />
          </div>
          <p className="mt-2 text-sm font-black text-ink">Checking username and saving your account</p>
          <p className="mt-1 text-xs font-bold text-ink/55">Keep this page open. You will continue automatically.</p>
        </div>
      ) : null}
    </div>
  );
}
