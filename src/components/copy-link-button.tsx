"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function CopyLinkButton({ url }: { url: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setStatus("copied");
          } catch {
            setStatus("failed");
          }

          window.setTimeout(() => setStatus("idle"), 2400);
        }}
        className="secondary-button px-3 py-2"
        aria-live="polite"
      >
        <Copy className="h-4 w-4" />
        {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy link"}
      </button>
      {status === "failed" ? (
        <span className="absolute right-0 top-full z-30 mt-2 w-64 rounded-md border border-red-200 bg-red-50 p-3 text-xs font-bold leading-5 text-red-800 shadow-card">
          Couldn&apos;t copy automatically. Long-press or select the browser address bar to share this link.
        </span>
      ) : null}
    </span>
  );
}
