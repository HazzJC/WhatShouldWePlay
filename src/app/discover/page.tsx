import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3, Gamepad2, Gauge, Sparkles, UsersRound } from "lucide-react";
import { GameArtwork } from "@/components/game-artwork";
import { PlayerCountFilter } from "@/components/player-count-filter";
import {
  curatedGames,
  curatedGamesForList,
  curatedLists,
  curatedPlayerLabel,
  difficultyLabel,
  difficultyOptions,
  durationLabel,
  durationOptions,
  gamesForDifficulty,
  gamesForDuration,
  type CuratedGame,
  type DiscoveryDuration,
} from "@/lib/curated-games";
import { parseMinimumPlayers } from "@/lib/player-count";

type DiscoveryPath = "players" | "difficulty" | "duration";

type PageProps = {
  searchParams?: Promise<{
    path?: string;
    minPlayers?: string;
    difficulty?: string;
    duration?: string;
  }>;
};

export default async function DiscoverPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const path = parsePath(params?.path);
  const hasPlayerCount = Boolean(params?.minPlayers);
  const minimumPlayers = parseMinimumPlayers(params?.minPlayers);
  const selectedDifficulty = parseDifficulty(params?.difficulty);
  const selectedDuration = parseDuration(params?.duration);
  const visibleLists = curatedLists
    .map((list) => ({ ...list, games: curatedGamesForList(list.slug, minimumPlayers) }))
    .filter((list) => list.games.length > 0);
  const filteredGames = path === "difficulty"
    ? gamesForDifficulty(selectedDifficulty)
    : path === "duration"
      ? gamesForDuration(selectedDuration)
      : [];
  const spotlightGames = curatedGames
    .filter((game) => game.releaseStatus !== "upcoming")
    .sort((a, b) => Number(Boolean(b.trending)) - Number(Boolean(a.trending)))
    .slice(0, 3);

  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white"><Gamepad2 className="h-5 w-5" /></span>
          Let&apos;s Play Games
        </Link>
        <Link href="/sessions/pick" className="primary-button">Start Pick</Link>
      </nav>

      <section className="py-8">
        <header className="route-hero p-6 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Discover games</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black text-white sm:text-5xl">Start with what matters tonight</h1>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/60">
            Pick a route: how many people are coming, how demanding the game should be, or how long you want the commitment to last.
          </p>
        </header>

        {!path ? <DiscoveryPaths /> : <PathSwitcher activePath={path} />}

        {path === "players" ? (
          <PlayerDiscovery minimumPlayers={minimumPlayers} hasPlayerCount={hasPlayerCount} visibleLists={visibleLists} />
        ) : null}

        {path === "difficulty" ? (
          <FilteredDiscovery
            eyebrow="Choose the learning curve"
            title={difficultyOptions.find((option) => option.value === selectedDifficulty)?.label ?? "Involved"}
            description={difficultyOptions.find((option) => option.value === selectedDifficulty)?.description ?? "Needs some coordination"}
            games={filteredGames}
            activeValue={String(selectedDifficulty)}
            options={difficultyOptions.map((option) => ({ value: String(option.value), label: option.label, href: `/discover?path=difficulty&difficulty=${option.value}` }))}
            badge={difficultyLabel}
          />
        ) : null}

        {path === "duration" ? (
          <FilteredDiscovery
            eyebrow="Choose the commitment"
            title={durationOptions.find((option) => option.value === selectedDuration)?.label ?? "One evening"}
            description={durationOptions.find((option) => option.value === selectedDuration)?.description ?? "A self-contained session"}
            games={filteredGames}
            activeValue={selectedDuration}
            options={durationOptions.map((option) => ({ value: option.value, label: option.label, href: `/discover?path=duration&duration=${option.value}` }))}
            badge={durationLabel}
          />
        ) : null}

        {!path ? (
          <section className="mt-8">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-coral"><Sparkles className="h-4 w-4" />A few places to start</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">Popular group picks</h2>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {spotlightGames.map((game, index) => <SpotlightCard key={game.slug} game={game} priority={index === 0} />)}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function DiscoveryPaths() {
  return (
    <section className="mt-6 grid gap-4 xl:grid-cols-3" aria-label="Ways to discover games">
      <DiscoveryPathCard number="1" icon={<UsersRound className="h-6 w-6" />} tone="coral" title="Choose by group size" copy="Hide anything that leaves someone watching.">
        <div className="grid grid-cols-5 gap-1.5">
          {[2, 4, 6, 8, 10].map((count) => <Link key={count} href={`/discover?path=players&minPlayers=${count}`} className="discovery-option text-center">{count === 10 ? "10+" : count}</Link>)}
        </div>
        <p className="discovery-example">From two-player campaigns to a full Discord call</p>
      </DiscoveryPathCard>

      <DiscoveryPathCard number="2" icon={<Gauge className="h-6 w-6" />} tone="purple" title="Choose by difficulty" copy="Pick how much learning, coordination and failure the group wants.">
        <div className="grid grid-cols-5 gap-1">
          {difficultyOptions.map((option) => <Link key={option.value} href={`/discover?path=difficulty&difficulty=${option.value}`} className="discovery-option px-1 text-center" aria-label={option.label}><strong>{option.value}</strong><small>{shortDifficulty(option.value)}</small></Link>)}
        </div>
        <p className="discovery-example">Overcooked! 2 and Minecraft → GTFO</p>
      </DiscoveryPathCard>

      <DiscoveryPathCard number="3" icon={<Clock3 className="h-6 w-6" />} tone="teal" title="Choose by duration" copy="Decide whether this is one round, one evening, or the next few months.">
        <div className="grid grid-cols-2 gap-1.5">
          {durationOptions.map((option) => <Link key={option.value} href={`/discover?path=duration&duration=${option.value}`} className="discovery-option"><strong>{option.label}</strong><small>{option.value === "quick" ? "15–45 min" : option.value === "evening" ? "1–3 hours" : option.value === "campaign" ? "Several nights" : "100+ hours"}</small></Link>)}
        </div>
        <p className="discovery-example">Golf With Your Friends → Factorio + Space Exploration</p>
      </DiscoveryPathCard>
    </section>
  );
}

function DiscoveryPathCard({ number, icon, tone, title, copy, children }: { number: string; icon: React.ReactNode; tone: string; title: string; copy: string; children: React.ReactNode }) {
  return (
    <article className="discovery-path-card" data-tone={tone}>
      <div className="flex items-start gap-3"><span className="discovery-path-icon">{icon}</span><div><p className="text-xs font-black uppercase tracking-[0.14em] text-ink/40">Route {number}</p><h2 className="mt-1 text-2xl font-black text-ink">{title}</h2></div></div>
      <p className="mt-3 min-h-12 text-sm font-bold leading-6 text-ink/58">{copy}</p>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function PathSwitcher({ activePath }: { activePath: DiscoveryPath }) {
  const links = [
    ["players", UsersRound, "Group size", "/discover?path=players&minPlayers=4"],
    ["difficulty", Gauge, "Difficulty", "/discover?path=difficulty&difficulty=1"],
    ["duration", Clock3, "Duration", "/discover?path=duration&duration=quick"],
  ] as const;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <Link href="/discover" className="secondary-button px-3"><ArrowLeft className="h-4 w-4" />All three routes</Link>
      {links.map(([value, Icon, label, href]) => <Link key={value} href={href} className={`discovery-path-tab ${activePath === value ? "is-active" : ""}`}><Icon className="h-4 w-4" />{label}</Link>)}
    </div>
  );
}

function PlayerDiscovery({ minimumPlayers, hasPlayerCount, visibleLists }: { minimumPlayers: number; hasPlayerCount: boolean; visibleLists: Array<(typeof curatedLists)[number] & { games: CuratedGame[] }> }) {
  if (!hasPlayerCount) return <section className="surface mt-6 p-5"><h2 className="text-xl font-black text-ink">How many people need to play?</h2><p className="mt-2 text-sm text-ink/60">Choose a group size to see compatible lists.</p></section>;
  return (
    <>
      <PlayerCountFilter minimumPlayers={minimumPlayers} action="/discover" hiddenFields={{ path: "players" }} />
      <Link href="/discover/challenges" className="interactive-card mt-5 block rounded-xl border border-coral/30 bg-coral p-5 text-white shadow-card hover:bg-coralDark">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">Co-op challenges</p>
        <h2 className="mt-1 text-2xl font-black">Difficult goals for an established group</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-white/80">Browse sourced LASO runs, flawless raids and other group challenges with estimated completion times.</p>
      </Link>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleLists.map((list) => (
          <Link key={list.slug} href={`/discover/${list.slug}?minPlayers=${minimumPlayers}`} className="surface interactive-card rounded-xl p-5">
            <div className="mb-4 flex h-20 overflow-hidden rounded-lg bg-ink/10">
              {list.games.slice(0, 3).map((game) => <GameArtwork key={game.slug} appId={game.steamAppId} coverUrl={game.coverUrl} title={game.title} sizes="184px" className="min-w-0 flex-1" />)}
            </div>
            <h2 className="text-xl font-black text-ink">{list.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">{list.description}</p>
            <p className="mt-3 line-clamp-2 text-sm font-semibold text-ink/75">{list.games.slice(0, 3).map((game) => game.title).join(" · ")}</p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-teal">{list.games.length} match{list.games.length === 1 ? "" : "es"} for {minimumPlayers}+ players</p>
          </Link>
        ))}
      </div>
    </>
  );
}

function FilteredDiscovery({ eyebrow, title, description, games, options, activeValue, badge }: { eyebrow: string; title: string; description: string; games: CuratedGame[]; options: Array<{ value: string; label: string; href: string }>; activeValue: string; badge: (game: CuratedGame) => string }) {
  return (
    <section className="mt-6">
      <div className="surface p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-coral">{eyebrow}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-3xl font-black text-ink">{title}</h2><p className="mt-1 text-sm font-bold text-ink/55">{description}</p></div><p className="text-sm font-black text-teal">{games.length} games</p></div>
        <div className="mt-4 flex flex-wrap gap-2">{options.map((option) => <Link key={option.value} href={option.href} className={`discovery-filter-chip ${option.value === activeValue ? "is-active" : ""}`}>{option.label}</Link>)}</div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game, index) => <DiscoveryGameCard key={game.slug} game={game} badge={badge(game)} priority={index === 0} />)}
      </div>
    </section>
  );
}

