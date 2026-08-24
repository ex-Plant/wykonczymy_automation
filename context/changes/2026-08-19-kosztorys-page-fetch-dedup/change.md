---
change_id: kosztorys-page-fetch-dedup
title: Remove redundant server-side fetches on the kosztorys routes
status: implemented
created: 2026-08-19
updated: 2026-08-24
archived_at: null
branch: liner_issues_fixing
worktree: null
---

## Notes

Linear: **EX-720** (project Wykonczymy).

audit and remove redundant/duplicated server-side data fetches on the kosztorys routes (kosztorys_v2 9-promise fan-out, legacy /kosztorys serial fetch)

Research complete — see `research.md`. **The seed's last bullet was wrong** and is corrected there:
`kosztorys-tree.ts:17-22` still asserts a round-trip-count cost model that EX-597's own record
retires (`context/archive/2026-07-27-decouple-panel-write-refresh/change.md:214-218` — parallel reads
total the slowest, not the sum). Since the kosztorys_v2 promises are already parallel, removing one
buys ~0 latency. Every remaining finding stands on correctness, invalidation surface or code shape.

Seed findings from the ad-hoc read (now verified in `research.md`):

- `kosztorys_v2/page.tsx:46` — `requireInvestmentOr404(id)` costs a Payload `findByID` for
  `investment.name` alone; the name, existence check and `hasSheet` all already sit in
  `refData.investments` (line 80 reads that array anyway), and `requireAuth` is a `cache()`'d JWT
  decode `getKosztorysTree` already performs. `requireInvestmentOr404`'s own docstring forbids this;
  `inwestycje/[id]/page.tsx:49-57` shows the intended shape. **Confirmed** — and it surfaced a latent
  auth race (throw vs redirect in the same `Promise.all`), so it is not a pure deletion.
- `kosztorys_v2/page.tsx:36,38` — `fetchPayoutsByWorkerForInvestment` is a `GROUP BY worker_id` over
  exactly the rows `fetchPayoutTransactionsForInvestment` already returns (identical WHERE,
  `sum-transfers.ts:351` vs `:384`). **Confirmed** — and it is the EX-680 "total and its list from two
  queries" bug, which is the real argument for fixing it.
- `fetchMaterialTransactionsForInvestment` re-reads `expense_categories` via
  `fetchExpenseCategories()` while the page holds `refData.expenseCategories`. **Leave it** — the
  share path genuinely reaches this fetcher, so the PII boundary is live, not stale.
- Legacy `kosztorys/page.tsx` — `requireInvestmentOr404` (findByID for the name) is awaited
  _before_ `getInvestmentSheetId`, so the sheet lookup is gated on a load it doesn't need.
  **Confirmed** — the only genuinely serial pair in the sweep.

New, not in the seed: seven dead nested `unstable_cache` calls on the share path, the unfixed
`SummaryExpensesTab` aggregate-beside-its-own-rows, and three stale comments (one naming a deleted
script as the parity guard).

Decisions (owner, 2026-08-19): base off **`staging`**; finding 2 (`SummaryExpensesTab` aggregate
beside its own row list) **rides along** in this change rather than getting its own slice — so
`pnpm test:parity` is a gate on this work.

Plan (2026-08-24): `plan.md` + `plan-brief.md`. Four phases, one commit each. Phase 1 (the auth race +
dropping `requireInvestmentOr404`) goes first and alone — it is the only real defect and the two halves
are inseparable. Owner decisions this session: the tab gates on its own rows but `materialsBreakdown`
stays aggregate-sourced (`deriveFinancials` produces the whole `InvestmentFinancialsT`, so the aggregate
cannot be deleted — the research's EX-680 recipe does not transfer 1:1); the auth guard is proven by a
Vitest spec on the extracted gate, **not** by an E2E (no `EMPLOYEE` fixture exists, and no `e2e-backlog`
issue is owed); `(share)/podglad-inwestora` stays untouched; the retired-measurement rule lands in
`lessons.md`.
