# Production code review — 23 August 2026

## Outcome

The application already had a sound product model: anonymous Plan workspaces,
account-backed Pick workspaces, a shared Game Night parent, persistent libraries,
friends and groups, deals, discovery, reminders, and a substantial automated
test suite. The review therefore kept that model and focused on gaps that could
produce incorrect recommendations, slow imports, weak conversion, or unsafe
production behaviour.

## Findings and changes

### Cross-platform matching was not represented

`UserGame` previously answered only whether someone owned a game. Two players
who owned incompatible editions could therefore receive a perfect-match label.

- Added platform-aware ownership for PC, Xbox, PlayStation, Nintendo Switch,
  and mobile.
- Added explicit cross-play metadata to the canonical `Game` record.
- Added same-platform, confirmed cross-play, unknown, and mismatch states to
  scoring. A known mismatch lowers group-play fit and alignment and is excluded
  from the Perfect category.
- Added Xbox gamertag and PlayStation online-ID fields plus library controls for
  console ownership.

### Account choice did not include Microsoft/Xbox

- Added a confidential web-app Microsoft OAuth authorization-code flow with the
  same signed, one-time state and explicit account-merge handling used by Google.
- The route and UI activate only when Microsoft credentials are configured.
- Xbox and PlayStation libraries are not scraped. Microsoft documents Xbox data
  access as a separately provisioned Xbox services flow, and no supported
  PlayStation library integration is configured for this product.

### Steam import still incurred avoidable database round trips

- Replaced per-game Prisma updates with a parameterised PostgreSQL bulk update
  of up to 500 rows.
- Replaced repeated shortlist and ownership-signal upserts with `createMany`,
  `updateMany`, and one lookup.
- Steam imports add PC ownership while preserving console platforms already
  recorded manually.

### Discovery and brand identity were too generic

- Replaced the generic tabletop image with an original responsive game-night
  decision illustration.
- Added real game-led Discovery spotlights and category cover mosaics.
- Added active desktop/mobile navigation states and more direct, playful copy.
- Kept Plan visibly anonymous while making the richer Pick value proposition
  and account requirement explicit.

## Architecture and operational notes

- The shared game catalogue and indexed canonical identifiers are the correct
  long-term base. Platform ownership belongs on `UserGame`; cross-play belongs
  on `Game`.
- Prisma/Neon is not inherently the source of the observed import delay. The
  dominant issue was application-level N+1 writes. Pooled `DATABASE_URL` and a
  direct migration URL remain the right Vercel/Neon topology.
- `src/app/actions.ts`, `src/components/pick-panel.tsx`, and the shared session
  page remain the largest change-risk areas. New domain logic should continue
  moving into focused services/components, but a wholesale rewrite would add
  regression risk without improving the released flows.
- Cross-play data should remain evidence-backed. Unknown is shown honestly and
  does not become a hard rejection; only explicit incompatibility does.

## Verification bar

- Prisma schema formatting and client generation
- TypeScript compilation
- ESLint
- Complete Vitest suite
- Production Next.js build
- Responsive browser checks at mobile and desktop widths, including horizontal
  overflow and remote game imagery
- Migration deployment and production smoke checks as part of release
