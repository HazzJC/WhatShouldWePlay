import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Gamepad2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Release Notes | Let's Play Games",
  description: "Product updates and changelog for Let's Play Games.",
};

type ReleaseEntry = {
  date: string;
  headline: string;
  details: string[];
};

type ReleaseMonth = {
  month: string;
  entries: ReleaseEntry[];
};

const releaseNotes: ReleaseMonth[] = [
  {
    month: "June 2026",
    entries: [
      {
        date: "18 June 2026",
        headline: "Group game matching, deals, and discovery pages",
        details: [
          "Pick mode grew into a fuller recommendation workspace with transparent match scores, alignment checks, score presets, factor breakdowns, and group-buy suggestions.",
          "Curated discovery pages were added for online co-op, local co-op, larger groups, party games, survival picks, cheap co-op, trending multiplayer, recent releases, and upcoming friend-slop.",
          "The release also introduced ITAD-backed deal data, in-app price alerts, friend invite links, richer game metadata, and stronger player-count filtering.",
        ],
      },
      {
        date: "17 June 2026",
        headline: "Pick-first sessions and shared game recommendations",
        details: [
          "The home page split the product into two clear workstreams: Plan a game night or Pick games first.",
          "Pick-first sessions now create a normal session with hidden planning defaults, then take the host straight into game matching with participant selection and a player-count control.",
          "This update added loading feedback, pending submit states, match scoring tests, and early Steam price lookup support.",
        ],
      },
      {
        date: "17 June 2026",
        headline: "Steam import and unified game library",
        details: [
          "The first Pick tab shipped with Steam OpenID sign-in, Steam library import, IGDB search, common multiplayer suggestions, and session game voting.",
          "Steam and non-Steam games were unified into the same internal Game model, with anonymous manual additions still supported for invitees.",
          "Session tabs were introduced so the existing scheduling flow lives under Plan while game selection lives under Pick.",
        ],
      },
      {
        date: "17 June 2026",
        headline: "Cleaner invitee experience for recommendations",
        details: [
          "The Times worth locking panel became collapsible so hosts see recommendations by default while invitees land closer to availability entry.",
          "The panel keeps the same recommendation logic but adds a compact summary header, reducing scroll for new participants.",
          "This made the shared session page easier to use when someone opens a copied invite link for the first time.",
        ],
      },
      {
        date: "17 June 2026",
        headline: "Responsive visual redesign and availability improvements",
        details: [
          "The app received a warmer game-night visual system with a generated tabletop hero asset, clearer hierarchy, refined colour tokens, and more mobile-friendly layouts.",
          "Availability entry gained a better mobile flow, quick day actions, clearer heatmap styling, and support for showing times that are close but do not yet meet the minimum player count.",
          "Create-session and shared-session screens were reorganized around the main scheduling tasks while keeping server behaviour intact.",
        ],
      },
      {
        date: "16 June 2026",
        headline: "Initial game-night planner",
        details: [
          "The first working release introduced a When2meet-style planning tool for creating a game night, sharing a link, collecting availability, and finding the best time.",
          "Sessions supported participant responses, weekend-aware scheduling windows, share links, calendar export, and a basic deployment setup for Neon and Vercel.",
          "Core scheduling logic, Prisma models, server actions, and tests landed with the initial Next.js application structure.",
        ],
      },
    ],
  },
];

export default function ReleaseNotesPage() {
  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between gap-4 py-2">
        <Link href="/" className="flex items-center gap-2 text-base font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
        <Link href="/sessions/new" className="primary-button">
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">Plan a game night</span>
          <span className="sm:hidden">Plan</span>
        </Link>
      </nav>

      <header className="py-10">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Changelog</p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-ink sm:text-5xl">Release notes</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-ink/68">
          A reverse-chronological record of shipped updates, grouped by month.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section aria-labelledby="release-notes-heading" className="grid gap-8">
          <h2 id="release-notes-heading" className="sr-only">Site updates</h2>
          {releaseNotes.map((group) => (
            <section key={group.month} aria-labelledby={`month-${slugify(group.month)}`} className="surface rounded-xl p-5 sm:p-6">
              <h3 id={`month-${slugify(group.month)}`} className="text-2xl font-black text-ink">{group.month}</h3>
              <ol className="mt-5 grid gap-5">
                {group.entries.map((entry) => (
                  <li key={`${entry.date}-${entry.headline}`} className="rounded-lg border border-ink/10 bg-paper p-4">
                    <article aria-labelledby={`release-${slugify(entry.date)}-${slugify(entry.headline)}`}>
                      <time dateTime={toIsoDate(entry.date)} className="text-sm font-black uppercase tracking-[0.14em] text-teal">
                        {entry.date}
                      </time>
                      <h4 id={`release-${slugify(entry.date)}-${slugify(entry.headline)}`} className="mt-2 text-xl font-black text-ink">
                        {entry.headline}
                      </h4>
                      <div className="mt-3 grid gap-2 text-sm leading-6 text-ink/65">
                        {entry.details.map((detail) => (
                          <p key={detail}>{detail}</p>
                        ))}
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </section>

        <aside aria-labelledby="future-format" className="surface rounded-xl p-5">
          <h2 id="future-format" className="text-xl font-black text-ink">Future entry format</h2>
          <p className="mt-3 text-sm leading-6 text-ink/65">
            Keep entries short, dated, and outcome-led so the page stays useful as the product grows.
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="font-black text-ink">Date</dt>
              <dd className="mt-1 text-ink/62">Use `DD Month YYYY`, matching the release date.</dd>
            </div>
            <div>
              <dt className="font-black text-ink">Headline</dt>
              <dd className="mt-1 text-ink/62">One short sentence fragment focused on the user-facing change.</dd>
            </div>
            <div>
              <dt className="font-black text-ink">Details</dt>
              <dd className="mt-1 text-ink/62">Add 2-3 sentences: what changed, why it matters, and any notable caveat.</dd>
            </div>
          </dl>
        </aside>
      </div>
    </main>
  );
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toIsoDate(value: string) {
  const [day, month, year] = value.split(" ");
  const monthIndex = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ].indexOf(month);

  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}
