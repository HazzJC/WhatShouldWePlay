"use client";

import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
};

export function PendingSubmitButton({
  children,
  pendingLabel = "Working...",
  className,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className="loading-spinner" aria-hidden="true" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
