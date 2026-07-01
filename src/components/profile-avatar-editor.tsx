"use client";

import { Pencil, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  removeProfileAvatarAction,
  uploadProfileAvatarAction,
} from "@/app/account/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

const maxAvatarBytes = 512 * 1024;

export function ProfileAvatarEditor({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <div className="relative shrink-0">
        {avatarUrl ? (
          // The avatar endpoint is dynamic and already validates the image payload.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={`${displayName}'s profile`} className="h-14 w-14 rounded-lg object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-lg bg-teal/12 text-teal">
            <UserRound className="h-7 w-7" />
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="focus-ring absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-teal text-white shadow-card transition hover:bg-ink"
          aria-label="Edit profile picture"
          title="Edit profile picture"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-ink/70 p-4" role="presentation" onMouseDown={() => setOpen(false)}>
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="avatar-dialog-title"
                className="w-full max-w-md rounded-lg border border-ink/10 bg-white p-5 shadow-soft"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="avatar-dialog-title" className="text-xl font-black text-ink">Profile picture</h2>
                    <p className="mt-1 text-sm font-bold text-ink/55">JPEG, PNG, or WebP. Maximum 512 KB.</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="focus-ring grid h-9 w-9 place-items-center rounded-md text-ink/55 hover:bg-ink/5" aria-label="Close profile picture editor">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form action={uploadProfileAvatarAction} className="mt-5 grid gap-3">
                  <input
                    name="avatar"
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp"
                    className="block w-full text-sm font-bold text-ink"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      setFileError(file && file.size > maxAvatarBytes ? "That image is larger than 512 KB." : null);
                    }}
                  />
                  {fileError ? <p role="alert" className="text-sm font-bold text-red-800">{fileError}</p> : null}
                  <PendingSubmitButton disabled={Boolean(fileError)} className="primary-button justify-center" pendingLabel="Uploading picture...">
                    Upload picture
                  </PendingSubmitButton>
                </form>
                {avatarUrl ? (
                  <form action={removeProfileAvatarAction} className="mt-3">
                    <PendingSubmitButton className="secondary-button w-full justify-center" pendingLabel="Removing picture...">
                      Remove picture
                    </PendingSubmitButton>
                  </form>
                ) : null}
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
