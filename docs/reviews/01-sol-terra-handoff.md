# Dimension 1 — Sol and Terra execution handoff

Companion: [architectural audit and source evidence](01-architectural-integrity.md). Baseline `fe110fe1132a630678c4e34206f3ceaad5979b9d`, reviewed 9 September 2026.

**Status: proposed implementation plan. No execution agents have been launched and no product fixes are included in the audit commit.** Finish and deploy dimension 1, review its evidence with the user, then begin dimension 2. Do not treat this document as authorization to expand into the other four dimensions.

## Outcomes and policy defaults for review

These defaults make the plan executable without asking Sol or Terra to invent product policy. They are recommendations for the phase review, not claims that the current application implements them.

| Decision | Proposed contract |
|---|---|
| Membership | Plan remains account-free. Pick requires an onboarded account and explicit idempotent joining; Steam is optional. Joining grants limited matching visibility within that session. |
| Privacy | A public link can show the night title, public plan summary and join entry. Private match inputs/results require membership and permitted participant sharing. Full libraries are self/accepted-friend only; public favourites expose title/art only. Blocks suppress counterpart library access across profiles, groups and matching. |
| Ownership | `UserGame` is authoritative for linked accounts. Shortlisting expresses a suggestion, not ownership. Anonymous/legacy session ownership remains a separately labelled fallback only where supported. `NOT_TONIGHT` never changes permanent ownership or interest. |
| Group size | Pick's target player count must be an integer at least as large as the explicitly selected member count. If greater, results are provisional for unknown guests. If smaller, return a validation error asking the user to deselect people. No perfect result while required profiles are missing. |
| Capacity browsing | Discovery's “at least N capacity” is distinct from an exact N-person recommendation. Show a game's actual minimum and maximum. On transition to Pick, carry N as the requested group size and re-evaluate exact eligibility. |
| Limits | Preserve Plan's existing 2–30 minimum-player creation bound. Support Pick/Discovery 1–50 in this phase, with 50 displayed literally rather than asserting unbounded support; 50+ browsing can mean capacity >=50 but must never claim an exact larger party was verified. Saved groups above the supported Pick limit return a useful validation result. |
| Mode/setup | `online`, `local`, or `either`; separately `native`, `modded`, or `either`. Default to native in new Pick sessions. A Discovery match dependent on mods passes an explicit modded setup with caveats rather than silently pretending native support. |
| Hard constraints | Known incompatible capacity/mode/platform, known excessive minimum session time, and known wrong explicit commitment tier are ineligible for the main list. Unknown critical data is a visibly uncertain result, never perfect. No hard claim about per-platform/mode limits when the stored metadata only supports a weaker conclusion. |
| Preference vs veto | Soft preferences change ranking. A selected user's session veto or persistent NOT_INTERESTED prevents Perfect and is visible; keep a labelled vetoed section available rather than silently discarding the preference evidence. |
| Budget | Per-person purchase price in integer minor units for the active market/currency. Known over-budget prices are excluded from budget-qualified buys. Missing/incompatible-currency prices are unknown, not free or verified affordable. |
| Tags/genres | Normalized exact tokens/aliases. Within a multi-select facet use an explicit documented operator (default all selected tags; any selected genre); combine different facets with AND. No accidental whole-input substring matching. |
| Duration | Scheduling duration is elapsed real time. Pick's session-length and commitment settings are constraints with unknown states, distinct from long-term preference weights. |
| History | “Hide from history” preserves participation and permissions using separate visibility state. “Leave” revokes membership/consent and is an explicit separate action. Host delete retains its existing destructive confirmation. |
| Live updates | Correctness on mutation response, refresh and return navigation is required here. Do not add polling/WebSockets/cache infrastructure until the later UX/performance review establishes the need. Concurrent draft conflicts must still be detectable. |

## Shared contracts: implement once, then consume

Suggested file names below are target boundaries; they do not already exist. Keep implementation within the installed Next.js 16.3 / React 19 / Prisma 5.22 stack and free tooling. Add small types/services, not a generic framework.

