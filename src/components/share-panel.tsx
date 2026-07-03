"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Check, Copy, Mail, MessageCircle, QrCode, Share2 } from "lucide-react";

export function SharePanel({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const text = useMemo(() => `Join ${title}: ${url}`, [title, url]);
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  useEffect(() => {
    if (!open || qrDataUrl) {
      return;
    }

    QRCode.toDataURL(url, { margin: 1, width: 220 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [open, qrDataUrl, url]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  async function copy(value = url) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }

    window.setTimeout(() => setStatus("idle"), 2400);
  }

  async function shareToDiscord() {
    await copy(text);
    window.open("https://discord.com/channels/@me", "_blank", "noopener,noreferrer");
  }

  async function openShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Cancellation and unsupported share targets fall back to the sheet.
      }
    }
    setOpen(true);
  }

  return (
    <div className="relative">
      <button type="button" className="secondary-button px-3 py-2" onClick={openShare} aria-expanded={open}>
        <Share2 className="h-4 w-4" />
        Share
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] grid place-items-end bg-ink/55 p-0 sm:place-items-center sm:p-4" onMouseDown={() => setOpen(false)}>
        <div role="dialog" aria-modal="true" aria-label="Share this Game Night" className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-ink/10 bg-white p-4 shadow-card sm:max-w-md sm:rounded-xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-ink">Share this session</p>
          <button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-sm font-semibold text-ink/55">Close</button>
          </div>
          <p className="mt-1 break-all text-xs font-bold leading-5 text-ink/50">{url}</p>
          <div className="mt-3 grid gap-1.5">
            <button type="button" className="secondary-button justify-start px-3 py-2" onClick={() => copy()}>
              {status === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy link"}
            </button>
            <button type="button" className="secondary-button justify-start px-3 py-2" onClick={shareToDiscord}>
              <MessageCircle className="h-4 w-4" />
              {status === "copied" ? "Link copied — paste in Discord" : "Copy link & open Discord"}
            </button>
            <a className="secondary-button justify-start px-3 py-2" href={`https://wa.me/?text=${encodedText}`} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" />
              Share to WhatsApp
            </a>
            <a className="secondary-button justify-start px-3 py-2" href={`fb-messenger://share?link=${encodedUrl}`} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" />
              Share to Messenger
            </a>
            <a className="secondary-button justify-start px-3 py-2" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}`}>
              <Mail className="h-4 w-4" />
              Share by email
            </a>
          </div>
          <div className="mt-3 rounded-lg border border-ink/10 bg-paper p-3">
            <div className="flex items-center gap-2 text-sm font-black text-ink">
              <QrCode className="h-4 w-4 text-teal" />
              QR code
            </div>
            {qrDataUrl ? <Image src={qrDataUrl} alt={`QR code for ${title}`} width={160} height={160} unoptimized className="mx-auto mt-3 h-40 w-40" /> : <p className="mt-2 text-sm text-ink/55">Generating QR code...</p>}
          </div>
          {status === "failed" ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs font-bold leading-5 text-red-800">
              Could not copy automatically. Select the link above and copy it manually.
            </p>
          ) : null}
        </div>
        </div>
      ) : null}
    </div>
  );
}
