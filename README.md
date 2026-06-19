# Let's Play Games

A game-night planner for friend groups. The no-login session planner is the core
entry point; Steam/IGDB libraries, deals, recommendations and Discord layer on top.

## What is built

**Plan (no login required)**
- Create a shareable game-night session.
- Collect guest availability without accounts.
- Generate 1-hour availability slots from the host's date and time window
  (with optional separate weekend hours), timezone-aware.
- Rank the best times by available people, then maybe people, honouring the
  required session duration and minimum player count.
- Lock a session time (host only).
- Download a locked session as an `.ics` calendar invite.
- Share via copy link, QR code, WhatsApp, email, or copy-and-open Discord.

**Pick**
- Optional Steam login (OpenID) and library import, with graceful fallback to
  the public profile feed and manual game add when Steam data is unavailable.
- Game search, popular and trending lists via IGDB.
- Group ownership matching, player-count filter, match/alignment scoring, and a
  short progressive preference questionnaire.

**Buy / Deals**
- Live prices, deals and sale alerts via IsThereAnyDeal (when configured).

**Remind**
- Discord integration: announce locked times and send reminders via a Vercel
  cron job.

### Authorization model
The share token lets anyone open and join a session. Acting *as* a participant
or as the host requires a signed, httpOnly per-session cookie set when that
participant is created. Host-only actions (lock, remove game, deal settings,
price alerts) require the host cookie — so a leaked link cannot lock or vandalise
a session. Open the session on the device that created it to act as host.

## Local setup

Install dependencies:

```bash
npm install
```

Create an `.env` file. See [`.env.example`](.env.example) for the full list with
notes — `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` and `AUTH_COOKIE_SECRET` are the
minimum; Steam, IGDB, ITAD and Discord keys are optional and the app degrades
gracefully without them.

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
AUTH_COOKIE_SECRET="<openssl rand -base64 32>"
```

Apply the database schema (dev):

```bash
npm run prisma:migrate
```

On deploy, run migrations with `prisma migrate deploy` (not `migrate dev`).
For Neon free tier, point `DATABASE_URL` at the pooled endpoint
(`...-pooler...neon.tech`) with `?pgbouncer=true&connection_limit=1`.

For the default local Windows PostgreSQL install, you can create the local database and `.env` automatically:

```bash
npm run db:setup
```

Run the app:

```bash
npm run dev
```

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

PostgreSQL is required for the real create/share session flow. After installing it, create a database and set `DATABASE_URL` in `.env`, then run:

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