```ts
type SessionActor =
  | { kind: 'visitor' }
  | { kind: 'guest'; participantId: string; sessionId: string; isHost: boolean }
  | { kind: 'member'; userId: string; participantId: string; sessionId: string; isHost: boolean }
  | { kind: 'owner'; userId: string; sessionId: string; participantId: string | null };

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' |
      'NOT_FOUND' | 'CONFLICT'; message: string; fieldErrors?: Record<string, string> };

type Eligibility = {
  status: 'supported' | 'unsupported' | 'uncertain';
  reasons: Array<{ code: string; message: string }>;
  // Record which capability/setup proved or failed the match.
  setupId?: string;
};

type PickConstraints = {
  selectedParticipantIds: string[]; // unique, session members only
  selectionExplicit: boolean;     // distinguishes none from defaults
  playerCount: number;
  mode: 'online' | 'local' | 'either';
  setup: 'native' | 'modded' | 'either';
  sessionMinutes: number;
  commitment: CommitmentFilter;
  platforms: GamingPlatform[];
  genres: string[];
  tags: string[];
};

type MatchSnapshot = {
  asOf: Date;                     // one time per evaluation
  complete: boolean;             // never silently rank a truncated population
  participants: PermittedParticipantDTO[];
  candidates: CanonicalCandidateDTO[];
  ownership: OwnershipMatrix;   // gameId -> participantId -> evidence/state
  constraints: PickConstraints;
};

type RecommendationDTO = {
  gameId: string;
  sessionGameId: string | null;   // no synthetic IDs sent to mutation endpoints
  eligibility: Eligibility;
  score: number;
  contributions: ScoreContribution[]; // reconciles to the shown score
  reasons: string[];
  actions: { canShortlist: boolean; canSignal: boolean; canChooseFinal: boolean };
  detailHref: string;
};
```

Define the referenced DTOs in P00/P03 rather than importing Prisma row types into client components. Include provenance and unknown ownership/platform states; exclude email, provider account objects, notes, authentication fields and unauthorized ratings. Capability representation must not collapse Steam storefront ownership, console generation, native online modes and modded setups into one unsupported global boolean. Preserve broad platform aliases for display, but treat version/edition compatibility as unknown unless evidence supports it.

### Required invariants

1. Reads and writes resolve the same actor; no request-supplied role or arbitrary participant ID establishes authority.
2. A participant's identity cannot be replaced by another account merely because both used the same browser.
3. Each session/user, night/workspace type and session/game has at most one row. A retried successful command returns the existing result or a precise conflict.
4. For a selected set S: `have + dontHave + unknown = |S|`; every count is between zero and |S|. Target guests are reported separately.
5. For fully known capacity and exact target N: `min <= N <= max`. A missing bound is unknown unless an explicit unbounded capability is established. A maximum-capacity browse is a separate predicate.
6. Same-platform fit requires a common compatible platform across **every** required owner's relevant set; missing sets cannot be dropped. Confirmed cross-play requires evidence covering every required player/setup. Missing profiles keep confidence provisional.
7. `perfect` implies supported eligibility, complete required profiles/ownership, compatible setup, no veto and no strong mismatch. It cannot coexist with Low alignment.
8. Adding a shortlist candidate changes neither persistent ownership nor confirmed capability metadata.
9. Eligibility and ordering are invariant under permutations of input rows. Scoring uses one supplied clock value and a final canonical-ID tie-breaker.
10. A selected final game belongs to the night’s PICK workspace. Removing it clears the relation safely; retries cannot select an unrelated game.
11. Every scheduled slot represents one unique real hour. Candidate slots are adjacent in UTC and elapsed duration equals the requested duration.
12. Invalid input produces no partial domain writes. Explicit field clear is distinguishable from omitted field update.
13. Blocked/nonmember readers receive no private library-derived DTOs. Joining or leaving updates matching authorization independently from history visibility.

## Packet order and ownership

