# Let's Play Games

A game-night planner and game picker for friend groups. The app has two main
workstreams: **Plan** for finding a time, and **Pick** for choosing what to play.
Plan remains fully usable without an account. Pick workspaces use persistent
Google- or Steam-backed accounts so library matching works across sessions and
devices; public discovery remains open to everyone.

## What is built

**Plan a game night**
- Create shareable sessions with no account required for guests.
- Collect availability through a mobile-friendly day-by-day flow and a desktop
  heatmap with click-and-drag painting.
- Use quick actions for whole days: available, maybe, or out.
- Rank best times by available people, then maybes, honouring duration,
  timezone, date range, weekend hours, and minimum player count.
- Show "not enough players" recommendations while the group is still filling
  availability.
- Keep `Times worth locking` expanded for hosts and collapsed for invitees.
- Lock a time as host and download an `.ics` calendar invite.

**Pick games**
- Sign in with Google or Steam and choose a unique username before entering a
  Pick workspace.
- Maintain one persistent personal library with ownership, wishlist, favourite,
  1–10 rating, interest, played state, notes, Steam playtime, and recency.
- Start with Pick from the home page or switch to Pick from any shared session.
- Import Steam libraries through Steam OpenID and the Steam Web API, with
  graceful fallback messaging when profiles or game details are private.
- Search and add non-Steam games through IGDB-backed search and discovery.
- Treat Steam, IGDB, curated, and manually added games as one internal `Game`
  model.
- Build recommendations directly from selected friends' saved profiles without
  copying whole libraries into each session shortlist.
- Keep session-specific signals such as `Not tonight` separate from permanent
  ownership and ratings.

**Group matching and scoring**
- Select participants and a target player count for the recommendation run.
- Filter and categorize results by perfect matches, hidden backlog, old
  favourites, almost ready, sale opportunities, online co-op, local co-op,
  high/low playtime, and ownership fit.
- Score each game out of 100 with transparent factor breakdowns for ownership,
  player count, genre, availability, playtime, freshness, interest, price,
  popularity, personal ratings, session time, total commitment, and distinct
  multiplayer/co-op fit.
- Show alignment separately from average score so one strong mismatch can lower
  confidence even when the average looks high.
- Support scoring modes: Balanced, Co-op Night, Backlog, Cheap, Familiar, and
  Fresh.
- Offer short, optional preference prompts plus a deeper preference panel.

**Deals, alerts, and group buy**
- Use IsThereAnyDeal for live prices, discounts, shop URLs, and historical lows
  when `ITAD_API_KEY` is configured.
- Cache deal data so pages can render even when external APIs are slow or
  unavailable.
- Create in-app price alerts for under-price, group-on-sale, missing-player,
  historical-low, and N-of-M-owned discounted cases.
- Suggest "all buy a new game" options by budget, genre, player count, mode,
  platform, session length, owned-game exclusion, and sale-only preference.

**Curated discovery**
- Browse public discovery lists without signing in.
- Includes online co-op, local co-op, more-than-4-player games, party games,
  campaign co-op, survival groups, cheap co-op, trending multiplayer, recent
  releases, upcoming friend-slop, and games with multiplayer mods.
- Use the "I need at least" player-count slider to refine larger-group lists
  from 1 to 50+ players.
- Show player metadata, caveats such as server hosting or mods, and cached sale
  prices where available.
- Browse sourced co-op challenges with player requirements, difficulty,
  estimated attempt times, caveats, and persistent account progress.

**Sharing and Discord**
- Share sessions with a compact panel: copy link, Discord, WhatsApp, Messenger,
  email, and QR code.
- Preserve the active tab in shared URLs, so Pick sessions share directly into
  Pick.
- Add a Discord HTTP interactions MVP with `/letsplay create`, `/letsplay
  status`, `/letsplay remind`, and `/letsplay games`.
- Discord messages include buttons for filling availability, opening Pick,
  showing the current best time, and confirming attendance.
- Discord-linked sessions can announce locked times, send reminder pings through
  Vercel Cron, and post sale alerts.

**Persistent accounts and friend groups**
- Google and Steam can both create a cross-device account; linking remains
  explicit and provider conflicts offer a short-lived confirmed merge.
- Search usernames, exchange pending friend requests, block users, and keep
  full libraries friends-only.
- Export account data or permanently delete an account while leaving anonymous
  Plan sessions intact.
- Saved friend groups can be created from Pick sessions, invited by link, and
  reused to start future Pick sessions quickly.

### Authorization model

