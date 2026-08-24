# Remove redundant server-side fetches on the kosztorys routes — Implementation Plan

## Overview

EX-720. Six findings on the kosztorys routes, none of which is a performance fix. The reads on
`kosztorys_v2` are already parallel, so deleting one buys ~0 ms — every change below stands on
correctness or code shape. One finding is a live defect (an auth race that sends an `EMPLOYEE` to an
error page instead of the login page); two are the EX-680 "a total and its own row list arrive from
two independent queries" pattern; the rest is a serial pair on the legacy route and three comments
that have already produced wrong decisions downstream.

## Current State Analysis

**`kosztorys_v2/page.tsx`** fans out to nine parallel promises. Two of them are redundant against
data the page already holds, and one of them disagrees with its neighbour about how to fail:

- `requireInvestmentOr404(id)` (`page.tsx:46`) costs a Payload `findByID` for `investment.name`
  alone. `refData.investments` already carries the name, the existence fact and `hasSheet` — line 80
  reads that array anyway. `requireInvestmentOr404`'s own docstring forbids exactly this use
  (`investments.ts:53-57`).
- `fetchPayoutsByWorkerForInvestment` (`:36`) is a `GROUP BY worker_id` over character-for-character
  the same `WHERE` as `fetchPayoutTransactionsForInvestment` (`sum-transfers.ts:358` vs `:391`).
  Two independent `unstable_cache` entries (`investment-transactions.ts:34` / `:48`), so the Σ and
  the rows printed under it can come from different snapshots.
- `getKosztorysTree` **throws** on a failed auth (`kosztorys.ts:18`) while `requireInvestmentOr404`
  **redirects** (`investments.ts:59-60`), and both sit in one `Promise.all`. `treePromise` is created
  first and does less work before failing, so an `EMPLOYEE` most likely lands on `error.tsx`. Per
  `lessons.md:1336` a render throw in a streamed RSC still answers 200, so nothing外 flags it.

**`SummaryExpensesTab`** receives the materials aggregate (`materials`, `materialsBreakdown`, from
`fetchWholeInvestmentFinancials`) and the material rows (`materialTransactions`, from
`fetchMaterialTransactionsForInvestment`) — different queries — and lets the aggregate gate blocks
that render the rows. `summary-expenses-tab.tsx:78` can print „Brak wydatków inwestycyjnych na
materiały." directly above a populated „Lista wydatków" at `:139`.

**Legacy `/kosztorys`** awaits `requireInvestmentOr404` before `getInvestmentSheetId`
(`kosztorys/page.tsx:17-22`) — the only genuinely serial pair in the sweep.

**Three comments** are actively wrong: `kosztorys-tree.ts:16-22` still asserts the round-trip-count
cost model EX-597 retired; `whole-investment-financials.ts:50` names a deleted script as the parity
guard; `investments.ts:63-72` states the EX-608 rationale twice.

## Desired End State

- An `EMPLOYEE` (or any non-management session) hitting `/inwestycje/<id>/kosztorys_v2` is
  redirected to `/zaloguj`, deterministically, before any data promise is created.
- `kosztorys_v2` issues seven reads instead of nine, and no figure on the page is read twice from
  two cache entries.
- The subcontractor block's Σ per worker and the wypłaty list under it are the same rows.
- The wydatki tab can no longer contradict itself: no block is gated by a number that came from a
  query other than the one that block renders.
- Legacy `/kosztorys` issues its two reads concurrently.
- No comment in the touched files asserts something the record has retired, and `lessons.md` carries
  the rule that a retired measurement has to be chased into the comments that quote it.

### Key Discoveries:

- **The two payout queries are the same rows.** Same `WHERE`, same deliberate absence of a
  `worker_id IS NOT NULL` guard (`sum-transfers.ts:345-350`). Every consumer re-keys the grouped
  result into a JS `Map` anyway (`subcontractor-summary.ts:87-88`).
- **`SubcontractorSummary` already receives both inputs** the derivation needs — `payoutTransactions`
  and `workers` (`subcontractor-summary.tsx:20-27`, wired at `summary-panel-content.tsx:266-270`).
  So the grouping has a home that needs no new prop.