Sol owns domain/data/authorization changes; Terra owns bounded client/route integration after those contracts settle. These are proposed assignments, not requests to create new Codex tasks automatically. Use the user's configured Sol/Terra versions when execution is requested. Require a principal review of authorization, reconciliation and migrations.

| Packet | Primary | Findings | Dependencies | Target size |
|---|---|---|---|---|
| P00 Contract and test foundation | Sol | Cross-cutting | None | 1 focused PR |
| P01 Actor resolution and safe redirects | Sol | F01, F02, F15 | P00 | 1 focused PR |
| P02 Join and privacy policy | Sol | F03, F16 | P01 | 1 focused PR |
| P03 Canonical capabilities and catalog writes | Sol | F06, F12 | P00 | 2 PRs: safe writes; verified reconciliation |
| P04 Complete matching snapshot | Sol | F04 | P02, P03 | 1 focused PR |
| P05 Eligibility/scoring/group-buy correctness | Sol | F06, F07, F10 | P03, P04 | 2 PRs: eligibility/scoring; group-buy |
| P06 Atomic shortlist and final-choice commands | Sol | F05, F08, F14 | P01, P03 | 1 focused PR |
| P07 Query state and join integration | Terra | F03, F09, F10 | P02; P00 query contract | 1 focused PR |
| P08 Actionable recommendations and details | Terra | F08, F09 | P04, P05, P06, P07 | 1 focused PR |
| P09 Real-time scheduling semantics | Sol | F11, availability part of F14 | P01 | 1 focused PR plus bounded Terra labels |
| P10 Account and social state integrity | Sol | F13, F14, F16 | P01, P02 | 2 PRs: merge; history/conflicts |
| P11 Discord host handoff | Sol | F17 | P01, P02 | 1 focused PR |
| P12 Error and client-state reconciliation | Terra | F18, field-clear UI part of F14 | P01, P02, P06; P07/P08 for final adapter pass | 1 focused PR |
| P13 Release qualification | Sol, Terra verifies UI | All | All required fixes | final evidence gate |

Working independently is safe only after interfaces are merged. Shared hotspots (`src/app/actions.ts`, session page, `pick-panel.tsx`, schema) need one owner at a time. Extract small modules first; do not assign simultaneous edits to those same files. Terra can implement scheduling labels after P09's slot DTO is fixed. P10 and P11 can run independently of scoring if execution is later delegated.

## Packet specifications

### P00 — Contract and test foundation (Sol)

**Objective:** Establish the shared types, actual route tests and a safe PostgreSQL integration harness.

**Files:** new `src/lib/pick/contracts.ts`, `src/lib/session/contracts.ts`, `src/lib/pick/query.ts`; actual session-route tests; `audit/dimension-1/*`; package/test configuration only where needed.