The share token lets anyone open and join a session. Acting *as* a participant
or as the host requires a signed, httpOnly per-session cookie set when that
participant is created. Host-only actions, such as locking a time, removing
games, changing deal settings, and managing price alerts, require the host
cookie, so a leaked link cannot lock or vandalise a session. Open the session on
the device that created it to act as host.

## Local setup

Install dependencies:

```bash
npm install
```

Create an `.env` file. See [`.env.example`](.env.example) for the full list with
notes. The required minimum is:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
AUTH_COOKIE_SECRET="<openssl rand -base64 32>"
```

Optional integrations:

```bash
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
STEAM_WEB_API_KEY=""
IGDB_CLIENT_ID=""
IGDB_CLIENT_SECRET=""
ITAD_API_KEY=""
DISCORD_APPLICATION_ID=""
DISCORD_PUBLIC_KEY=""
DISCORD_BOT_TOKEN=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
DISCORD_INSTALL_URL=""
CRON_SECRET=""
```

Apply the database schema in development:

```bash
npm run prisma:migrate
```

For the default local Windows PostgreSQL install, you can create the local
database and `.env` automatically:

```bash
npm run db:setup
```

Run the app:

```bash
npm run dev
```

## Production setup notes

Migrations are applied automatically on deploy: the `build` script runs
`prisma migrate deploy` (via `scripts/migrate-deploy.mjs`) before `next build`,
so adding a feature + migration no longer leaves production drifting with
`P2022 column does not exist` errors. The step is idempotent and skips when no
database is configured (e.g. a local build with no DB).

For Neon free tier, use the pooled connection string for `DATABASE_URL` in
production. The host usually contains `-pooler`, and the URL should include:

```txt
?pgbouncer=true&connection_limit=1
```

Migrations can't run over pgbouncer, so when `DATABASE_URL` is pooled, also set
`DIRECT_URL` to the Neon *direct* endpoint (host without `-pooler`). The migrate
step uses `DIRECT_URL` when present and falls back to `DATABASE_URL` otherwise.

To apply pending migrations manually (e.g. to fix the current database now):

```bash
npm run prisma:deploy        # uses DATABASE_URL from your environment
npm run challenges:seed      # idempotently populate/update sourced challenges
```

After setting Discord env vars, register slash commands:

```bash
npm run discord:commands
```

In the Discord developer portal, set the Interactions Endpoint URL to:

```txt
https://your-domain.example/api/discord/interactions
```

Vercel cron jobs are declared in `vercel.json`:

```txt
/api/cron/discord-reminders   # sends due Discord reminders
/api/cron/refresh-game-data   # keeps shared game metadata + prices fresh
```

Both are protected by `CRON_SECRET`.

**Shared game data cache.** Game metadata (player count, capability confidence,
reviews) and deals live on the shared `Game`/`GameDeal` rows keyed by Steam app
id — there is no per-user copy, so once a game is populated, every user who has
imported that same game gets it instantly. `refresh-game-data` runs daily over
the games actually in use (in a session shortlist or an imported library) to
fill in metadata for newly imported games and keep prices/sales current. It is
bounded per run (defaults: ~36 metadata + ~48 deal lookups) to fit one
serverless invocation and respect external API rate limits; large libraries
are spread across several daily runs.

Set `CRON_SECRET` in Vercel and send it as a bearer token for non-Vercel/manual
cron calls.

**Cron schedule and plan limits.** `vercel.json` uses a daily schedule
(`0 17 * * *`) because Vercel's Hobby plan only permits once-per-day cron jobs —
a more frequent expression (e.g. `*/15 * * * *`) fails deployment on Hobby. The
reminder job is safe at this cadence: each run sends every reminder that has
become due since the last run and dedupes by `(session, type, scheduledFor)`, so
no reminder is missed or sent twice — they are simply delivered up to ~24h late.
For timely reminders (e.g. "2 hours before"), upgrade to Pro and change the
schedule to a finer interval such as `*/15 * * * *`.

## Tool setup on Windows

The repo includes `dependencies.txt` as the source of truth for local tools.

Check what is installed:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dependencies.ps1
```

Install missing required tools from `dependencies.txt`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dependencies.ps1 -InstallMissing
```

PostgreSQL is required for the real create/share session flow. After installing
it, create a database and set `DATABASE_URL` in `.env`, then run:

```bash
npm run prisma:migrate
```

## Checks

```bash
npm test
npm run lint
npm run build
```

Or run the combined checker:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-all.ps1
```

The same combined checker is available through npm:

```bash
npm run test:all
```