- **The materials aggregate cannot be deleted.** `deriveFinancials` produces the whole
  `InvestmentFinancialsT` — marża, robocizna, wpłaty, bilans — not just materiały
  (`investment-financials.ts:74-113`). This is where the research's "apply the EX-680 recipe"
  framing breaks: the fix is single-sourcing the tab's own gates, not removing a query.
- **The rows can reproduce the aggregate, and that is already asserted.**
  `derive-financials-bucketing.test.ts:335-337` pins `sumBilled(gross) + sumBilled(net) ===
financials.totalMaterialCosts` and `sumBilled(settled) === financials.totalSettled`. The only
  structural difference between the two planes is the `settled` split; the type sets match
  (`EXPENSES_TAB_TYPES` = `INVESTMENT_EXPENSE` + `INVESTMENT_EXPENSE_NET` + `CORRECTION`, and
  `CORRECTION` sits in the `materials` bucket).
- **`requireAuth(MANAGEMENT_ROLES)` + `redirect('/zaloguj')` is written six times** across
  `(frontend)` pages and `investments.ts:62-63`. The guard extracted in Phase 1 is a dedup, not
  test-only scaffolding.
- **`preview` already strips the settled rows** (`clientVisibleExpenseRows`) and
  `summary-panel-content.tsx:309` already passes `settledBreakdown={preview ? undefined : …}` — so a
  row-derived settled gate reproduces current preview behaviour exactly rather than changing it.
- **`server-only` and `next/cache` are aliased to stubs in `vitest.config.ts`**; `next/navigation` is
  not, so a spec asserting a redirect mocks it per-spec.

## What We're NOT Doing

- **Not touching `fetchExpenseCategories`'s duplication of `refData.expenseCategories`.** The fetcher
  is shared with the unauthenticated `/k/[token]` path and `fetchReferenceData` pulls company-wide
  PII (`reference-data.ts:62-74`). The boundary is live.
- **Not touching the seven dead nested `unstable_cache` calls** in `cachedPreviewKosztorysEditorData`
  (`preview-kosztorys.ts:94`). Real (`lessons.md:1443`), but it is a share-path correctness question,
  not cleanup — and this change never edits that file's body.
- **Not deriving `materialsBreakdown` from the rows.** That rewrites a three-surface figure computed
  by `buildMaterialsBreakdown` and deserves its own slice (owner decision, this session).
- **Not touching `(share)/podglad-inwestora/[id]/page.tsx`**, which carries its whole auth gate
  through `requireInvestmentOr404` (owner decision, this session).
- **Not converting the other four pages** that repeat the management-guard pattern. The helper lands
  and `kosztorys_v2` uses it; sweeping the rest is a separate offer.
- **Not justifying anything by latency.** The 15-concurrent-statements-vs-pool-10 observation stays a
  question (`lessons.md:1186`).

## Implementation Approach

