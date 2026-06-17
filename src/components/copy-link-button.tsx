"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
      className="secondary-button px-3 py-2"
    >
      <Copy className="h-4 w-4" />
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
