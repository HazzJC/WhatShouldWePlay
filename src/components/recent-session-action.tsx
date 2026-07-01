"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { removeRecentSessionAction } from "@/app/account/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

export function RecentSessionAction({
  participantId,
  title,
  isHost,
}: {
  participantId: string;
  title: string;
  isHost: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring grid h-8 w-8 place-items-center rounded-md text-ink/45 hover:bg-red-50 hover:text-red-800"
        aria-label={`${isHost ? "Delete" : "Remove"} ${title}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[1000] grid place-items-center bg-ink/70 p-4" role="presentation" onMouseDown={() => setOpen(false)}>
              <section role="alertdialog" aria-modal="true" aria-labelledby="session-delete-title" className="w-full max-w-md rounded-lg border border-red-200 bg-white p-5 shadow-soft" onMouseDown={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="session-delete-title" className="text-xl font-black text-red-800">
                      {isHost ? "Delete this session?" : "Remove from recent sessions?"}
                    </h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-ink/60">
                      {isHost
                        ? "This permanently deletes the shared session for everyone."
                        : "The shared session remains available, but it will no longer be linked to your account."}
                    </p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-md text-ink/55 hover:bg-ink/5" aria-label="Cancel">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form action={removeRecentSessionAction} className="mt-5 flex flex-wrap justify-end gap-2">
                  <input type="hidden" name="participantId" value={participantId} />
                  <button type="button" onClick={() => setOpen(false)} className="secondary-button">Cancel</button>
                  <PendingSubmitButton className="secondary-button border-red-300 text-red-800" pendingLabel="Removing...">
                    {isHost ? "Delete session" : "Remove from recents"}
                  </PendingSubmitButton>
                </form>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