**Work:** Translate the policy defaults into typed parsers and fixtures. Replace the misleading Home test under the session route with a real route test, preserving the Home assertion in its proper suite. Keep provider/database mocks explicit. Add an integration suite using a disposable local PostgreSQL database/schema; require an unmistakable test target and refuse a production target. Do not run `scripts/test-all.ps1` against production: it calls development migrations. Make CI/release checks include tests/lint/build (Vercel's current build alone does not run the test suite).

**Acceptance:** Fixtures for 0/1/2/4/8/30/50 members, complete/partial/unknown libraries, cross-platform owners, one veto, duplicate titles and >500 ownership rows. All current expected failures are mapped to packets. A test can create and remove only its isolated namespace. No application behavior or data migration is required for this foundation.

### P01 — Actor resolution and safe redirects (Sol)

**Files:** new `src/lib/session/authorization.ts`; `src/lib/auth.ts`, `participant-identity.ts`; host/participant guards in actions, account/provider callbacks and session page; redirect tests.

**Work:** Implement account-first actor resolution with anonymous-cookie fallback only for anonymous rows. Preserve valid host authority on refresh, validate linked-cookie ownership, make logout/rotation/claim consistent, and authorize an actual GameNight owner even if a legacy host row requires repair. Canonicalize return URLs. Return structured expected authorization failures while preserving framework redirects at route boundaries.

**Acceptance:** Anonymous create → availability → lock works; link-only guest cannot edit/lock/remove/change price settings; linked host works on another signed-in device; account switching cannot act as the old participant; conflicting cookie cannot block the new account's legitimate membership; tampered/expired sessions fail closed; slash/backslash, protocol-relative, absolute, control-character and valid internal destinations are covered. Convert F01/F02/F15 failures to normal passing tests. Inspect all server action callers, not just the displayed buttons.

**Migration:** Prefer a versioned cookie rollout compatible with legacy reads; no role escalation from legacy data. If data repair is necessary, report exact affected rows and retain an audit trail.

### P02 — Explicit joining and privacy boundary (Sol)

**Files:** new `src/lib/session/membership.ts`, `src/lib/pick/access.ts`; join server action; profile, session, group/friend read paths and DTOs.

**Work:** Add idempotent `joinPickWorkspace` for active accounts, independent of provider. Enforce the reviewed member-sharing policy before loading library rows. Centralize bidirectional block checks. Strip private values from public favourites. Ensure saved-group auto-membership uses permitted accepted memberships and does not resurrect blocked users. Leave a public summary available to link holders.

**Acceptance:** Signed-in Google/Microsoft/manual-library user joins a new link in one action; two simultaneous joins create one participant; user without an account goes through auth/onboarding with the exact destination retained. Nonmember and blocked-user tests return no private titles/ownership/ratings/playtime; accepted session member can match only permitted profiles. Public favourite cards contain no ownership/rating/playtime fields in HTML or RSC/client props. Existing invite one-use behavior remains correct.

**Migration:** If explicit per-session sharing consent needs persistence, add an additive field/relation with conservative defaults. Do not invent consent for all historical link holders. Accepted reusable-group members may use the reviewed group-sharing contract; document the backfill interpretation.

### P03 — Canonical capability semantics and safe catalog writes (Sol)

**Files:** `src/lib/games.ts`, `curated-metadata.ts`, `match-scoring.ts` fallback, relevant admin writers; new `src/lib/catalog/identity.ts`, `src/lib/catalog/capabilities.ts`; schema/migration only if needed to retain mode/setup provenance.

**Work, PR 1:** Fix sparse updates: absent metadata remains absent, false stays false. Stop generic multiplayer → co-op and arbitrary max=4/8 inference. Resolve explicit admin/verified setup facts before static fallbacks; use curated data only where it supplies otherwise missing facts. Define mode/setup-specific capability projection over existing `Game`/`GameCapability` data. Unknown bounds and unsupported platforms remain unknown/unsupported as appropriate.

**Work, PR 2:** Generate a read-only potential-duplicate report grouped by verified provider IDs/links and ambiguous title matches. Unify only demonstrated same-game identities with deterministic survivor IDs, dependent-row conflict rules and redirect aliases if necessary. Include UserGame, SessionGame, signals, interests, selected final choice, capabilities, deals, prices, challenges and any plain-ID references in the dependency inventory. Do not merge editions based on title normalization alone.

**Acceptance:** A title-only update preserves all verified capability facts. Generic competitive multiplayer is not co-op. Admin correction survives matching. A selected modded setup has consistent bounds through all consumers; native settings do not inherit modded capacity. Verified manual/provider linkage yields one canonical match identity without losing owners or final choice; ambiguous editions stay separate. Reconciliation dry-run, idempotent repeat and rollback mapping are mandatory. No provider scraping redesign is included.

### P04 — Complete selected-group match snapshot (Sol)

**Files:** new `src/lib/pick/load-match-snapshot.ts`, `src/lib/pick/ownership.ts`; session page `:212–451`; readiness inputs for `PickPanel`; remove obsolete ownership-copy reads once callers migrate.

**Work:** Build the selected-user candidate union and full per-game matrix from authorized `UserGame` rows. Use selected participants, not arbitrary `addedByUserId`, to define the required group. Apply explicit guest/legacy fallback once. Use canonical IDs throughout. Reuse that same matrix for scoring, shortlist counts, group-buy exclusions and readiness. Do not let the global `take:500` change completeness. Keep provider search/suggestions separate from match inputs so they do not alter ownership semantics.

**Acceptance:** Same game has identical ownership/eligibility before and after shortlisting, import and persistent library edits. A co-owner whose candidate discovery row is beyond 500 is still counted; a sole shared game below row 500 is discoverable; duplicate candidate rows do not duplicate owners. No selected user is starved by another's large library. 0/1/partial groups never invent owners. Matrix totals obey the invariant and are permutation-independent. Convert both F04 reproductions. Report fixture size and correctness results; query benchmarking belongs to dimension 3.

### P05 — Eligibility, scoring and group-buy (Sol)

**Files:** new `src/lib/pick/eligibility.ts`; `match-scoring.ts`, `group-buy.ts`; curated filtering adapters and expanded property/table tests.

**Work:** Evaluate reviewed hard constraints before ranking. Use separate unknown/vetoed states. Make Perfect derived from explicit prerequisites; platform evaluation includes every selected owner/required guest. Validate target count against selected profiles. Calculate co-op category counts from capabilities. Inject `asOf`, cap/clamp only valid finite scores, define stable total ordering and enumerate every displayed score contribution. Group-buy uses exact candidate predicates, authoritative ownership, explicit price knowledge/currency and reviewed tag operators.

**Acceptance:** Vetoed/unknown-platform/incomplete/overfilled groups cannot be Perfect. A 2-player game cannot be confirmed for 4 selected participants. Unknown max with min=1 cannot confirm 50. Capacity endpoints are inclusive. Mode/platform/tag combinations are commutative and deterministic. Contradictory constraints return an explained empty/invalid result. Known too-long/wrong-commitment results are excluded or separated according to policy. Scores stay finite within 0–100 and reconcile after rounding; freeze-clock and shuffled-input tests pass. One-night results never fabricate long-term sections. Budget 0, free price 0, null price, wrong currency, over-budget and no matching category cases are covered.

### P06 — Atomic shortlist and final-choice commands (Sol)

**Files:** new `src/lib/pick/commands.ts`; `addSessionGameAction`, `createPickSessionAction`, signal/final/remove actions; shared catalog resolution; affected invalidation helper.

**Work:** Split shortlist, persistent ownership and session interest commands. Resolve server-known curated games even before a Steam row exists. Idempotently persist candidate → sessionGame; provide typed results to Terra. Validate identity/workspace/game relations inside the write boundary. Initial-night creation plus initial shortlist needs a transactional design after catalog resolution. Scope any retry to idempotent database writes; do not repeat external side effects.

**Acceptance:** “Suggest” leaves ownership untouched; “I own it” updates the canonical personal row; Not tonight affects only this session. Double Add yields one shortlist row. Selecting/removing works only for the authorized host and correct night. Removing the final choice safely clears it. Fail a dependent write and verify no half-applied domain state. Valid fresh curated Steam games can be added without an import prerequisite. Convert F05 audit tests to their corrected contracts.

### P07 — Canonical query state and joining UI (Terra)

**Files:** session page parsing adapter, `PickPanel` GET forms, Discovery/list/detail/new-Pick links, `PlayerCountFilter`, account-library pagination parser; consume P00/P02 contracts.

**Work:** Render explicit join/read-only/member states. Use one serializer preserving selected users, player count, mode/setup, search, scoring mode, time/commitment and group-buy filters. Encode true and false rather than relying on absent checkbox behavior. Validate/query-normalize integers and enum arrays at the server boundary. Show conflicting group-count/empty selection errors without discarding choices. Carry the Discovery count and setup through detail → auth → new Pick. Avoid hidden resets on back/forward navigation.

**Acceptance:** Changing only search does not reset the chosen four-person group; changing group-buy budget does not reset matching; toggling avoid-owned off persists through refresh/share. Duplicates/foreign IDs are discarded/rejected consistently and the displayed count equals the selected set. None-selected is represented explicitly. Infinity, NaN, fractions, repeats, negative and excessive page/count values cannot reach Prisma or scoring. A 5-player modded Discovery choice opens a Pick with the reviewed 5-player modded constraint. Signed-in non-Steam visitor can join directly. No visual redesign is required.

### P08 — Actionable match cards and canonical details (Terra)

**Files:** `RankedMatchList`, `PickPanel` card adapters, game detail route/adapter, shortlist/final selection affordances; use P06 actions and P05 DTOs.

**Work:** Give every permitted recommendation a usable detail route and shortlist action. Reconcile returned `sessionGameId`; render session preference/final action only when supported. Make remaining results reachable with pagination/show-more. Keep score explanation complete and label unknown/vetoed/provisional states. Preserve the current style and existing accessible controls. General canonical detail routing must coexist with old curated-slug links.

**Acceptance:** A game present only in saved libraries can be found → inspected → shortlisted → vetoed/unvetoed → selected as final by host → seen on GameNight overview. Repeat with a non-Steam canonical game and a modded candidate. Game 17 and uncertain game 5 are reachable. Members cannot choose/remove as host; visitor actions show join. Unknown or vetoed results do not carry contradictory labels. Refresh/back/forward and narrow/mobile layouts preserve usable actions. A modal is optional and must not become a prerequisite for the correct journey.

### P09 — Scheduling and availability concurrency (Sol; Terra labels)

**Files:** `scheduling.ts`, availability command/service, relevant session display and ICS tests, `AvailabilityForm` slot labels/revision handling.

**Work:** Enumerate unique UTC instants that fall inside local date/hour windows. Generate candidates by adjacency and exact elapsed duration; distinguish repeated wall times. Validate the complete payload before participant writes. Add revision checking for replacement saves and a typed stale-draft conflict. Continue allowing a host's explicit low-attendance lock while rejecting invalid windows.

**Acceptance:** Spring 2026-03-29 and autumn 2026-10-25 London windows, America/New_York transitions, Asia/Kolkata, weekdays/weekends, required duration > available hours, month/year boundaries, midnight/24:00 and all-maybe/missing responses. UI emits only permitted unique keys. Two tabs saving the same revision cannot silently clobber each other. A failed slot validation creates no participant. Guest isolation, host save/lock and ICS open/export still work. Terra changes labels only after the slot contract is fixed.

**Migration:** An additive `availabilityRevision Int @default(0)` on Participant or an equivalent reviewed revision record is a reasonable choice. Use atomic conditional increment/update in the same transaction as replacement writes; do not use process-local locks.

### P10 — Account merge, history and social state (Sol)

**Files:** `account-merge.ts`, account/library actions, history UI adapter, friend/block/group command services; migrations where history visibility/revision requires them.

**Work, PR 1:** Atomically consume merge intent; preserve source/destination host authority and defined field/conflict precedence. Ensure blocks dominate merged friendships, and retained-email verification has matching provenance. Keep merge audit data sufficient to diagnose affected records without exposing it to clients. Preserve username/provider uniqueness and existing different-Steam-account rejection.

**Work, PR 2:** Explicit null clears for library fields, partial update semantics, hide-history independent of leave, and idempotent/conflict-aware membership mutations. Apply the block policy to accepted groups and all re-entry paths. Do not change general social-product features beyond consistency.

**Acceptance:** Destination guest + source host retains functioning host actions; conflicting responses/signals follow documented precedence and survive rollback on failure. Repeated/concurrent merge confirmation cannot apply twice. Clear rating/notes really clears them; untouched fields remain intact. Hide history leaves matching unchanged; leave removes future participation/visibility as designed. Opposite-direction friend requests, accept vs block, and block after group acceptance never restore unauthorized library access. PostgreSQL integration tests must cover these races; mocked Prisma tests alone are insufficient.

### P11 — Discord creator handoff (Sol)

**Files:** Discord create handler/response, a narrowly scoped single-use handoff service/route, actor resolver integration, token schema if needed.

**Work:** Bind a handoff to the verified creating Discord user, exact session/participant and short expiry. Deliver the capability only through an ephemeral creator-visible response or a supported verified account-link flow. Exchange it once for a signed host identity; keep public share links unprivileged. Reuse the same validation/creation service as the web path.

**Acceptance:** Signature-verified synthetic create response contains the creator-only handoff while channel-visible content contains no capability. Redemption by the intended flow succeeds once; expired/replayed/wrong-session and link-only attempts fail. Browser host can subsequently submit and lock. Do not send live Discord test messages without explicit authorization; synthetic signed requests and an isolated HTTP test can establish the implementation contract, with live verification reported separately if later authorized.

### P12 — Typed failures and client state (Terra)

**Files:** shared action-result UI adapters, `GameSignalControls`, `AvailabilityForm`, `PostImportStatus`, `AppNavigation`, affected route error boundaries and stale-state tests.

**Work:** Display expected validation/auth/conflict outcomes beside the control while retaining input. Handle unexpected failures with useful scoped retry/digest feedback. Tie optimistic signals to mutation identity/revision; disable or serialize incompatible pending writes per participant/game. Reconcile server-prop changes without overwriting an unsaved draft. Derive import readiness from actual updated results; refresh the auth projection after account changes. Clean up one-shot effects, including Strict Mode setup/cleanup correctness. Add centralized affected-route invalidation tests instead of arbitrary refresh timers.

**Acceptance:** Save rejection keeps the draft and gives an actionable error; stale/failed optimistic writes cannot undo a later confirmed value. Account change updates the header without a full manual reload. Back/forward and prop refresh update applied filters and signals predictably. Strict Mode leaves import status functional. Unmounting prevents stale result writes; no timer/listener accumulation appears in repeated mount/unmount tests. Unexpected route errors have a usable recovery path, and retry does not duplicate writes.

## Verification matrix for P13

Use a real isolated PostgreSQL instance and two independent browser contexts. Synthetic accounts/provider responses are acceptable locally; distinguish them from real provider-login verification in the release record. Do not test by modifying existing personal accounts.

| Scenario | Required evidence |
|---|---|
| Anonymous Plan lifecycle | Create, save all/partial/maybe availability, host authority survives, second guest cannot impersonate, lock override is deliberate, ICS timestamps verified. |
| Non-Steam Pick lifecycle | Existing onboarded account joins without Steam; library-only recommendation reaches detail, shortlist, session veto, final choice and overview. |
| Ownership mutation | Change ownership once; all relevant existing/future sessions use the updated source, category and counts after reload. |
| Adversarial query matrix | Repeated/foreign/empty participants, malformed numerics, mixed filters, zero budget, tags and setup conflicts produce canonical results or useful errors. |
| Capability matrix | Exact boundary sizes, unknown bounds, platform intersection, missing platforms, verified cross-play, native/modded alternatives and edition uncertainty. |
| Large-group library correctness | >500 combined rows, sole shared candidate below prior cutoff, uneven user library sizes; complete set and owner counts verified. |
| Consent and block matrix | Visitor/member/owner/friend/blocked/ex-member/account-switch reads and actions; inspect serialized client data as well as visible text. |
| Concurrent operations | Double join/add/select/merge; stale availability save; block vs friend acceptance; fail between related writes; verify invariant-preserving database state. |
| Date/time matrix | Both DST transitions and non-DST controls; distinct repeated labels and contiguous UTC windows; browser locale differs from session zone. |
| Recovery | Validation, unique constraint, database failure, unauthorized actor and delayed/rejected mutation preserve usable state. Provider retry behavior itself is phase 2. |

Add table/property tests for permutation invariance and bounded counts/scores; they should test domain promises rather than snapshotting implementation details. Keep the current 111 tests unless a documented behavior correction requires a corresponding assertion change. Remove `it.fails` per repaired audit invariant, and remove/convert the three tests that intentionally document old behavior. The final implementation suite must not claim expected failures as passed regressions.

## Deployment sequence, schema changes and rollback

The repository's `AGENTS.md` requires validation, relevant documentation/comments, a commit of intended files and a push to the current configured remote, plus required Vercel/database work for product changes. Each execution packet must follow that policy. Follow an existing PR/review workflow when present and add a concise implementation/status comment there; do not create unrelated user tasks.

Suggested deployment milestones:

1. **A — Identity and safe writes:** P00–P02, P03 safe writes, P06, P07 join subset, redirect/privacy/error adapters needed for these commands. This closes the highest-risk authority and metadata mutations early while maintaining old read compatibility.
2. **B — Correct and actionable matching:** P03 verified reconciliation where required, P04–P08 and the relevant P12 adapters. Deploy the new snapshot/eligibility/query/card contract as one compatible slice. Do not deploy a DTO producer separately from an incompatible consumer.
3. **C — Scheduling and account lifecycle:** P09–P12 remainder, then P13 full qualification. These changes may ship earlier as independent compatible fixes if verified; dimension 2 still waits for the combined dimension-1 release gate.

**Before each product deployment:** Inspect actual checkout/remote state and preserve unrelated files. Run targeted tests, full suite, lint, type/build checks and isolated database integration tests appropriate to the change. Read the Vercel/Prisma release scripts and establish the currently linked project/domain; verify credentials without printing secrets. Use preview builds without production migrations. Check current migrations before proposing new ones.

**Schema:** Prefer additive changes for revision/consent/history/handoff/alias records. Existing membership/workspace/game uniqueness already exists: reuse it. Migration scripts must first report affected legacy rows and conflict categories; use reviewed mapping rules and bounded transactions. Reconciliation must be repeatable, retain provenance and have a restore map. No automatic title-only merge and no destructive reset/seed of user data. No performance indexes/materialized views are commissioned by this phase.

**Production:** Generate Prisma, validate and deploy required migrations with `DIRECT_URL` when present; application traffic uses pooled `DATABASE_URL`. Repository `npm run release:migrate` also seeds catalog data and the Vercel production build invokes it again idempotently; inspect that exact behavior and record it rather than blindly invoking development migrations. If a packet adds no database changes, report “no migration required.” Deploy/promote through the existing free Vercel setup only after preview verification. Do not purchase services or enable paid features.

**Post-deploy:** Record commit SHA, push result, Vercel deployment ID/URL and readiness/promotion, migration status and representative authenticated journey evidence. Verify the production domain serves that commit's deployment. Use dedicated disposable accounts/nights for authorized smoke writes. Keep tokens/private fixtures out of logs and commits. A successful build is not sufficient evidence of a working authenticated deployment.

**Rollback:** Record the previous known-good deployment before promotion. Re-promote it only when its code remains compatible with the additive schema. Avoid down-migrating user data under load. Reconciled identities/data require the retained restore map and a deliberate data rollback; merely rolling back application code cannot undo them. Stop promotion if migration, invariant checks or critical journeys fail; retain diagnostic evidence and keep the prior compatible deployment serving.

## Definition of done and report template

Dimension 1 is ready for the next review only when:

- Every P1 finding is closed by evidence, every P2 finding is fixed or explicitly accepted with a bounded follow-up, and there are no unresolved contradictory Perfect/ownership/capability claims.
- The invariant suite runs as ordinary passing tests; real database concurrency and multi-context browser journeys pass.
- Documentation matches actual join/host/privacy/ownership/filter behavior, and stale code comments/README claims are corrected.
- Intended changes are committed/pushed; required schema changes and Vercel deployment/promotion are complete and verified.
- Sol and Terra provide a short release record: **scope; finding IDs fixed; commit/push; deployment URL/ID; migration/seed outcome; test totals; actual vs synthetic smoke coverage; remaining risks; rollback target.**

For the user's checkpoint, present the successful non-Steam consensus journey, the corrected host/DST path, privacy tests and any deliberately deferred product decision. Obtain the user's review of dimension 1, then start the dimension-2 ingestion/resilience audit. Do not replace this gate with a claim that the audit plan itself was a product deployment.
