---
change_id: netto-expense-type
title: Netto investment-expense type (spike)
status: archived
created: 2026-07-24
updated: 2026-07-26
branch: konradantonik/ex-573-transfer-type-spec-table
archived_at: 2026-07-26T06:27:25Z
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

**Review gate 2026-07-26** — `review-gate.md`: 19 findings, 0 open boxes (10 fixed, 4 dismissed,
2 dropped, 1 skipped, 1 filed as EX-576 for the owed E2E). Three 🔴 client-facing money errors were
caught and fixed (the „Wydatki inwestycyjne" list, the owner's sheet sync, and the settled-netto
category divergence) — two of them plan gaps `plan.md` never named. Unit suite 1643 green, parity green.

**The rejected model: a VAT rate instead of a second stored amount.** The first design derived netto
from brutto via a rate, which put a rounding seam between the transaction-list row (JS `Math.round`)
and the aggregate (Postgres `ROUND`) — the two could disagree by a grosz on the same expense. Storing
`netAmount` as a typed figure deletes the hazard rather than managing it: the row and the aggregate
read the identical stored value, so "list == summary" holds by construction, not by a shared rounding
helper. The price is that the owner types two numbers off the invoice instead of one.

`design.md`, `plan.md` and `plan-brief.md` were deleted at the archive audit (2026-08-08) — their
invariants now live in code comments (`src/types/investment-financials.ts:8-26` for the two buckets,
`src/lib/constants/transfers.ts:42-83` for `settleable`/`financialBucket`/`billedAmount`,
`summary-economics.ts:42-51,92` for the face-value + before-`combinedNet` folding rules).
`git log --follow` on this folder still reaches the originals.
