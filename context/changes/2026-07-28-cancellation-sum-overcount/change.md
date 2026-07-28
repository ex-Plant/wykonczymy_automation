---
change_id: cancellation-sum-overcount
title: „Suma wybranych transakcji" overcounts by the amount of every CANCELLATION row
status: implemented
created: 2026-07-28
updated: 2026-07-28
archived_at: null
branch: staging
worktree: null
---

## Notes

EX-574 (High, project Wykonczymy). `stripCancelledFilters` drops the default
`type: { not_in: ['CANCELLATION'] }` alongside the `cancelled` condition, but the SQL in
`sumFilteredByType` only re-adds `cancelled IS NOT TRUE`. A CANCELLATION row copies the original's
amount verbatim and carries `cancelled = false`, so a cancelled transaction nets to +1× instead of 0.
March 2026: 7 192 866,38 zł displayed vs 4 202 513,34 zł actual (+71%).

Analysis 2026-07-28 confirmed every line reference still matches HEAD, and found two things the
Linear issue does not state:

- The Pulpit's „Ostatnie transakcje" table (`manager-dashboard.tsx:38`) is affected too — same
  filters, no relational scope — so the audience includes MANAGER, not just ADMIN/OWNER.
- Fix option (a) from the issue (filter CANCELLATION out of the `reduce` in
  `transfer-table-server.tsx`) is wrong: it would zero the tile in audit mode
  (`?cancelledTransactionAudit=1`), where the list is exclusively CANCELLATION rows.

**Scope: two defects, one change** (owner, 2026-07-28). Alongside EX-574, the same tile drops the
amount filter's upper bound — `buildTransferFilters` emits `less_than`, which `where-to-sql.ts:82-92`
does not handle and silently ignores. `?amount=500,00` lists 20 rows totalling 10 000 zł under a tile
reading 22 560 189,17 zł. Same file, same tile, same spec; each gets its own red test and commit.

Repro for both, with live figures off the local prod copy: `repro.md`.

**Dispositions (owner, 2026-07-28):** both defects tracked under EX-574, no second issue. The
`/raporty` E2E is deferred to the `e2e-backlog` label rather than authored. The `showCancelled`/audit
residual mismatch stays unfixed, but the tile gains an on-screen note saying what it counts.

Prior research on the transfer-type surface: `context/archive/2026-07-25-transfer-type-spec-table/research.md` §1.
Related: EX-573 (transfer-type spec table) — independent, no need to wait for it.
