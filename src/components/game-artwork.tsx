"use client";

import Image from "next/image";
import { useState } from "react";

type GameArtworkProps = {
  appId?: number | null;
  coverUrl?: string | null;
  title: string;
  className?: string;
  imageClassName?: string;
  sizes: string;
  kind?: "banner" | "cover";
  priority?: boolean;
};

export function GameArtwork({ appId, coverUrl, title, className = "", imageClassName = "", sizes, kind = "banner", priority = false }: GameArtworkProps) {
  const steamArtwork = appId ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg` : null;
  const steamCapsule = appId ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_616x353.jpg` : null;
  const igdbArtwork = coverUrl ? normalizeCoverUrl(coverUrl) : null;
  const sources = (kind === "cover" ? [igdbArtwork, steamArtwork, steamCapsule] : [steamArtwork, steamCapsule, igdbArtwork]).filter(
    (source): source is string => Boolean(source),
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  const palette = fallbackPalettes[hashTitle(title) % fallbackPalettes.length];

  return (
    <div className={`game-artwork relative overflow-hidden bg-ink ${className}`} aria-hidden="true">
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ backgroundImage: `radial-gradient(circle at 18% 16%, ${palette[0]} 0, transparent 42%), radial-gradient(circle at 82% 78%, ${palette[1]} 0, transparent 46%), linear-gradient(135deg, #17182a, #292641)` }}
      >
        <span className="relative z-10 text-2xl font-black tracking-[0.12em] text-white/85">{initials || "?"}</span>
        <span className="absolute -right-5 -top-7 h-20 w-20 rounded-full border border-white/15" />
        <span className="absolute -bottom-6 left-5 h-16 w-16 rotate-12 rounded-2xl border border-white/10" />
      </div>
      {sources[sourceIndex] ? (
        <Image
          key={sources[sourceIndex]}
          src={sources[sourceIndex]}
          alt=""
          fill
          sizes={sizes}
          className={`object-cover ${imageClassName}`}
          priority={priority}
          unoptimized
          onError={() => setSourceIndex((index) => index + 1)}
        />
      ) : null}
    </div>
  );
}

const fallbackPalettes = [
  ["rgba(244,91,120,.9)", "rgba(53,194,181,.78)"],
  ["rgba(128,102,232,.92)", "rgba(244,167,64,.78)"],
  ["rgba(28,159,130,.9)", "rgba(232,80,111,.82)"],
  ["rgba(58,115,209,.9)", "rgba(151,83,208,.82)"],
] as const;

function normalizeCoverUrl(url: string) {
  const secureUrl = url.startsWith("//") ? `https:${url}` : url;
  return secureUrl.replace(/\/t_[^/]+\//, "/t_cover_big/");
}

function hashTitle(title: string) {
  return [...title].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0) >>> 0;
}