function DiscoveryGameCard({ game, badge, priority = false }: { game: CuratedGame; badge: string; priority?: boolean }) {
  return (
    <Link href={`/games/${game.slug}`} className="surface interactive-card group overflow-hidden rounded-xl">
      <GameArtwork appId={game.steamAppId} coverUrl={game.coverUrl} title={game.title} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="h-36" imageClassName="group-hover:scale-105" priority={priority} />
      <div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="text-lg font-black text-ink">{game.title}</h3><span className="shrink-0 rounded-full bg-purple/10 px-2 py-1 text-[0.62rem] font-black text-purple">{badge}</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/58">{game.description}</p>{game.durationNote ? <p className="mt-2 text-xs font-bold leading-5 text-ink/55">{game.durationNote}</p> : null}<p className="mt-3 text-xs font-black uppercase tracking-[0.1em] text-teal">{curatedPlayerLabel(game)}</p></div>
    </Link>
  );
}

function SpotlightCard({ game, priority = false }: { game: CuratedGame; priority?: boolean }) {
  return (
    <Link href={`/games/${game.slug}`} className="interactive-card group relative min-h-64 overflow-hidden rounded-xl border border-ink/10 bg-ink text-white shadow-card">
      <GameArtwork appId={game.steamAppId} coverUrl={game.coverUrl} title={game.title} sizes="(min-width: 768px) 33vw, 100vw" className="!absolute inset-0" imageClassName="transition duration-500 group-hover:scale-105" priority={priority} />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">{curatedPlayerLabel(game)}</p><h3 className="mt-1 text-xl font-bold">{game.title}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-white/75">{game.description}</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white">See the details <ArrowRight className="h-4 w-4" /></span></div>
    </Link>
  );
}

function parsePath(value?: string): DiscoveryPath | null {
  return value === "players" || value === "difficulty" || value === "duration" ? value : null;
}

function parseDifficulty(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 1;
}

function parseDuration(value?: string): DiscoveryDuration {
  return durationOptions.some((option) => option.value === value) ? value as DiscoveryDuration : "quick";
}

function shortDifficulty(value: number) {
  return ["", "Easy", "Calm", "Involved", "Hard", "Brutal"][value];
}
