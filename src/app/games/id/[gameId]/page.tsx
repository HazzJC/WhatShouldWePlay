import Link from "next/link";
import { ArrowLeft, Gamepad2, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { GameArtwork } from "@/components/game-artwork";
import { prisma } from "@/lib/prisma";

export const metadata = { robots: { index: false, follow: false } };

export default async function CanonicalGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      title: true,
      coverUrl: true,
      steamAppId: true,
      summary: true,
      genres: true,
      platforms: true,
      minPlayers: true,
      maxPlayers: true,
      onlineCoop: true,
      localCoop: true,
      onlineMultiplayer: true,
      localMultiplayer: true,
      minimumSessionMinutes: true,
      commitmentTier: true,
      capabilitySource: true,
    },
  });
  if (!game) notFound();

  const genres = jsonStrings(game.genres);
  const platforms = jsonStrings(game.platforms);
  const modes = [
    game.onlineCoop ? "Online co-op" : null,
    game.localCoop ? "Local co-op" : null,
    game.onlineMultiplayer ? "Online multiplayer" : null,
    game.localMultiplayer ? "Local multiplayer" : null,
  ].filter((mode): mode is string => Boolean(mode));

  return (
    <main className="ui-shell pb-16">
      <nav className="py-1.5">
        <Link href="/discover" className="secondary-button">
          <ArrowLeft className="h-4 w-4" />
          Browse games
        </Link>
      </nav>

      <article className="surface mx-auto mt-5 grid max-w-4xl gap-5 p-5 sm:grid-cols-[160px_minmax(0,1fr)]">
        <GameArtwork
          appId={game.steamAppId}
          coverUrl={game.coverUrl}
          title={game.title}
          sizes="160px"
          kind="cover"
          className="aspect-[3/4] w-40 rounded-lg"
          imageClassName="object-cover"
        />
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-coral">Game details</p>
          <h1 className="mt-1 text-3xl font-black text-ink">{game.title}</h1>
          <p className="mt-3 leading-7 text-ink/65">{game.summary ?? "No catalog summary is available yet."}</p>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail icon={<UsersRound className="h-4 w-4" />} label="Players" value={playerRange(game.minPlayers, game.maxPlayers)} />
            <Detail icon={<Gamepad2 className="h-4 w-4" />} label="Modes" value={modes.join(", ") || "Unknown"} />
            <Detail label="Platforms" value={platforms.join(", ") || "Unknown"} />
            <Detail label="Genres" value={genres.join(", ") || "Unknown"} />
            <Detail label="Minimum session" value={game.minimumSessionMinutes ? `${game.minimumSessionMinutes} minutes` : "Unknown"} />
            <Detail label="Commitment" value={game.commitmentTier?.toLocaleLowerCase().replaceAll("_", " ") ?? "Unknown"} />
          </dl>
          <p className="mt-4 text-xs font-bold text-ink/45">
            Capability source: {game.capabilitySource ?? "not recorded"}. Missing values remain unknown rather than assumed.
          </p>
        </div>
      </article>
    </main>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-paper p-3">
      <dt className="flex items-center gap-1 text-xs font-black uppercase tracking-[0.1em] text-ink/45">{icon}{label}</dt>
      <dd className="mt-1 font-bold text-ink">{value}</dd>
    </div>
  );
}

function jsonStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function playerRange(minimum: number | null, maximum: number | null) {
  if (minimum === null || maximum === null) return "Unknown";
  return minimum === maximum ? String(minimum) : `${minimum}-${maximum}`;
}
