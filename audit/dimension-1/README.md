# Dimension 1 audit reproductions

Baseline: `fe110fe1132a630678c4e34206f3ceaad5979b9d` (9 September 2026).

These are synthetic evidence checks for [the audit](../../docs/reviews/01-architectural-integrity.md) and [Sol/Terra handoff](../../docs/reviews/01-sol-terra-handoff.md). They call real scoring, scheduling, authorization, actions and session-page composition with database/provider boundaries mocked. They do not contact production.

```sh
npm test -- audit/dimension-1 --reporter=verbose
```

At the audited baseline there are **24 checks: 21 `it.fails` invariants and 3 normal characterization checks**. Vitest reports an expected failure as passed. This means the documented broken behavior was reproduced, **not** that the implementation is correct. The suite also runs under the ordinary `npm test` command.

| File | Coverage |
|---|---|
| `identity.audit.test.ts` | Host-cookie downgrade, account/cookie disagreement, logout residue, normalized redirect origin |
| `domain.audit.test.ts` | Ownership, veto/perfect, capacity unknowns, platform completeness, target size, native/modded disagreement, deterministic ties, budget/section labels and DST |
| `mutations.audit.test.ts` | Shortlist ownership side effect, sparse metadata overwrite, false co-op inference, clearing rating, fresh curated-game rejection |
| `session.audit.test.tsx` | Real page composition: truncated candidate ownership, selected-ID canonicalization, nonfinite count, nonmember match projection |

When fixing an invariant, remove `.fails` and retain its acceptance assertion, adapting the fixture only for an explicitly changed public contract. For example, the modded-setup test must pass the new explicit setup choice once that contract exists. The three characterization checks intentionally assert old behavior; convert them into corrected acceptance tests rather than preserving the bugs. Move stable tests to the owning domain/route suite when useful.

No real PostgreSQL rollback/concurrency or live OAuth/browser/provider result is implied by these checks. Those are required execution-phase gates. The baseline existing suite had 111 ordinary passing tests across 37 files, and baseline lint/production compilation passed.
