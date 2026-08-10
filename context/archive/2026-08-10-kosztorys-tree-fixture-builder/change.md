---
change_id: kosztorys-tree-fixture-builder
title: Shared kosztorys tree fixture builder for the DB specs
status: archived
created: 2026-08-10
updated: 2026-08-10
archived_at: 2026-08-10T10:14:00Z
branch: konradantonik/ex-635-kosztorys-tree-fixture-builder
worktree: null
linear: EX-635
---

## Notes

EX-635, surfaced by the EX-430 review gate's `primitive-reuse-scan`. Five DB-gated specs each
hand-build the same kosztorys tree in a long `beforeAll` — `payload.create` per section, per item,
per stage, then a raw `INSERT INTO stage_progress`. They differ only in which fields they vary, so a
new spec costs ~60 lines of fixture before it asserts anything, and column coverage drifts per spec
(only the roundtrip spec sets the nullable/override extremes).

Wanted: one declarative builder alongside `helpers/investment.ts` — takes a tree spec, returns the
created ids.

Test disposition from the issue: `test: no automated test` — this is test infrastructure and the five
specs are its own regression guard; they must stay green through the refactor (baseline before any
edit: 6 files / 22 tests green against the 5435 test DB).

Two facts the issue predates:

- `src/__tests__/helpers/kosztorys-tree.ts` is **already taken** by an unrelated helper (`makeTree` /
  `baseItem`, the in-memory `KosztorysTreeT` envelope for the pure-calculation specs). The new file
  needs a different name.
- `buildKosztorysTree` is a **production** function name (`src/lib/kosztorys`, it shows up in the
  specs' own PERF logs), so the builder can't take it either.

Review record: `.review-gate/consolidated-gate.md` (branch-scoped gate, not a per-change
`reviews/impl-review*.md`). `plan.md` dropped at archive — every piece of its rationale (the name
collision, positional addressing, `??`-not-`||` so a deliberate `0`/`null` survives, why
`skipRevalidation`) lives as comments in `src/__tests__/helpers/kosztorys-db-tree.ts`.
