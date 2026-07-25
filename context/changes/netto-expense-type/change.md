---
change_id: netto-expense-type
title: Netto investment-expense type (spike)
status: planned
created: 2026-07-24
updated: 2026-07-25
archived_at: null
---

## Notes

Spike added to the EX-536 zaliczka-v2 PR. A new transfer type `INVESTMENT_EXPENSE_NET` carries a
second stored `netAmount`: the expense leaves the register at brutto (`amount`) but bills the investor
at netto (`netAmount`, immutable, `netAmount ≤ amount`). Design + resolved decisions:
`design.md`. Plan: `plan.md` / `plan-brief.md`. Guards B1–B5 + B7. Kosztorys/spike data is throwaway.

**Unblocked 2026-07-25** — EX-573 has landed (`context/changes/2026-07-25-transfer-type-spec-table/`,
status `implemented`). The transfer-type predicate sets are now one compile-checked
`TRANSFER_TYPE_SPECS` table, so Phase 1 is a single row rather than ~12 membership arrays, and the
B4 carve-out is the `settleable: false` column instead of a hand-written exclusion.

`plan.md` §1–§2 were rewritten for the table on the same day. They also resolve the two columns the
pre-EX-573 plan could not name: `financialBucket: 'materialsNet'` (a distinct bucket, so the global
toggle structurally cannot double-cut the netto) and the `billedAmount: 'amount' | 'netAmount'`
column EX-573 deliberately left to this change. `design.md` predates the table and is superseded on
those mechanics — B4 carries a note; read `plan.md` for what to actually build.
