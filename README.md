# Let's Play Games

**A group of friends can never agree on when to play or what to play — this app collects everyone's availability and game libraries, then produces one ranked shortlist of times and games that actually work for the whole group.**

It's built for informal gaming groups (Discord servers, friend chats, co-op crews) who lose time every week to "when are you free?" and "what should we play?" threads. One shared link replaces both conversations.

## What it looks like

![Let's Play Games landing page, showing the availability heatmap and a ranked game match list for a sample "Friday crew" game night](docs/screenshot.png)

*Screenshot captured from the live deployment below.*

## Live demo

**[what-should-we-play-chi.vercel.app](https://what-should-we-play-chi.vercel.app)**

No account is required to try the core "Plan a night" flow — create a session, share the link, and watch availability roll in.

## Why it's built this way

A few deliberate product decisions shape the codebase:

- **Guests never need an account.** Planning a game night (the "Plan" workspace) is fully usable by anyone with the share link — availability, voting, and the final locked time all work anonymously. This removes the single biggest piece of friction in getting a group to actually respond.
- **Accounts only exist where they add real value.** The "Pick" workspace (choosing *what* to play) needs a persistent game library to be useful across sessions, so it requires signing in with Google, Microsoft, or Steam. Everything else stays account-free by design.
- **A link can join a session, but not act as its host.** Anyone with the share link can open and participate in a session. Host-only actions (locking a time, removing games, managing price alerts) require a signed, httpOnly per-session cookie issued when that person created the session — so a leaked link can't be used to vandalise it.
- **Shared game metadata, not per-user copies.** Game details, popularity, and prices live on shared `Game` rows keyed by title/platform rather than being duplicated per user. Once one person imports a game, every other user who owns it benefits from the same cached metadata and correctly-priced deals.
- **Degrade gracefully when third-party APIs are absent or fail.** Steam, IGDB, and IsThereAnyDeal integrations are optional. Without their API keys configured, the app still runs — it just falls back to public feeds or shows less enrichment instead of breaking.

## Solution and architecture

Next.js (App Router) + TypeScript, PostgreSQL via Prisma, deployed on Vercel.

**Plan a game night** — participants mark availability across a proposed date window (day-by-day on mobile, a click-and-drag heatmap on desktop). The app ranks candidate times by how many people are available (then "maybe"), factoring in minimum player count, timezone, and preferred hours, and lets the host lock a time and export an `.ics` calendar invite.

**Pick a game** — each signed-in user maintains one persistent library (owned, wishlist, rating, platform, playtime, notes), built from a Steam import (via Steam OpenID + the Steam Web API), manual entry, or IGDB search. For a chosen set of participants, a scoring engine (`src/lib/match-scoring.ts`) ranks games out of 100 using weighted factors — ownership overlap, player count fit, genre, platform/cross-play compatibility, playtime, freshness, personal ratings, and more — across selectable modes (Balanced, Co-op Night, Backlog, Cheap, Familiar, Fresh). Results are grouped into categories (perfect matches, hidden backlog, sale opportunities, etc.) rather than one long list.

**Deals and alerts** — when `ITAD_API_KEY` is set, live prices and historical lows are pulled from IsThereAnyDeal and cached so pages stay fast even when the upstream API is slow. Users can set price/availability alerts, and a daily Vercel Cron job (`/api/cron/refresh-game-data`) keeps shared game metadata and prices current.

**Discord integration** — a slash-command MVP (`/letsplay create|status|remind|games`) lets a session be created and checked without leaving Discord, with interactive buttons for filling availability and confirming attendance.

Key directories:
- `src/app` — routes (Plan, Pick, Discover, account, Discord webhook, cron endpoints)
- `src/lib` — scoring, scheduling, Steam/IGDB/ITAD clients, auth
- `src/components` — shared UI
- `prisma/schema.prisma` — data model (sessions, availability, games, libraries, price alerts, friend groups, etc.)
- `audit/` — a reproduction suite of explicitly-expected-failure tests documenting known baseline defects from an internal architectural review (see `docs/reviews/`)

## Verified quality evidence

- **Automated tests:** [Vitest](https://vitest.dev/) unit/component tests — **163 tests across 50 files, all passing** as of this write-up (`npm test`).
- **CI:** GitHub Actions (`.github/workflows/quality.yml`) runs on every pull request and push to `main`: `npm test`, `npm run lint`, `npm run build`, on Node 22.
- **No end-to-end/browser test suite yet.** The core flows above were manually verified against the live deployment while writing this README, but there is no Playwright/Cypress coverage in the repo at this time.
- **Internal audit trail:** the repo also tracks its own architectural review process in the open (`docs/reviews/`, `CODE_REVIEW_2026-08-23.md`, `UX_AUDIT.md`), including a dedicated `audit/` test suite that encodes known defects as expected-failing tests until they're fixed.

## Setup and local development

Requires Node.js and a PostgreSQL database (Neon works well for the free tier; a local Postgres install also works).

```bash
npm install
```

Copy `.env.example` to `.env` and fill in, at minimum:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
AUTH_COOKIE_SECRET="<openssl rand -base64 32>"
```

Everything else in `.env.example` (Google/Microsoft/Steam sign-in, IGDB, IsThereAnyDeal, Discord) is optional — the app runs without them, with reduced functionality in those areas.

Apply the database schema, then run the app:

```bash
npm run prisma:migrate
npm run dev
```

On Windows, `npm run db:setup` can create a local database and `.env` automatically for the default local PostgreSQL install; see `dependencies.txt` and `scripts/check-dependencies.ps1` for the full local tool list.

Run the checks used in CI:

```bash
npm test
npm run lint
npm run build
```

**Verified for this README:** `npm install` and `npm test` were run fresh from a clean clone on 2026-09-14 — 163/163 tests passed. `npm run build` and the full Postgres-backed flow were not re-verified here since they need a provisioned database; see the CI badge/workflow above for the authoritative build check on every push.

## Current limitations and project status

- Side project, actively maintained by a single developer — not a polished commercial product.
- No end-to-end browser test coverage yet (see Verified quality evidence above).
- PlayStation has no supported library API, so PS ownership is recorded manually rather than imported.
- Xbox sign-in uses Microsoft identity only; it does not pull an Xbox library automatically.
- The Discord integration is an MVP (`/letsplay create|status|remind|games`); reminder cadence is daily on Vercel's free (Hobby) plan due to cron plan limits, so short-notice reminders aren't reliable without upgrading the plan or using an external scheduler.
- The `docs/reviews/` and `audit/` material documents specific, known correctness gaps that are not yet fixed — see those files for the current list rather than assuming full correctness from the feature list above.

## Attribution, data provenance, and licensing

- **Game data and pricing** are sourced from [IGDB](https://www.igdb.com/) (via Twitch) for search/discovery metadata, the [Steam Web API](https://steamcommunity.com/dev) for library imports and artwork, and [IsThereAnyDeal](https://isthereanydeal.com/) for live prices and historical lows. All three are optional integrations gated behind their own API keys.
- **Sign-in** is provided by Google and Microsoft OAuth, and Steam OpenID.
- **Licensing status:** this repository does not currently declare a license (no `LICENSE` file is present). All rights are reserved by default under GitHub's terms until a license is added — that is a separate, upcoming step and not addressed by this README update.