Phase 1 first and alone, because it is the defect and because removing `requireInvestmentOr404`
(Phase 1's other half) is what makes the race resolve deterministically in the wrong direction —
the two cannot be separated. Phases 2–4 are independent of each other and of Phase 1's ordering.

Each phase is one commit.

## Critical Implementation Details

**Ordering inside Phase 1.** The management guard must be `await`ed _before_ the promises are
created, not folded into the `Promise.all` — folding it in is precisely what `3fc35958` did to
`requireInvestmentOr404` and why the race stayed invisible. `requireAuth` is a `cache()`d JWT decode
with no DB round trip (`get-current-user-jwt.ts:31`), so serializing it costs nothing measurable and
`getKosztorysTree` will re-read it from the same request cache.

**What the Phase 1 spec does and does not prove.** A unit spec on the extracted guard pins the rule
the defect got wrong — _redirect, not throw_ — and it is red before the helper exists. It does not
prove what a browser sees on the real RSC route; that would need an `EMPLOYEE` fixture in
`e2e/helpers.ts`, which this change deliberately does not add.

## Phase 1: Deterministic management guard on `kosztorys_v2`

### Overview

Close the throw-vs-redirect race and drop the redundant `findByID`, in one commit, test-first.

### Changes Required:

#### 1. The extracted page guard

**File**: `src/lib/auth/require-management-page.ts` (new)

**Intent**: One home for the `requireAuth(MANAGEMENT_ROLES)` + `redirect('/zaloguj')` pair that five
pages already write by hand, so a page can guard itself without reaching for
`requireInvestmentOr404` and dragging an investment load along with it.

**Contract**: `requireManagementPage(): Promise<SessionUserT>` — returns the session user, or
redirects to `/zaloguj`. `server-only`, mirroring `require-auth.ts`. Never throws on a failed auth;
the redirect is the whole point.

#### 2. The page

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

**Intent**: Guard before the fan-out, then take the investment's name and existence from the
reference data the page already loads instead of a second read. Role for the `financials` gate comes
from the guard's session.

**Contract**: `requireManagementPage()` awaited before the first promise is created;
`requireInvestmentOr404` and its promise removed from the `Promise.all`; existence resolved as
`refData.investments.find(...)` → `notFound()` (the shape `inwestycje/[id]/page.tsx:56-57` uses);
`investmentName` read off that same record, which line 80 already reaches for `hasSheet`. The
`[PERF]` line's fetch count and its parenthetical are updated to match what actually runs.

#### 3. The spec

**File**: `src/__tests__/lib/auth/require-management-page.test.ts` (new)

**Intent**: Pin the failure mode. Written before the helper exists, so it is red for the right
reason first.

**Contract**: mocks `@/lib/auth/require-auth` and `next/navigation`; asserts an `EMPLOYEE` session
produces `redirect('/zaloguj')` and no throw, and a management session returns the user untouched.

### Success Criteria:

#### Automated Verification:

- The new guard spec passes: `pnpm exec vitest run src/__tests__/lib/auth/require-management-page.test.ts`
- No production caller of `requireInvestmentOr404` remains on `kosztorys_v2`: `grep -n requireInvestmentOr404 "src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx"` returns nothing

#### Manual Verification:

- An `EMPLOYEE` session opening `/inwestycje/<id>/kosztorys_v2` lands on `/zaloguj`, not on the error page
- An `OWNER` session still sees the editor with the investment name in the crumb and the „Marża" tab present
- A `MANAGER` session sees the editor without the „Marża" tab
- A non-existent investment id still renders the 404 page

---

## Phase 2: One source for the payouts — Σ derived from the rows

### Overview

Delete `payoutsByWorker` from the editor contract and derive it where both inputs already are.

### Changes Required:

#### 1. The grouping helper

**File**: `src/lib/kosztorys/payout-worker-names.ts`

**Intent**: Replace the name-only join with one function that groups the raw payout rows per worker
and resolves the names, so the Σ and the list can only ever be the same rows.

**Contract**: `derivePayoutsByWorker(rows: PayoutTransactionRowT[], workers: WorkerRefT[]):
SubcontractorPayoutRowT[]` replaces `resolvePayoutWorkerNames`. Null-worker bucket kept as its own
entry (never dropped, never merged into a named worker); `UNASSIGNED_WORKER_NAME` unchanged and still
exported.

#### 2. The block

**File**: `src/components/kosztorys/summary/blocks/subcontractor-summary.tsx`

**Intent**: Derive the per-worker totals from the `payoutTransactions` and `workers` it already
receives, and hand the same derived array to both consumers below it.

**Contract**: the `payouts` prop is removed from `PropsT`; the derived array feeds both
`computeSubcontractorSummary`'s second argument and `SubcontractorPayoutsTable`'s `payouts`.
`computeSubcontractorSummary`'s own signature does not change.

#### 3. The contract and the prop chain

**Files**: `src/lib/kosztorys/types.ts`, `src/components/kosztorys/summary/summary-panel-content.tsx`,
`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

**Intent**: Remove the prop from the type a host fills in, so no host can supply a Σ that disagrees
with the list it also supplies.

**Contract**: `payoutsByWorker` deleted from `KosztorysEditorDataT` and from
`summary-panel-content.tsx`'s `PropsT`; the page stops fetching it and stops passing it.
`buildPreviewKosztorysEditorData` never set it, so the share assembly is untouched.

#### 4. The dead fetchers and their spec

**Files**: `src/lib/queries/investment-transactions.ts`, `src/lib/db/sum-transfers.ts`,
`src/__tests__/lib/db/sum-payouts-by-worker.test.ts` (delete)

**Intent**: Remove what now has no caller.

**Contract**: `fetchPayoutsByWorkerForInvestment` and `sumPayoutsByWorkerForInvestment` deleted, with
the `['payouts-by-worker', …]` cache entry. `getPayoutTransactionsForInvestment`'s docblock no longer
describes itself as the twin of a function that no longer exists. `PayoutByWorkerT` stays — it is the
base of `SubcontractorPayoutRowT`.

#### 5. The spec

**File**: `src/__tests__/lib/kosztorys/payout-worker-names.test.ts` (new)

**Intent**: Assert the derivation, not the query shape — that the Σ per worker and the row list come
from one input.

**Contract**: covers the null-worker bucket surviving as its own row, several rows for one worker
summing, an unknown worker id falling back to „Nieznany pracownik", and Σ over the derived rows
equalling Σ over the input rows.

### Success Criteria:

#### Automated Verification:

- New derivation spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/payout-worker-names.test.ts`
- The existing block spec still passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/subcontractor-summary.test.ts`
- Nothing references the deleted symbols: `grep -rn "payoutsByWorker\|PayoutsByWorkerForInvestment" src` returns nothing

#### Manual Verification:

- „Podsumowanie podwykonawców" shows the same per-worker totals as before on an investment with payouts
- A payout with no worker still appears as „Bez przypisanego pracownika" and still counts into „Pozostało do wypłaty"
- A worker with assigned etapy and no payout yet still gets a row
- „Lista wpłat" under the block still lists every payout with the right worker name

---

## Phase 3: The wydatki tab reads its own rows

### Overview

Make every block in `SummaryExpensesTab` gate on the data it renders, so the tab cannot contradict
itself.

### Changes Required:

#### 1. The tab

**File**: `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx`

**Intent**: Today `hasBilledMaterials` (from the aggregate) gates the breakdown table and, with
`settledBreakdown.length`, the „Brak wydatków" message and the pie — while the row list gates itself
independently. Each block should read the source it displays, and the empty-state message should
appear only when there is nothing in any of them.

**Contract**: the rows are partitioned once with `partitionExpenseRows(listedTransactions)` (already
imported neighbours: `clientVisibleExpenseRows` from the same module). The billed gate becomes
`sumBilled(gross) + sumBilled(net) !== 0` over that partition; the settled block keeps gating on the
data it renders (`settledBreakdown`); `isEmpty` becomes "no billed rows AND no settled breakdown AND
no listed rows", so the message can never sit above a populated list. `materialsBreakdown` and the
pie keep their current source — the per-category figure is out of scope (see What We're NOT Doing),
and that remaining seam is the one the tab still carries.

### Success Criteria:

#### Automated Verification:

- The bucketing invariant still holds: `pnpm exec vitest run src/__tests__/derive-financials-bucketing.test.ts`
- Parity across the three surfaces stays green: `pnpm test:parity` (needs `db-test` populated —
  `pnpm db:import:test` then `pnpm seed:kosztorys:test`)

#### Manual Verification:

- An investment with only settled materiały: no „Brak wydatków" message, settled table visible, list shows the settled rows
- An investment with no materiały at all: „Brak wydatków inwestycyjnych na materiały." and no empty tables below it
- An investment with ordinary wydatki: breakdown table, pie and „Lista wydatków" all present, and the list's „Razem" matches the breakdown's
- The client share view of the same investment shows no settled rows and no settled table

---

## Phase 4: The serial pair, the comments, and the lesson

### Overview

The cheap remainder, in one commit.

### Changes Required:

#### 1. Legacy `/kosztorys`

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx`

**Intent**: The sheet lookup does not depend on the guard's result, so it should not wait for it.

**Contract**: `requireInvestmentOr404(id)` and `getInvestmentSheetId(payload, investmentId)` resolve
in one `Promise.all`. The id the sheet lookup needs comes from `parseInvestmentId(id)`, which is
already the guard's own first step and is synchronous.

#### 2. The retired cost model

**File**: `src/lib/db/kosztorys-tree.ts`

**Intent**: The comment asserts that Neon cost scales with the number of reads. EX-597 measured the
opposite and its record retires the claim; the comment has since been quoted as fact by another
slice's research and seeded this change's own wrong premise.

**Contract**: the claim is replaced by what was actually measured — parallel reads total the slowest,
not their sum — citing `context/archive/2026-07-27-decouple-panel-write-refresh/change.md:214-218`.

#### 3. The parity guard's name

**File**: `src/lib/queries/whole-investment-financials.ts`

**Intent**: The docblock names `src/scripts/audit-investment-parity.ts` as what polices the agreement
between the three surfaces. That file was deleted.

**Contract**: it names `src/__tests__/investment-render-parity-db.test.ts` (`pnpm test:parity`).

#### 4. The doubled rationale

**File**: `src/lib/queries/investments.ts`

**Intent**: The EX-608 rationale above `getInvestmentName` is written twice, as two stacked
paraphrases.

**Contract**: one paragraph, keeping the load-bearing half — why the role gate is not decorative.

#### 5. The lesson

**File**: `context/foundation/lessons.md`

**Intent**: `lessons.md:733` already says "don't read a stale doc as foundation". The other half is
missing: when a slice retires a claim, the comments that assert it have to be chased down in the same
change, or the retired claim keeps being re-derived from the code. This one cost two slices.

**Contract**: one short rule with this incident as its evidence, following the file's existing entry
shape.

### Success Criteria:

#### Automated Verification:

- No reference to the deleted parity script survives: `grep -rn "audit-investment-parity" src context` returns nothing outside `context/archive/`

#### Manual Verification:

- Legacy `/kosztorys` still renders the sheet iframe for an investment with a linked sheet, and the „nie ma jeszcze arkusza" state for one without

---

## Testing Strategy

### Unit Tests:

- `require-management-page` — redirect (not throw) for a non-management session; user returned for a
  management one. This is the regression guard for the defect and is written first, red.
- `derivePayoutsByWorker` — null bucket, multi-row worker, unknown worker id, Σ preserved.

### Integration Tests:

- `pnpm test:parity` gates Phase 3, because materiały is the three-surface figure. The two DB specs
  it runs need `db-test` populated (`pnpm db:import:test`, then `pnpm seed:kosztorys:test` — a prod
  dump carries no kosztorys rows and the dataset floor fails closed on that).

### Manual Testing Steps:

Collected into `context/foundation/manual-checks.md` at the final phase, from the
`#### Manual Verification:` bullets above.

## Performance Considerations

None claimed. The reads removed here were already parallel, and the guard added in Phase 1 is a
`cache()`d JWT decode with no DB round trip. If any part of this change is later described as a
performance fix, that description is wrong — see `kosztorys-tree.ts` and Phase 4.

## Migration Notes

No schema change, no data migration, no prod migration owed. `payouts-by-worker` cache entries simply
stop being written; nothing reads them.

## Whole-tree Gate

Run once, after Phase 4.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-08-19-kosztorys-page-fetch-dedup/research.md`
- Linear: **EX-720**
- The guard shape to mirror: `src/app/(frontend)/inwestycje/[id]/page.tsx:29-31, 56-57`
- The precedent for Phase 2: EX-680, `195f564f`, `context/archive/2026-08-12-wplaty-jedno-zrodlo/`
- The retired cost model: `context/archive/2026-07-27-decouple-panel-write-refresh/change.md:214-218`
- The invariant Phase 3 leans on: `src/__tests__/derive-financials-bucketing.test.ts:335-337`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Deterministic management guard on `kosztorys_v2`

#### Automated

- [x] 1.1 The new guard spec passes — f6a759fa
- [x] 1.2 No production caller of `requireInvestmentOr404` remains on `kosztorys_v2` — f6a759fa

### Phase 2: One source for the payouts — Σ derived from the rows

#### Automated

- [x] 2.1 New derivation spec passes — 85275f84
- [x] 2.2 The existing block spec still passes — 85275f84
- [x] 2.3 Nothing references the deleted symbols — 85275f84

### Phase 3: The wydatki tab reads its own rows

#### Automated

- [x] 3.1 The bucketing invariant still holds — 07797100
- [x] 3.2 Parity across the three surfaces stays green (`pnpm test:parity`) — 07797100

### Phase 4: The serial pair, the comments, and the lesson

#### Automated

- [x] 4.1 No reference to the deleted parity script survives — PENDING_SHA
