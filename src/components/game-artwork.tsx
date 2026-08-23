"use client";

import Image from "next/image";
import { useState } from "react";

type GameArtworkProps = {
  appId: number;
  title: string;
  className?: string;
  imageClassName?: string;
  sizes: string;
};

export function GameArtwork({ appId, title, className = "", imageClassName = "", sizes }: GameArtworkProps) {
  const [failed, setFailed] = useState(false);
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return (
    <div className={`relative overflow-hidden bg-ink ${className}`} aria-hidden="true">
      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_25%_20%,rgba(27,181,173,0.8),transparent_42%),radial-gradient(circle_at_82%_72%,rgba(239,107,93,0.76),transparent_45%),linear-gradient(135deg,#17243a,#263b55)]">
        <span className="text-2xl font-black tracking-[0.12em] text-white/80">{initials}</span>
      </div>
      {!failed ? (
        <Image
          src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`}
          alt=""
          fill
          sizes={sizes}
          className={`object-cover ${imageClassName}`}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
