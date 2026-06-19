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

  return (
    <div className="relative">
      <button type="button" className="secondary-button px-3 py-2" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Share2 className="h-4 w-4" />
        Share
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-ink/10 bg-white p-4 shadow-card">
          <p className="text-sm font-black text-ink">Share this session</p>
          <p className="mt-1 break-all text-xs font-bold leading-5 text-ink/50">{url}</p>
          <div className="mt-3 grid gap-2">
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
          <div className="mt-4 rounded-lg border border-ink/10 bg-paper p-3">
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
      ) : null}
    </div>
  );
}
