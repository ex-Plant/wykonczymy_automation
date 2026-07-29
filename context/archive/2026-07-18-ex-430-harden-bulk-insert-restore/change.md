---
change_id: ex-430-harden-bulk-insert-restore
title: Harden bulk-INSERT restore — ORDINALITY id-mapping + owed tests
status: archived
created: 2026-07-18
updated: 2026-07-29
archived_at: 2026-07-29T11:54:06Z
branch: staging
worktree: null
---

## Notes

EX-430. `restoreKosztorys` trades Payload's per-doc machinery for one bulk `INSERT … RETURNING id`
per level (via `insert-kosztorys-tree.ts` + `insert-rows.ts`), a ~12.6s→~216ms win on ~3030 rows.
Scope for this change (decided with owner 2026-07-18):

- **Fix now:** the RETURNING-order reliance. Rewrite the 3 bulk inserts to `INSERT … SELECT
unnest(...) WITH ORDINALITY … RETURNING id, ord` and map old→new ids by `ord`, not array position.
  Kills the silent wrong-parent-remap class permanently.
- **Owed tests:** (1) restore rollback-on-error integration test (impl-review 🟡 debt; also the
  tripwire for a Payload upgrade silently breaking the tx handle in `getDb`); (2) wider-field-coverage
  roundtrip (nulls, every discount/override combo, unicode notes); (3) schema-drift
  guard asserting each INSERT column list matches `information_schema.columns`.
- **Deferred by design (no code):** parameter-limit chunking, validation-bypass, hooks-bypass.

Source: S-06 kosztorys-snapshots review-gate ledger. Related: EX-432 (Done).

**2026-07-28 (validity re-check):** ticket numbers corrected in `plan.md` — items INSERT is 15 cols
(ceiling ≈4,369, not ~3,855); EX-432's 5000-item serialize cap **no longer exists** (serialize is
unbounded via `getKosztorysTree`), so the save-but-fail-to-restore window reopens above the ceiling
rather than being neutralized; tightest bound is `stage_progress` at ~21,845 rows. Chunking still
deferred — headroom over real data holds either way.

**2026-07-28 (implemented):** the RETURNING-order fix landed as the **natural-key remap** the plan
body specifies, not the `unnest … WITH ORDINALITY` rewrite the title above names: each level joins
`RETURNING` on a key unique within its batch (section `display_order`, item `(section_id,
display_order)`, stage `ordinal`), with a loud throw if that key turns out non-unique. Same
guarantee, no `unnest` casts across 15 mixed-type nullable columns. ORDINALITY stays the answer if
the 65,535-parameter ceiling ever starts to matter — it binds one array per column.

**2026-07-28 (EX-575):** the roundtrip fixture lost two axes on purpose — the cost-variant axis
(columns dropped by `20260728_0`) and the section-coeff axis (dropped earlier by `20260724_1`).
Neither column exists, so neither can be covered.
