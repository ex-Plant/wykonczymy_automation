---
date: 2026-07-27T11:56:11+02:00
researcher: ex-Plant
git_commit: 9f2b4dd1f18f8c6653b0c651c22f2a7cd7783dff
branch: investment-summary-panel
repository: wykonczymy
topic: 'Decouple persisted panel writes from full-route refresh; audit the investment page data-fetching architecture'
tags: [research, codebase, performance, caching, rsc, kosztorys, reference-data]
status: complete
last_updated: 2026-07-27
last_updated_by: ex-Plant
---

# Research: investment page data-fetching architecture (EX-597)

**Date**: 2026-07-27T11:56:11+02:00
**Researcher**: ex-Plant
**Git Commit**: `9f2b4dd1f18f8c6653b0c651c22f2a7cd7783dff`
**Branch**: `investment-summary-panel`
**Repository**: wykonczymy

## Research Question

Why is `/inwestycje/[id]` unusably slow since the v2 summary panel landed, and what has to change so
it feels as fast as it did when the page was transfers only? Five questions from `change.md`:
(1) round-trips per toggle, (2) does `updateTag` replace `router.refresh()`, (3) can the panel's
figures come from SQL aggregation, (4) v1 vs v2 baseline, (5) is `cacheComponents` viable.

## Summary

**The owner's hypothesis is confirmed at the framework-source level.** `router.refresh()` on the
panel's two controls is redundant: `updateTag` already makes Next re-render the route and seed the
client router from the action response. Every consumer of both settings on this route is either
behind the `investments` tag (which the actions invalidate) or uncached — and none snapshots the
value into `useState`. So the fix is deleting two calls, not restructuring state ownership.

The read path is worse than the write path, and it is not the panel's fault alone:

- On this route the kosztorys tree is consumed **100% in aggregate**. Up to 5 000 items and ~10 000
  `stage_progress` rows are materialised, re-bucketed, flattened into row objects — and reduced to
  **two numbers**. Zero per-row need.
- `unstable_cache` **does not dedupe within a request** — verified against the installed Next
  16.1.7 source. So `fetchReferenceData` really does run three times, and on a cold entry all three
  execute the 5 SQL queries. React `cache()` is used in exactly one place in the repo
  (`get-current-user-jwt.ts`) and nowhere in the data layer.
- `fetchReferenceData` returns ~36.5 KB for 194 rows, of which ~48% of the investments blob is
  free-text (`address/phone/email/contactPerson/notes/review`) that **no consumer on this page
  renders** — and it ships to two separate client boundaries, one of them in the root layout.
- Nothing paints — not even the shell — until the page's own `Promise.all` resolves. The layout's
  single coarse `<Suspense>` is too high to let the chrome through, and both inner boundaries use
  `fallback={null}`, so content pops in from nothing twice.

**Two prior records matter.** `fetchReferenceData` being called multiple times per page was written
down as a deduplication candidate **four months ago** (2026-03-19 perf log) and never actioned. And
caching `getKosztorysTree` was explicitly deferred as **EX-540 option B, measurement-gated** — the
`<Suspense>` at `page.tsx:121` is option A, which moved the cost off the critical path without
removing it.

**Q1 and Q4 are still unmeasured** — see "Baseline: not captured" below. This is a known gap, not an
omission to be papered over.

---

## Detailed Findings

### Q2 — `updateTag` already re-renders the route; both `router.refresh()` calls are redundant

Traced through the installed `node_modules/next` 16.1.7:

1. `updateTag(tag)` → `revalidate([tag], …, profile=undefined)` —
   `next/dist/server/web/spec-extension/revalidate.js:47-62`
2. no profile ⇒ `store.pathWasRevalidated = ActionDidRevalidateStaticAndDynamic` — `revalidate.js:199-202`
3. `next/dist/server/app-render/action-handler.js:823-853`:
   ```js
   skipPageRendering ||=
     workStore.pathWasRevalidated === undefined ||
     workStore.pathWasRevalidated === ActionDidNotRevalidate
   ```
   ⇒ `false`, so the page **is** re-rendered and `generateFlight(...)` streams fresh flight data into
   the action response (`action-handler.js:722-735`).
4. `addRevalidationHeader` sets `x-action-revalidated: ActionDidRevalidateStaticAndDynamic` —
   `action-handler.js:95-117`
5. Client `server-action-reducer.js`: reads the header (`:98`), sets `freshnessPolicy = RefreshAll`
   (`:245`), evicts the prefetch cache (`:180-184`), and — because `flightData !== undefined` —
   performs a **seeded navigation to the current URL** with the server's fresh tree
   (`:248-268`, `navigateToSeededRoute`).

`resolve(actionResult)` fires at `server-action-reducer.js:212`, _before_ the seeded navigation
settles — so the client's `await` returns and the subsequent `router.refresh()` enqueues a **second**
full RSC render of the same route, re-running the uncached 5-query `getKosztorysTree`.

Our chain: `protectedAction(..., ['investments'])` → `run-action.ts:53-56` →
`revalidate.ts:13-17` → `updateTag(CACHE_TAGS.investments)`. Both actions pass `['investments']` —
`src/lib/actions/kosztorys.ts:172` (settlement mode), `:190` (materials net rate).

#### Consumer map — `materialsNetRate`

| Consumer                                           | file:line                                                                                   | Kind                                                | Cache path                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `investment.materialsNetRate` off refData          | `inwestycje/[id]/page.tsx:67`                                                               | Server                                              | `fetchReferenceData`, tag `investments` ✅                      |
| `deriveFinancials(…)`                              | `page.tsx:63-69` → `lib/db/investment-financials.ts:70-106`                                 | Server, pure per render                             | inputs = raw sums (`transfers`, rate-independent) + the rate ✅ |
| `materialsNetDiscount` term                        | `investment-financials.ts:88-89`                                                            | Server, pure                                        | ✅                                                              |
| `calculateMargin(financials)`                      | `lib/db/calculate-margin.ts:15-21`                                                          | Server (v1) / Client tab (v2)                       | ✅                                                              |
| `buildFinancialFields` → „Obniżka materiałów" tile | `lib/db/map-category-costs.ts:95-136`                                                       | Server, pure                                        | ✅                                                              |
| `headerFields` → print/CSV                         | `transfer-data-table.tsx:31,57`; `print-button.tsx:25,32-36`; `lib/export/print.tsx:65-103` | Client, straight off `config` props — no `useState` | ✅                                                              |
| `tree.materialsNetRate`                            | `investment-summary-panel.tsx:71` ← `queries/kosztorys.ts`                                  | Server, **uncached**                                | ✅ always fresh                                                 |
| panel gating / `effectiveNetRate`                  | `summary-panel-content.tsx:203,212,265,285`                                                 | Client, prop-derived                                | ✅                                                              |
| Wydatki controls + „−X zł"                         | `tabs/summary-expenses-tab.tsx:67-74,92,120-131`                                            | Client, prop-derived                                | ✅                                                              |
| Marża tab                                          | `investment-owner-figures.tsx:37-49,96-104`                                                 | Client, prop                                        | ✅                                                              |
| listing/dashboard `fetchInvestmentFinancials`      | `reference-data.ts:212-229`                                                                 | Server                                              | tagged `transfers` **and** `investments` ✅                     |

`settlementMode` has the identical shape (action `kosztorys.ts:158-174`, same `['investments']`);
`SettlementModeSelect` (`settlement-mode-select.tsx:17-29`) is fully controlled.

**No consumer on this route sits behind a `transfers`-only cache while depending on either value.**
The `transfers`-tagged queries return raw per-type/per-category sums; the rate is applied afterwards
at render time by the pure `deriveFinancials`. That is precisely what makes the `investments` tag
sufficient.

#### The stale-props trap — absent on this route

`grep useState src/components/kosztorys/summary/ src/components/investments/` finds no component
holding `materialsNetRate` or `settlementMode`. `DecimalField` is uncontrolled but `key={String(value)}`
(`ui/decimal-field.tsx:59`) forces a remount on a new prop.

Two adjacent notes:

- `summary-settings-bar.tsx:51` — `useState(globalDiscount.type != null)` **is** the same
  mount-snapshot class of bug (lessons.md, "Denormalized fields changed from outside the grid"), but
  for `globalDiscount`, and `showSettingsBar` is off on this host.
- The editor route already documents that these two settings are _not_ denormalized onto rows and
  need no optimistic patch — `use-kosztorys-editor.ts:1033-1034` and `:1052-1053`. Its
  `router.refresh()` for these two comes from the shared `optimisticSettingSave` tail (`:949-962`)
  and is redundant there too.

#### Every `router.refresh()` that fires on this route

| file:line                                                                                                                                         | Trigger                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `investment-summary-panel-client.tsx:43`                                                                                                          | settlement mode — **under review**        |
| `investment-summary-panel-client.tsx:54`                                                                                                          | materials net rate — **under review**     |
| `transfers/cancel-transfer-button.tsx:45`                                                                                                         | cancelling a transfer below the panel     |
| `forms/hooks/use-form-submit.ts:38,50`                                                                                                            | `EditInvestmentDialog`, any transfer form |
| `dialogs/sheet-setup-dialog.tsx:42`, `add-sheet-dialog.tsx:55`, `link-sheet-to-investment-dialog.tsx:49`, `sheets/linked-sheet-actions.tsx:43,53` | via `SheetButton` (`page.tsx:95`)         |

The last two groups are the same pattern and fall under the identical argument — check whether their
actions pass a `revalidate` array before touching them.

The two comments at `investment-summary-panel-client.tsx:41-42` and `:46-47` ("the refresh IS the
update") become **factually wrong** when the calls go; rewrite them, don't just delete.

### Q3 — the tree is read 100% in aggregate on this route

`investment-summary-panel.tsx` is the only place tree fields are read here:

| Read                                                            | file:line                                      | Kind                      |
| --------------------------------------------------------------- | ---------------------------------------------- | ------------------------- |
| `treeToRows(tree)` → `rows.length === 0`                        | `:37,40`                                       | count                     |
| `kosztorysClientTotals(rows, tree.stages, tree.globalDiscount)` | `:40`                                          | aggregate                 |
| `.sumaPracNet`, `.rabatClientNet`                               | `:41-43`, `:64-65`, `summary-reading.ts:27-35` | aggregate                 |
| `tree.vatRate` / `.settlementMode` / `.materialsNetRate`        | `:69-71`                                       | scalars off `investments` |

Nothing else. `rows` is a local and never reaches the client component. `tree.sections`,
`tree.progress`, `tree.globalCoeffs`, `tree.revision`, and every per-item
`description/unit/note/hiddenInExport/costVariant/*Override*` never leave this function on this route.
Of `KosztorysClientTotalsT`'s four fields (`settlement.ts:46-64`) exactly **two** are consumed;
`doneNet` and `globalRabatNet` are computed and dropped.

The host hard-limits tabs to `['summary','wydatki','marza']` (`investment-summary-panel-client.tsx:18`,
`showTransactionLists={false}`, `showPies={false}` at `:63-65`). `wydatki` is transaction-sourced with
zero kosztorys rows; `marza` takes `financials` only. The two tabs that _would_ need per-row data —
`etapy` and `podwykonawcy` (`summary-panel-content.tsx:238,307-316`) — are not offered here and their
props are `undefined`, so those branches are structurally dead on this route.

**Net: ~10 000 `stage_progress` rows + up to 5 000 items → `.map()` → `Map` re-bucketing →
`KosztorysV2RowT[]` flattening (spreading every stage into `stage_<id>` keys, `v2-rows.ts:36-48`) →
two numbers.**

The genuine per-row consumers are the v2 editor (`kosztorys_v2/page.tsx:28`) and the client-share
path (`client-kosztorys.ts:46`); they must keep the full tree.

#### What the aggregate would look like

The client view collapses the pricing layer: `viewPrice(row,'client') = row.clientPrice`
(`calc.ts:51-54`, no coefficients/overrides), and `stagesForView(stages,'client')` returns **all**
stages (`settlement.ts:42-44`), so `rowTotalQtyDone` is a plain `Σ qty_done` per item.
`sectionSubtotalsForView` groups by section but `clientTotalsFromSubtotals` (`settlement.ts:90-106`)
immediately sums across sections — **the grouping is discarded**, so this is a flat per-investment
aggregate, not even a `GROUP BY`.

```sql
WITH inv AS (
  SELECT vat_rate, settlement_mode, materials_net_rate,
         global_discount_type, global_discount_value,
         (global_discount_type = 'amount' AND global_discount_value > 0) AS global_active
  FROM investments WHERE id = $1
),
qty AS (                                   -- pomiar z natury = Σ etapów (EX-494)
  SELECT i.id AS item_id, COALESCE(SUM(sp.qty_done), 0) AS qty_done
  FROM kosztorys_items i
  LEFT JOIN stage_progress sp   ON sp.item_id = i.id
  LEFT JOIN kosztorys_stages s  ON s.id = sp.stage_id
                               AND s.investment_id = i.investment_id
  WHERE i.investment_id = $1
  GROUP BY i.id
),
priced AS (
  SELECT
    (CASE WHEN q.qty_done > 0 THEN q.qty_done * i.client_price ELSE 0 END) AS gross,
    (CASE
       WHEN NOT (q.qty_done > 0)         THEN 0
       WHEN inv.global_active            THEN q.qty_done * i.client_price
       WHEN i.discount_type = 'percent'  THEN q.qty_done * i.client_price
                                              * (1 - COALESCE(i.discount_value,0)/100)
       WHEN i.discount_type = 'amount'   THEN q.qty_done * i.client_price
                                              - COALESCE(i.discount_value,0)
       ELSE q.qty_done * i.client_price
     END) AS net
  FROM kosztorys_items i
  JOIN qty q ON q.item_id = i.id
  CROSS JOIN inv
  WHERE i.investment_id = $1
)
SELECT
  (SELECT COUNT(*) FROM kosztorys_items WHERE investment_id = $1) AS item_count,
  COALESCE(SUM(net), 0)         AS done_net,
  COALESCE(SUM(gross - net), 0) AS item_rabat_net,
  (SELECT CASE WHEN global_active THEN global_discount_value ELSE 0 END FROM inv) AS global_rabat_net,
  (SELECT vat_rate FROM inv) AS vat_rate,
  (SELECT settlement_mode::text FROM inv) AS settlement_mode,
  (SELECT materials_net_rate::float8 FROM inv) AS materials_net_rate
FROM priced;
```

Then in JS: `sumaPracNet = done_net + item_rabat_net`, `rabatClientNet = global_rabat_net +
item_rabat_net` — i.e. `clientTotalsFromSubtotals` reduced to two additions, with the formula's
ownership staying in `settlement.ts`.

**Two fidelity caveats that a plan must carry:**

- **Stage scoping.** The JS iterates `tree.stages`, which is investment-scoped
  (`queries/kosztorys.ts:59-65`), so a `stage_progress` row pointing at another investment's stage is
  silently skipped. The `AND s.investment_id = i.investment_id` predicate reproduces that; a naive
  `SUM(sp.qty_done)` would not.
- **Rounding.** JS sums float64 per section then across sections; Postgres `numeric` sums exactly.
  `reconcile()` compares at exact grosz (`reconciliation.ts:40`), so the two paths can disagree by one
  grosz at a `.005` boundary and flip the mismatch warning. **Any parity test must assert this, not
  assume it** — this is the "prove it red" rule from lessons.md.

#### The `src/lib/db` pattern to follow

Correction to an assumption in `change.md`: it is **not** `@vercel/postgres` directly.

- `import { sql } from '@payloadcms/db-vercel-postgres'` (`sum-transfers.ts:1`) + `getDb(payload, req?)`
  (`get-db.ts:12-19`), which returns the transaction-scoped Drizzle instance when a hook `req` carries
  a `transactionID`, else `payload.db.drizzle`.
- Signature shape: `export const name = async (payload: Payload, …): Promise<TypedRowT[]>` —
  e.g. `sumPayoutsByWorkerForInvestment` (`sum-transfers.ts:338-363`).
- **Raw sums only; no business rule in SQL** — the comment at `sum-transfers.ts:249-251` is explicit.
  Classification/derivation lives in pure functions in `investment-financials.ts`. SQL returns
  `(group key, SUM)`, TS decides meaning. This is load-bearing convention.
- `perfStart()` + `console.log('[PERF] query.<name> …ms (n rows)')` on every query
  (`:110`, `:136`, `:327`).
- Rows hand-mapped with explicit `Number(…)` / `String(…)` into a `…T` type — never returned raw.
- Caching is a **separate layer**: `reference-data.ts` wraps each `lib/db` function in
  `unstable_cache(fn, [key, …args], { tags })` — per-investment shape at
  `fetchDepositTransactionsForInvestment` (`reference-data.ts:274-285`).

#### The caching gap on `getKosztorysTree`

No comment justifies it, and it is the odd one out — every neighbour in `reference-data.ts` is
wrapped, and tags for all four kosztorys collections already exist (`lib/cache/tags.ts:9-12`).

Decisive: `client-kosztorys.ts:77-81` **already caches a payload containing the very same tree**
(`buildKosztorysTree` at `:46`) under exactly the needed tag set (`KOSZTORYS_TAGS`, `:26-36`). The
invalidation contract is designed and in use; the owner path just doesn't use it.

Invalidation coverage is complete on both sides — server actions revalidate those tags on every
kosztorys write (`actions/kosztorys.ts:106,119,138,154,209,238,263,287,307,352,389,430,491,511,544,576,603,627,658`,
plus `kosztorys-presets.ts:84,153`, `kosztorys-snapshots.ts:87`), and
`makeRevalidateAfterChange/Delete` hooks cover out-of-band writes on all four collections.

Residual risk is not the tag set but write context: `updateTag` (actions) expires immediately,
`revalidateTag` (hooks) does not — so a write applied via the Payload admin panel leaves a stale tree
until the next request.

**Caching and aggregating are complementary, not alternatives.** Caching amortises the ~10 000-row
materialisation; it does not remove it on a miss. The SQL aggregate removes it outright.

#### Table names (grounded for the SQL above)

| Collection         | Table                | Notes                                                                                 |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------- |
| kosztorys-sections | `kosztorys_sections` | `w_tools_coeff`/`own_tools_coeff` **dropped** (`20260724_1`)                          |
| kosztorys-items    | `kosztorys_items`    | `measured_qty` **dropped** (`20260716_0`)                                             |
| kosztorys-stages   | `kosztorys_stages`   | `plane` enum nullable (`20260724_2`); UNIQUE `(investment_id, ordinal)`               |
| stage-progress     | `stage_progress`     | `item_id` FK CASCADE, `stage_id` FK, `qty_done` numeric; UNIQUE `(item_id, stage_id)` |

Investment scalars on `investments`: `vat_rate` (`20260710_0`), `global_discount_type/_value`
(`20260716_1`), `settlement_mode` enum (`20260726_3`), `materials_net_rate` (`20260726_4`),
`w_tools_coeff`/`own_tools_coeff` (`20260708_2`). DDL: `src/migrations/20260708_2_add_kosztorys_sections_items.ts:10-53`,
`src/migrations/20260709_0_add_kosztorys_stages.ts:11-33`. Indexes exist on
`kosztorys_items.investment_id` and `stage_progress.item_id`; the unique constraint serves the join.

### The read-path fan-out

#### `fetchReferenceData` runs 3× — confirmed, and `unstable_cache` does not dedupe it

| Site                                                           | On this route |
| -------------------------------------------------------------- | ------------- |
| `components/nav/navigation.tsx:21` (root layout → every route) | #1            |
| `app/(frontend)/inwestycje/[id]/page.tsx:54`                   | #2            |
| `components/transfers/transfer-table-server.tsx:24`            | #3            |

`fetchFilteredByType` also runs exactly twice (`page.tsx:55`, `transfer-table-server.tsx:26`) — and
they produce the **same cache key**: both are `stripCancelledFilters` (`queries/transfer-filters.ts:183-192`)
over the identical `transferWhere`, and the key is `JSON.stringify(where)` (`reference-data.ts:238`).

**The crux, verified against `node_modules/next/dist/server/web/spec-extension/unstable-cache.js` (16.1.7):**

> `unstable_cache` has **no request-scoped memoization**. It is a cross-request cache only.

- Each invocation independently computes a key, calls `await incrementalCache.get(cacheKey, …)`
  (`:145`), then `JSON.parse(cacheEntry.value.data.body)` (`:164`). A **warm** hit still costs a
  cache-store read + a full ~36.5 KB `JSON.parse`, **three times**.
- The only dedup structure is `workStore.pendingRevalidates` (`:167-193`, `:204-211`), keyed on the
  _revalidation_ promise, not the read. **On a cold entry all three callers execute the 5 SQL queries**
  (`:200`) and all three write the entry.
- Adjacent trap at `:143`: `!isNestedUnstableCache` — an `unstable_cache` inside another
  `unstable_cache` callback **bypasses the cache entirely**. Not hit here, but it is live in
  `queries/client-kosztorys.ts:77`.

**React `cache()` is absent from the data layer.** `grep -rn "from 'react'" src/lib/queries src/lib/db`
→ zero. Repo-wide it appears once: `lib/auth/get-current-user-jwt.ts:3,31`, commented _"Wrapped with
React cache() for deduplication within a single render pass."_ — the exact in-repo precedent.
`queries/kosztorys.ts:29` even cites the mechanism without extending it.

#### What `fetchReferenceData` actually loads

`reference-data.ts:64-178` — five **unbounded** raw SQL `SELECT`s in `Promise.all`, no `LIMIT`, no
`WHERE`, one `LEFT JOIN kosztoryses` for a `has_sheet` boolean. Measured on the local dev DB
(restored from prod):

| Table              |    Rows | Serialized JSON |
| ------------------ | ------: | --------------: |
| investments        |      96 |        25 796 B |
| users              |      48 |         6 971 B |
| cash_registers     |      32 |         3 088 B |
| other_categories   |      15 |           549 B |
| expense_categories |       3 |           137 B |
| **total**          | **194** |    **~36.5 KB** |

- **~48% of the investments blob is free-text nobody on this page reads.** Projected to
  `id, name, status, settlementMode, materialsNetRate, hasSheet` the 96 rows are **13 444 B** vs
  **25 796 B**. The delta — `address / phone / email / contactPerson / notes / review` — is
  company-wide PII shipped to three client dialogs and a client table that never render it. The
  file's own comment (`reference-data.ts:47-49`) already flags this as a **security** concern (that's
  why the slim `fetchExpenseCategories` exists); it is equally a payload concern.
- At 3 calls/request that is ~110 KB fetched + `JSON.parse`d server-side per render, for a page whose
  structural need is `refData.investments.find(inv => inv.id === investmentId)` (`page.tsx:60`) plus
  `refData.expenseCategories`.

#### Client boundaries take the full shape

| Boundary                                            | Prop type                           | Where                                                                  |
| --------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `TopNav` → Deposit/InternalTransfer/Expense dialogs | `ReferenceDataT` (full + 2 scalars) | `nav/top-nav.tsx:14,30-32`                                             |
| `TransferDataTable`                                 | `ReferenceDataBaseT` (full)         | `transfers/transfer-table-server.tsx:62`; `transfer-data-table.tsx:21` |

The three nav dialogs share **one** object reference, so flight serializes it once (~36.5 KB).
`TransferDataTable` gets a **different** object (its own `fetchReferenceData()` at
`transfer-table-server.tsx:24`) → serialized **again**. Against the 198 KB RSC payload measured
earlier, that is **≈73 KB ≈ 37%**, roughly half of it fields no consumer renders. The nav copy sits
in the **root layout**, so it is paid on every navigation app-wide — not an investment-page tax.

Downstream consumers (`forms/{deposit,expense,internal-transfer,edit-transfer}-form/*`,
`form-fields/line-items-field.tsx`, `tables/transfers.tsx`) all need `{id, name, active}`-shaped
lists. None need the free-text columns.

#### `navigation.tsx` breaks reference identity — confirmed

`components/nav/navigation.tsx:19-23`:

```ts
let referenceData: ReferenceDataT | undefined
if (isManager) {
  const base = await fetchReferenceData()
  referenceData = { ...base, currentUserId: user.id, currentUserRole: user.role }
}
```

Two separate consequences: for server-side dedup the spread is **harmless today** (nothing dedupes
anyway) but becomes load-bearing the moment React `cache()` lands — this site still mints a fresh
top-level object per render. For the RSC payload it is the actual cost: a distinct object literal is
a distinct flight-serialization root.

#### Suspense: parallel at the tail, hard serial gate at the head

Three boundaries: `app/(frontend)/layout.tsx:34-36` (the whole `AuthenticatedShell`),
`inwestycje/[id]/page.tsx:121-129` (`InvestmentSummaryPanel`), `transfers/transfers-section.tsx`
(`TransferTableServer`). Plus `nav/top-nav.tsx:25` around `NavOpenRouterBalance`.

- `Navigation` (fetch #1) and the page body are siblings → parallel. Good.
- **The page's own `await Promise.all([...])` at `page.tsx:53-57` sits behind no boundary of its own.**
  It blocks everything between the layout's `<Suspense>` and the page's inner ones — and the layout's
  fallback is the full-screen `Loader`. So **nothing paints, not even the shell**, until
  `fetchReferenceData` + `fetchFilteredByType` + `fetchCategoryBreakdowns` all resolve.
- Both inner fallbacks are **`fallback={null}`** — no skeleton. The Finanse section and the transfers
  table pop in from nothing, shifting layout twice. That is a perceptual-latency multiplier
  independent of the milliseconds, and it **diverges from the shipped plan**, which specified a
  v1-figures fallback (`context/changes/2026-07-26-investment-summary-panel/plan.md:131,299`).

#### `[PERF]` instrumentation and its one blind spot

`lib/perf.ts:2` exports `perfStart()`. On this route: `page.tsx:38,58` (the 3-fetch `Promise.all`),
`reference-data.ts:66,109` (**miss-only** — its absence in the log is itself the cache-hit signal),
`transfer-table-server.tsx:18,29,42,50`, `queries/transfers.ts:43` (miss-only).

**Gap: `getKosztorysTree` / `buildKosztorysTree` has no `[PERF]` line at all.** The route's alleged
long pole is uninstrumented; the 33 ms figure in `change.md` was measured externally. Any baseline
capture is blind on exactly the query under suspicion until this is added.

### Q5 — `cacheComponents`: nothing would fail to compile, but the blocker is unresolved

`next.config.ts:10` is `// cacheComponents: true` with **no** inline justification; `staleTimes` is
commented out at `:21-27` with its rationale intact. AGENTS.md:186 attributes both to "a Vercel bug".

The bug report **no longer exists in the working tree** — `docs/vercel-server-action-bug-report.md`,
added by `9746bd9b` (2026-03-19, _"fix: disable cacheComponents — breaks server actions on Vercel"_),
deleted by `fc212b93` ("remove old docs") and never migrated into `context/`. Recover with
`git show 9746bd9b:docs/vercel-server-action-bug-report.md`. Substance:

> All Next.js server actions return HTTP 500 on Vercel when `cacheComponents: true` is enabled. The
> error is a `JSON.parse` SyntaxError that occurs **inside the Next.js framework before any
> application code executes**. The same code works locally with `next start`.

Reported against Next **16.1.6 and 16.1.7**, Payload 3.73.0, React 19.2.4. Matrix: GET works, POST
server actions 500; Payload admin works (custom `handleServerFunctions` RPC, not standard actions);
API-route POST works; local `next start` and `next dev` both work. **The repo is on `next: ^16.1.7`
(`package.json:77`) — still inside the reported-broken range**, and no evidence anyone re-tested on a
newer 16.x.

Follow-up decision `358fac80` (2026-07-08): the Cache Components migration is _"parked behind a
documented Vercel bug"_; inline breadcrumbs removed because re-adding them is a trivial
`unstable_cache` → `'use cache'` swap and git preserves the form (`eec4c578`, rolled back by `9746bd9b`).

Current-tree state:

- **No `'use cache'` anywhere** (`grep -rn "'use cache'" src/` → zero).
- **Two dead imports survive the cleanup**: `queries/investments.ts:1` imports `cacheLife`/`cacheTag`
  unused (only `unstable_cache` at `:105`), and `queries/media.ts:1` imports both with neither used
  and no `unstable_cache` in the file. Harmless, but they read as evidence Cache Components is partly
  live. Worth deleting regardless of this change.
- **No route-segment escape hatches**: zero `export const dynamic` / `revalidate` / `force-dynamic` /
  `unstable_noStore` across `src/app`. Every page derives dynamism implicitly from `cookies()`.
- **The real blocker is structural.** Under `cacheComponents` every dynamic-API read must sit inside a
  Suspense boundary or a cached function. `requireAuth` is called at the top of every page
  (`inwestycje/[id]/page.tsx:34`) and inside the DAL guard `getKosztorysTree` (`kosztorys.ts:30`),
  neither behind a boundary of its own. `client-kosztorys.ts:74-76` already documents the inverse
  constraint hit in practice: _"The guard cannot live inside here: `requireAuth` reads cookies, and a
  dynamic API inside an `unstable_cache` callback throws."_

**Assessment: out of scope for this change.** A local `next start` re-test is cheap but, per the
original report, local passing proves nothing about Vercel — and the audit of every `requireAuth`
call site is a change of its own. Everything else here is available without it.

---

## Baseline: NOT captured — and why

`change.md` names the baseline a hard precondition. **It is not met.** Two attempts failed:

1. Playwright could not launch — the installed browser binary for this `@playwright/test` version is
   missing, and installing it is a large download.
2. Driving the running dev server (`:3000`) with the stored E2E `storageState`
   (`e2e/.auth/user.json`) **silently served the login page**. That token authenticates against the
   isolated 5435 test DB, not the dev DB on 5433. Timing numbers were produced and looked plausible —
   they were measuring the login route. **They were discarded, not reported.**

This is the failure shape lessons.md already names twice ("verify against the running app, not a
command one-liner"; the `elementFromPoint` probe measuring empty space). A number from an unverified
harness is worse than no number.

**Protocol for whoever captures it** (step 0 of implementation, before any edit):

- Mint a working dev-DB session first — per memory, the `ADMIN`/`PASS` env vars are stale; create a
  temp OWNER via a Local API script against 5433. **Assert the response body contains a
  page-specific string** before trusting a single timing.
- Add a `[PERF]` line to `buildKosztorysTree` **first** — the route's suspected long pole is currently
  uninstrumented, so a baseline without it is blind.
- Count **all** requests per toggle (GET + POST + bytes), not just POSTs. The earlier probe counted
  POSTs only and saw 1 — which is exactly what a redundant RSC **GET** would hide.
- Capture v1 (`?widok=v1`) vs v2 on the same investment — the transfers-only reference point.
- Capture on investment 6 (~43 items) **and** 7 (~1000-item perf seed); the shape argument only bites
  at scale.

---

## Architecture Insights

1. **"Fetch everything, filter in JS" appears at two layers of the same route.**
   `fetchReferenceData` loads 96 investments so `page.tsx:60` can `.find()` one; `buildKosztorysTree`
   loads up to 10 000 progress rows so the panel can produce two numbers. Same mistake, four months
   apart, at different altitudes.
2. **`unstable_cache` is the wrong tool for intra-request duplication and always was.** The repo
   already knows the right one — `get-current-user-jwt.ts` uses React `cache()` with a comment
   naming the exact property. Nothing in the data layer inherited it.
3. **The 2026-02 blob consolidation was a correct fix that inverted with scale.**
   `6c57ca65` deliberately replaced N per-page Payload ORM lookups with one cached blob — a win at
   ~27 investments, a 36.5 KB × 3 tax at 96.
4. **Suspense granularity is doing less than it appears.** The panel and table stream, but a head-of-line
   `Promise.all` with no boundary of its own gates the shell, and two `fallback={null}`s convert
   streaming into two content pop-ins.
5. **Tagging was already right; the refresh threw it away.** This is worth stating plainly because it
   inverts the intuitive read: the cache work was done correctly and then discarded one layer up by a
   client call. The lesson generalizes to the other four `router.refresh()` sites on this route.

## Historical Context (from prior changes)

- **`8e28b1b5` (2026-03-19)**, `docs/perf-logs-no-cache.md` (deleted by `fc212b93`; recover via
  `git show 8e28b1b5:docs/perf-logs-no-cache.md`). Production Vercel measurements at 104 reference
  rows: `fetchReferenceData 25–98ms`, `data fetch total 108ms`. Closing bullet, verbatim:

  > `fetchReferenceData` is called multiple times per page (by different server components) —
  > **candidate for deduplication or caching**

  **Recorded four months ago, never actioned. It predates the summary panel entirely.**

- **`6c57ca65` (2026-02-23)**, `docs/plans/2026-02-23-transfer-table-performance.md` (also deleted):
  the global blob was _deliberately introduced_ as the perf fix of its era.
- **`EX-540`** — the open issue that owns the tree fetch.
  `context/archive/2026-07-19-robocizna-from-kosztorys/review-gate.md:16`:

  > `getKosztorysTree` fetched unconditionally on every investment-detail render for 2 scalars
  > (5 queries; wasted entirely for kosztorys-less investments). Both candidate fixes carry a
  > measurement tradeoff → deferred to EX-540.

  `context/archive/2026-07-19-investment-recon-suspense/change.md:15-19`:

  > This is **option A** … It fixes **perceived latency only** — it does **not** close EX-540 (the
  > queries still run, just off the critical path).

  and `.../plan.md:40-41` lists what stayed out: the wasted I/O for kosztorys-less investments, and
  **"Caching the derivation (EX-540 option B, measurement-gated)"**. The options analysis lives on the
  Linear issue, not in the repo.

- **`context/changes/2026-07-26-investment-summary-panel/plan.md:469-472`** — the panel's entire
  "Performance Considerations" section:

  > One added cached query … **The kosztorys tree stays behind `<Suspense>` exactly as today, so first
  > paint is unchanged.**

  Locally true, but it treats the pre-existing fan-out as a fixed baseline it isn't responsible for,
  so nothing was consolidated. It also doesn't account for the panel's client payload, nor for the
  fact that v1 renders **without** the tree — which makes the v1/v2 delta the real regression surface.

- **`0a34d954`** — one genuine perf fix did land inside the panel arc: _"relay workers instead of
  re-reading reference data"_, which prevented a **4th** `fetchReferenceData`. The same reasoning
  applied one level up dissolves calls #2 and #3.
- **`80a3e839`**, **`52c2f0ca` (EX-517)** — prior tree-path perf work, on the editor route.

## Related Research

- `context/archive/2026-07-19-investment-recon-suspense/` — EX-540 option A, the `<Suspense>` now on
  `page.tsx:121`
- `context/archive/2026-07-19-robocizna-from-kosztorys/review-gate.md` — where EX-540 was filed
- `context/changes/2026-07-26-investment-summary-panel/plan.md` — the panel's perf assessment
- `context/foundation/lessons.md` — "Denormalized fields changed from outside the grid" (the
  `useState`-initializer trap, checked for and absent here); "verify against the running app"

## Open Questions

1. **Q1 and Q4 remain unmeasured** — see "Baseline: NOT captured". The double-render hypothesis is
   settled at framework-source level, which is stronger evidence than a request count; the _magnitude_
   is not.
2. **Do the other four `router.refresh()` sites on this route pass a `revalidate` array?**
   (`cancel-transfer-button.tsx:45`, `use-form-submit.ts:38,50`, the sheet dialogs.) If they do, they
   are redundant by the identical argument and this change gets much wider — deliberately not traced
   here to keep scope honest.
3. **What is `getKosztorysTree`'s real cost at 1000+ items?** Uninstrumented today. The shape argument
   stands on its own, but the _priority_ of aggregate-vs-cache depends on this number.
4. **Does the Vercel `cacheComponents` bug still reproduce on 16.1.7+?** Cheap to re-test locally,
   but local passing proves nothing about Vercel per the original report.
5. **Where should the slim reference-data projection live** — a new slim fetcher alongside
   `fetchExpenseCategories`, or a `select`-narrowed variant of the existing one? Affects whether the
   PII-in-payload concern (`reference-data.ts:47-49`) gets closed as a side effect.

---

## Follow-up Research 2026-07-27 — measurement channel on the deployed app

The owner's direction: measure against the deployed app with real data, and treat the **kosztorys
editor page** (`/inwestycje/[id]/kosztorys_v2`) as a second, coupled surface alongside the investment
detail page. First task was to establish whether that environment is reachable at all.

### There is no live production deployment

The last 12 deployments are **all `target: preview`** — none production. The production alias
`wykonczymy.vercel.app` returns an identical 15 060-byte Next 404 ("This page could not be found")
on `/`, `/login`, `/inwestycje`, and `/inwestycje/6` alike, i.e. it is not serving the app at all.

**The live app is the `staging` branch preview.** So "prod data" in this change means the preview
Neon DB behind `wykonczymy-git-staging-wykonczymys-projects.vercel.app`, which is safe to load-test.
Only one domain is registered on the project (`wykonczymy.vercel.app`, no `gitBranch`).

### HTTP to staging is walled by Vercel SSO — and the wall lies convincingly

Project protection is `ssoProtection: { deploymentType: "all_except_custom_domains" }`, with
`passwordProtection: null`, `trustedIps: null`, and **no `protectionBypass` secret configured**.
Since the project has no custom domain, every reachable URL is protected.

A plain `curl` of the staging investment URL returns:

```
status=200  ttfb=1.259s  total=1.838s  size=484184
```

— which is **Vercel's SSO login page**, `<title>Login – Vercel</title>`, not the app. This is the
third instance of the failure mode lessons.md already names twice: _a 200 with plausible timings is
not evidence you measured the thing you named._ Verify a page-specific string in the body first.
Driving staging over HTTP would require either a Protection-Bypass-for-Automation secret
(`x-vercel-protection-bypass` header) or a borrowed `_vercel_jwt` cookie.

### `vercel logs` is the measurement channel, and it needs neither

The Vercel CLI is authenticated (`vercel whoami` → `admin-63074310`) and the repo is linked
(`.vercel/project.json`). Runtime logs are readable **without touching the SSO wall**:

```bash
vercel logs --branch staging --since 12h -q "PERF" --expand --json
```

This returns the app's own server-side `[PERF]` telemetry, grouped per request. Real capture from
the owner's own browsing:

```
GET /
  [PERF] query.sumAllRegisterBalances      1015ms (29 registers)
  [PERF] query.fetchRegisterBalances       1016ms (29 registers)
  [PERF] query.fetchManagerDashboardData   1195ms
  [PERF] ManagerDashboard …                1196ms
  [PERF] TransferTableServer findTransfersRaw + fetchReferenceData  20ms
  [PERF] query.fetchMediaByIds              104ms (12 docs)
```

**This is strictly better than external HTTP timing** — per-query attribution instead of one opaque
wall-clock number, and it measures the real deployment against real data volumes. The protocol is:
the owner browses, the agent queries the logs. No credentials change hands and no project config is
modified.

**Retention caveat — the binding constraint.** Request _metadata_ (path, method, status) is retained
far longer than the log _bodies_: of 500 request records over 12 h, only the two most recent still
carried their `logs[]` array; the rest came back `logs: []`. Measurement must therefore be a live
session — browse, then query within minutes. A `--since 12h` sweep run the next morning will show
that the requests happened and nothing about what they cost.

Flags that matter: `-q` (full-text over log bodies), `--expand` (attach bodies), `--json`,
`--since`, `--limit`, `--branch`. Note `vercel logs` resolves the project from the **current working
directory** — running it from `$CLAUDE_JOB_DIR/tmp` fails with "codebase isn't linked".

### New finding: `sumAllRegisterBalances` is a 1-second query on the dashboard — IN SCOPE

Surfaced on the first real log read, and the slowest single query yet observed anywhere in the app:

| Log line                          | Value                                    |
| --------------------------------- | ---------------------------------------- |
| `query.sumAllRegisterBalances`    | **1015 ms** (29 registers)               |
| `query.fetchRegisterBalances`     | 1016 ms — a 1 ms cache wrapper around it |
| `query.fetchManagerDashboardData` | 1195 ms                                  |

`sumAllRegisterBalances` (`src/lib/db/sum-transfers.ts:71-112`) is two full `GROUP BY` scans of the
entire `transactions` table joined with `FULL OUTER JOIN`:

- `source_balances` — every row where `source_register_id IS NOT NULL AND cancelled IS NOT TRUE`
- `target_balances` — every row where `target_register_id IS NOT NULL AND type = 'REGISTER_TRANSFER'`

Neither predicate is selective; both are effectively full-table aggregations, and the cost scales
with **total transaction history**, not with the 29 registers returned. It sits on `/` (the
manager dashboard — the first page loaded every session) via `fetchManagerDashboardData`, and on
`/kasa/[id]` via `fetchRegisterBalances`.

It is `unstable_cache`d under the `transfers` tag (`reference-data.ts:182-188`), so the 1015 ms is a
**cache miss** — but every transfer create/delete invalidates that tag, so on an active day misses
are routine. Candidate fixes (unranked, unmeasured): a partial index on
`(source_register_id) WHERE cancelled IS NOT TRUE`, the same for `target_register_id`, or a
materialised running balance maintained by the existing recalculation hooks.

**Scope call: IN SCOPE (owner, 2026-07-27).** I first recorded this as out of scope on the reasoning
that it touches neither page named and shares no code path with them. The owner overruled it, and the
correction is worth keeping visible because the reasoning error is reusable: **scope here is defined
by the acceptance bar, not by the code path.** The bar is _"the app feels as fast as it did
originally"_; `/` is the first page loaded in every session, so a one-second query on it is the same
defect as the panel, reached by a different route. "Different file" is not "different problem".

### Confirmation of the owner's coupling instinct

The two pages share `getKosztorysTree` and size it for the heavier consumer:

| Surface                                       | Tree consumption                                   |
| --------------------------------------------- | -------------------------------------------------- |
| `/inwestycje/[id]` → `InvestmentSummaryPanel` | 100% aggregate → **two numbers** (see Q3 above)    |
| `/inwestycje/[id]/kosztorys_v2`               | genuinely per-row — the editor needs the full tree |

Additionally the editor page runs a **nine-way `Promise.all`** (`kosztorys_v2/page.tsx:47-67`):
tree, `fetchFilteredByType`, `fetchCategoryBreakdowns`, `fetchReferenceData`,
`fetchPayoutsByWorkerForInvestment`, `fetchPayoutTransactionsForInvestment`,
`fetchDepositTransactionsForInvestment`, `fetchMaterialTransactionsForInvestment`,
`requireInvestmentOr404` — with **zero `[PERF]` instrumentation** before this change, and no
`<Suspense>` boundary of its own. So the coupling is not a shared component; it is one uncached
query sized for the editor and paid in full by a page that reduces it to two scalars.

### Instrumentation added (step 0 of any measurement)

Three files, log-only — no behavior change:

- `src/lib/queries/kosztorys.ts` — `buildKosztorysTree` now emits a per-sub-query line
  (`[PERF] query.kosztorysTree.{sections,items,stages,progress,investment}` with row counts) plus a
  summary splitting **setup / queries / map**. The five reads share a `Promise.all`, so each read
  times itself via a local `timedRead` helper — a lap timer would have credited the whole
  wall-clock to whichever settled last. The `map` figure is the one that matters for the
  aggregate-in-SQL argument: it isolates the cost of materialising the tree in JS, which a cache
  amortises but does not remove.
- `src/components/investments/investment-summary-panel.tsx` — `[PERF] InvestmentSummaryPanel`
  splitting **fetch / derive**, tagged with the row count that produced the two output scalars.
- `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx` — `[PERF] kosztorys_v2/<id> 9-fetch
fan-out`.

This closes the blind spot named in "Baseline: NOT captured" — the route's suspected long pole was
the one thing uninstrumented. It must reach `staging` before any measurement is meaningful.

### Corrected baseline protocol

Supersedes the local-dev protocol above:

1. Land the instrumentation on `staging` (a human pushes).
2. Owner loads `/inwestycje/<id>` and `/inwestycje/<id>/kosztorys_v2` on staging — pick both a small
   and a large kosztorys, since the shape argument only bites at scale.
3. Agent immediately runs `vercel logs --branch staging --since 30m -q "PERF" --expand --json`.
4. Repeat after each spike, comparing the same log lines.

Points 1–3 of the earlier local protocol (mint a dev session, assert a page-specific string, count
all requests) still apply to any **browser-side** measurement of the `router.refresh()` round-trip
count, which server logs cannot see. That one is verifiable by eye in DevTools' Network panel.

---

## Baseline captured 2026-07-27 14:38–14:40 — instrumented preview, owner browsing

Deployment `wykonczymy-gooxkhwi5` (branch `ex-597-decouple-panel-write-refresh`), read via
`vercel logs <url> -q "PERF" --since 30m --json`. Investment **31**: 13 sections, **324 items,
1 stage, 0 stage-progress rows**.

### Q1 ANSWERED — the double render is real, and it is visible in the server logs

One click on the materials-net-rate control produces **two full server renders of the route**:

| t (ms) | Request               | What ran                                                                                                                                                                                         |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0      | `POST /inwestycje/31` | `updateInvestmentMaterialsNetRateAction` **126 ms** — _then the entire page_: `fetchReferenceData` ×3, `buildKosztorysTree` 104 ms, `InvestmentSummaryPanel` 107 ms, `TransferTableServer` 81 ms |
| +566   | `GET /inwestycje/31`  | **the entire page again**: `fetchReferenceData` ×3, `buildKosztorysTree` 77 ms, `InvestmentSummaryPanel` 80 ms, `TransferTableServer` 64 ms                                                      |

Reproduced on both toggles in the session (`937256`/`938246` and `959911`/`960477`). The POST
carrying a full page render is `updateTag` doing exactly what the framework-source trace predicted;
the GET 0.5 s later is the redundant `router.refresh()`. **The hypothesis in `change.md` is
confirmed against a running deployment, not just against Next's source.** The actual write is
~126 ms of the ~1.1 s the user waits; the rest is rendering the page twice.

Note the ordering: the action's own work finishes at 126 ms, and the re-render is then paid
**twice, sequentially** — the refresh GET does not start until the action's render has streamed.

### `fetchReferenceData` runs 3× per render — confirmed live, so 6× per toggle

Every render logs three separate `query.fetchReferenceData 5 SQL, 192 rows` lines (15/21/24 ms warm,
68/84/34 ms cold). The 2026-03-19 dedup note was right and is still unactioned. With the double
render, **one toggle executes 30 SQL statements' worth of reference data to change one number.**

### The tree is NOT the bottleneck at this size — and its worst case is untested

`buildKosztorysTree` at 324 items: **77–309 ms, of which `map` is 0–1 ms**. The JS reduction the
change doc flagged as a smell costs nothing measurable; the entire cost is the `items` query
round-trip (76–211 ms for 324 rows). `InvestmentSummaryPanel` `derive` is likewise **1 ms** for
324 rows → 2 scalars.

**But investment 31 has `stages 1, progress 0`.** The `limit: 100000` stage-progress read returned
zero rows, so the fetch-everything-and-reduce-in-JS concern is **unmeasured, not disproven**. A
kosztorys with real stage progress (~10 stages × 1000 items ⇒ ~10 000 rows) is the case that
matters and it was not exercised. Do not close that finding on this data.

The variance is worth noting on its own: the same `items` query ranged 76 → 309 ms across renders
seconds apart. Preview-lambda cold starts and the shared preview DB make any single number
unreliable; only the ×2 render count is a clean signal here.

### `kosztorys_v2` fan-out is ~100–220 ms — the nine-way `Promise.all` is not the problem

`kosztorys_v2/31 9-fetch fan-out`: 93, 106, 114, 114, 117, 209, 222 ms. It parallelises properly.
The editor page's own actions (`addItemAction` 121–168 ms, `addSectionAction` 131 ms) show the same
double-render shape as the investment page — POST re-renders, then a GET re-renders again.

### `sumAllRegisterBalances` did not appear — because the cache was warm

`/` logged `fetchManagerDashboardData` at **36, 41, 162, 172, 215 ms** and no
`sumAllRegisterBalances` line at all. That is the cache **hit** path. Against the 1015 ms cold
measurement, the cliff is roughly **28×**, and which side of it a page load lands on is decided by
whether anyone has touched a transfer since the last load. This does not soften the finding — it
sharpens it: the dashboard is fast until someone books a transfer, then it is not.

Also visible: **four `GET /` renders fired within 350 ms of each other** (`909304`, `909623`,
`909640`, `909655`). Not explained yet — prefetch is the obvious suspect. Flagged, not investigated.

### What this changes about the plan

The read-path rebuild (SQL aggregation, slim projections) is **not** where the user-visible second
goes at today's data size. The ranked order the numbers actually support:

1. **Delete the two `router.refresh()` calls** — halves the work per toggle, touches two lines,
   zero parity risk. This is S1 and it is now evidence-backed rather than hypothesised.
2. **React `cache()` on `fetchReferenceData`** — 3 → 1 per render, and the effect doubles under (1).
3. **`sumAllRegisterBalances`** — the only genuine second-scale query found, and it is on `/`.
4. **The tree** — defer until measured against a kosztorys with real stage progress.

## Second capture 14:45–14:46 — investment 42 (Białostocka), instrumented preview

`inv 42: 13 sections, 324 items, 10 stages, 125 progress`. Roughly 20 toggles of the materials
net-rate control plus two `applyPercentRabatToAllItemsAction` runs on `/inwestycje/42/kosztorys_v2`.

### The double render is now airtight — ~15 consecutive POST→GET pairs

Every `updateInvestmentMaterialsNetRateAction` / `updateInvestmentSettlementModeAction` POST carries
a full page render, and 200–300 ms later a `GET` runs the **entire nine-way fan-out again**:

```
14:45:45.713 POST  action 72ms   → tree 96ms,  fan-out 101ms
14:45:45.904 GET                 → tree 93ms,  fan-out  96ms
14:45:46.143 POST  action 71ms   → tree 88ms,  fan-out  92ms
14:45:46.357 GET                 → tree 100ms, fan-out 102ms
```

Not a sampling artifact: it repeats on **every** toggle in the window, on both actions, and on the
investment page as well as the editor. `change.md`'s hypothesis is settled.

### `applyPercentRabatToAllItemsAction` builds the tree THREE times per click

```
14:46:07.337 POST  buildKosztorysTree 109ms   ← inside the action
                   applyPercentRabatToAllItemsAction 209ms
                   buildKosztorysTree 103ms   ← the action response's page render
                   fan-out 113ms
14:46:07.964 GET   buildKosztorysTree  74ms   ← the router.refresh()
```

The action reads the tree to compute the rabat, then the route re-renders and reads it again, then
the refresh reads it a third time. Deleting `router.refresh()` removes one of the three; the
remaining duplicate is the action and its own re-render, which **no cache tag can dedupe** because
`getKosztorysTree` is uncached and `unstable_cache` has no request-scoped memoisation anyway. This
is the strongest argument yet for caching or React-`cache()`-ing the tree — not the row count.

### Rapid clicking is where "unusable" comes from

Six toggles between 14:45:46.387 and 14:45:48.320 — under two seconds — produced **twelve full route
renders**, one pair per click, each re-running the fan-out. Nothing debounces, nothing coalesces, and
each render is 80–315 ms of server work. The control is inert throughout (no `useOptimistic`), so the
user keeps clicking, which multiplies the stampede.

### The tree's worst case is STILL untested — this dataset does not have it

Investment 42 has **125 stage-progress rows**, not the ~10 000 the `limit: 100000` read is sized for.
`buildKosztorysTree` ranged 71–311 ms across ~25 samples with `map` at **0–1 ms every single time**,
and `derive` at 4–8 ms. At the data sizes that actually exist in this database, the JS reduction the
change doc flagged is free and the cost is purely query round-trips. **No investment in the preview
DB exercises the 1000-item case recorded in memory.** Treat the aggregate-in-SQL rebuild as
unjustified-by-measurement until such a kosztorys exists.

### Nothing on any page exceeded ~320 ms of server time

Across both captures the ceiling was `buildKosztorysTree 311ms` / `fan-out 315ms`, and the median was
~90 ms. The single second-scale query found anywhere remains `sumAllRegisterBalances` on a cold
`transfers` tag. **The perceived slowness is therefore not one slow query — it is doing the same
80–300 ms of work two to three times per interaction, with no optimistic feedback while it happens.**

### Revised ranking (supersedes the previous section)

1. **Delete the two `router.refresh()` calls** — removes one full render per interaction.
2. **`useOptimistic`/`useTransition` on the controls** — promoted; the stampede above is a direct
   consequence of the control looking dead, and this is what makes the remaining ~100 ms invisible.
3. **React `cache()` on `fetchReferenceData` and `getKosztorysTree`** — kills the intra-request
   triplicate and the action-plus-render tree duplicate.
4. **`sumAllRegisterBalances`** — the only genuine second-scale query.
5. **SQL aggregation / slim projections** — parked. `map 0ms` says the current shape is not the cost
   at real data sizes.

## S1 result 15:08 — `router.refresh()` deleted, render count halved

Deployment `wykonczymy-65rd4hlny` (commits `a61fdd5a` + `dd148c15`), investment 42, same pages.

```
15:08:12.136 POST  updateInvestmentSettlementModeAction  189ms → tree 153ms, panel 159ms
15:08:15.225 POST  updateInvestmentSettlementModeAction  250ms → tree 230ms, panel 240ms
15:08:17.950 POST  updateInvestmentMaterialsNetRateAction 253ms → tree 152ms, panel 162ms
```

**No trailing `GET` on any of them.** Before S1 every settings POST was followed 200–300 ms later by
a GET re-running the whole fan-out; that GET is gone. Server work per interaction is halved, and the
hypothesis that `updateTag` alone delivers the fresh render is confirmed end-to-end — the values
still land, so nothing depended on the second render.

**Caveat, recorded rather than assumed away:** the action's own lap time rose from 72–126 ms
pre-S1 to 189–253 ms in this window. Nothing in S1 touches the action, and the tree query in the
same requests spanned 150–318 ms (it spanned 71–311 ms pre-S1), so preview-lambda variance is the
overwhelmingly likely explanation. But it is a swing in the very number the improvement is claimed
against, and the preview environment is too noisy to prove otherwise from one window. Any future
before/after on this branch needs more samples than this.

**Still unverified: `dd148c15`** (the editor's `optimisticSettingSave` tail). The editor was not
exercised in this window. Its risk is specific and different from the panel's — `rows` lives in
`useState` with a once-only initializer, so if any settings path leaned on the refresh for something
`patchRows` does not cover, the symptom is a stale cell rather than a slow page.

## S2 investigation 2026-07-27 — `sumAllRegisterBalances` is not a query problem

The owner ranked this first. It is not fixable as ranked, and the reason matters more than the
number: **the 1015 ms was never in the SQL.**

`EXPLAIN (ANALYZE, BUFFERS)` of the exact query against the local prod-restored copy:

| Fact                     | Value                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| `transactions` rows      | 3 044 (2 667 with `source_register_id`, 182 with `target_register_id`) |
| Table size incl. indexes | 1 256 kB                                                               |
| Planning time            | 3.6 ms                                                                 |
| **Execution time**       | **2.4 ms**                                                             |

Both `GROUP BY` legs already index-scan (`transactions_source_register_idx`,
`transactions_target_register_idx`). The whole table is ~1 MB — it fits in shared buffers many times
over. There is no scan to optimise.

**So where does 1015 ms come from?** `perfStart()` fires at function entry, before
`await getDb(payload)` and before the first `db.execute`. `getDb` itself opens nothing — it reads
`payload.db.drizzle` off the adapter (`src/lib/db/get-db.ts:12-19`) — so the entire second is inside
the first `db.execute` of a **cold request**: Neon compute wake + TLS handshake + pool establishment.
`sumAllRegisterBalances` doesn't cost a second; it is simply the first query to touch the database in
a cold lambda, and it pays the connection bill for everything after it.

Corroborating evidence already in this doc: `fetchManagerDashboardData` measured 36–215 ms **total**
whenever the lambda was warm. That is arithmetically impossible if its own child query cost 1015 ms.
The ~28× cliff recorded earlier was the cold/warm boundary, not a cache hit/miss boundary.

### Consequences

- **No index, running-balance column, materialized view, or SQL rewrite would move this number.**
  All of them optimise the 2.4 ms. Writing one would have been cargo cult, and would have added a
  denormalised balance to maintain on every transfer create/delete for zero gain.
- The earlier framing in `change.md` — _"two full GROUP BY scans of the whole transactions table;
  cost scales with transaction history"_ — is **wrong on both counts**. They are index scans, and at
  3 044 rows history is not the driver. Superseded by this section.
- The real lever is connection warmth, which is infrastructure, not application code: Fluid Compute
  instance reuse (already the default) and Neon's scale-to-zero wake. Both are outside this change.
- **`unstable_cache` on this is still correct** — it keeps warm requests off the DB entirely — but its
  value is avoiding a round-trip, not avoiding an expensive query.

### What this says about the whole spike

Every server-side number captured so far has a warm median under ~100 ms, and the one outlier turns
out to be connection setup. The server is not where the perceived 1–2 s lives; the client-side
capture already showed ~520 ms median click→paint with ~220 ms of it after the action resolves. This
is further evidence that the remaining wins are in the render/commit path, not in SQL.

## S3 landed 2026-07-27 — `fetchReferenceData` deduped per request

`src/lib/queries/reference-data.ts` — `cache()` wrapped **around** the existing `unstable_cache()`.
The two dedupe on different axes and both are wanted: `unstable_cache` spans requests and dies on tag
invalidation; React `cache()` collapses the 3 calls **within one render** (page + transfer table +
root-layout nav), which is the 3× measured in the baseline.

**Safety argument, since this one has a real failure mode.** A request-scoped cache returns stale data
if the same request reads _before_ it writes. Verified no server action reads `fetchReferenceData`
(only three comments mention it, `src/lib/actions/kosztorys.ts:137,152,208`), so the render's first
call is always post-mutation. Typecheck clean.

### Rejected: the same treatment for `getKosztorysTree`

Ranked #2 and approved by the owner, then **dropped on inspection** —
`applyPercentRabatToAllItemsAction` reads the tree, mutates rows, and the ensuing render reads it
again. Request-scoped memoisation would hand the render the **pre-mutation** tree and the grid would
render stale prices. This is a silent wrong-data bug, not a latency trade, so no. It only becomes
available if that read moves after the write.

### Correction — the whole-tree-for-two-scalars finding stands (2026-07-27)

I ranked this last with the reasoning "SQL aggregation is unjustified since `map` is 0–1 ms." That
is a bad argument and is withdrawn. `map` being free proves the **JS reduction** isn't the cost; it
says nothing about the **5 ORM round-trips and row serialization** feeding it, which is where the
measured 71–339 ms actually goes (`fetch` 71–339 ms vs `derive` 1–16 ms — the split is already in the
log line at `investment-summary-panel.tsx:58`).

Verified against the code rather than re-quoted. `InvestmentSummaryPanel` reduces the whole tree to
exactly **two** scalars — `sumaPracNet` + `rabatClientNet` (`:44-47`). The three other tree values it
forwards (`vatRate`, `settlementMode`, `materialsNetRate`, `:83-85`) come off the investment row,
i.e. query #5 (`findByID`). So the four unbounded queries — sections `limit 1000`, items `limit 5000`,
stages `limit 1000`, **stage-progress `limit 100000`** — are paid entirely for those two numbers.

**But "move it to SQL" is the wrong first instinct.** `kosztorysClientTotals` is not a `SUM`: it
applies the global discount, per-section coefficients and VAT, and the editor runs that same logic on
the same rows. A SQL port forks that business logic into two implementations that must agree forever
— the exact seam AGENTS.md's "one concept, one name" rule exists to prevent. The cheaper framing is
**stop making the investment page pay for the editor's tree**: a narrower query shaped to this
consumer, or caching the two scalars under the `kosztoryses` tag. Decide the shape before the ticket.

Worst case remains **unmeasured** — no kosztorys in this DB exceeds 125 stage-progress rows against a
`limit: 100000`, so the unbounded read has never actually been stressed.

## S4 mechanism 2026-07-27 — why no cache-tag arrangement can decouple the render

Traced through Next 16's own source (`node_modules/next`), because two earlier notes in this doc were
wrong about it. **Correcting the record first:** the note that "only tags without a profile
(`updateTag`) count as requiring client cache invalidation" is misleading as I used it.
`addRevalidationHeader` sets `x-action-revalidated` on `pendingRevalidatedTags.length` **alone**
(`server/app-render/action-handler.js:108-112`), and _both_ `revalidateTag` and `updateTag` push into
that array (`server/web/spec-extension/revalidate.js:174-193`). The profile only gates a different
variable, `pathWasRevalidated`.

### The three-way interaction

1. **`pathWasRevalidated` controls whether the POST carries a page render.**
   `skipPageRendering ||= workStore.pathWasRevalidated === undefined || ... === ActionDidNotRevalidate`
   (`action-handler.js:831`). It is set only when `!profile || cacheLife?.expire === 0`
   (`revalidate.js:199-203`). So a **profile**-revalidation skips the render in the action response.
2. **But the header is set regardless**, so the client's `revalidationKind !== ActionDidNotRevalidate`.
3. **With `flightData === undefined` and a non-zero revalidationKind, the client falls through to a
   plain `navigate(...)` with `FreshnessPolicy.RefreshAll`** (`client/components/router-reducer/
reducers/server-action-reducer.js:244-273`) — an unseeded navigation, i.e. **a fresh GET of the
   current route**.

Net: profile-revalidation does not remove the re-render, it **relocates** it from the POST to a
follow-up GET, adding a round-trip. That is the exact trailing GET S1 deleted.

### The only branch that re-renders nothing

```js
revalidationKind === ActionDidNotRevalidate && flightData === undefined // → "No navigation is required."
```

(`server-action-reducer.js:216-222`)

**Conclusion: a server action that invalidates any tag, by any API, forces a full route render
somewhere.** Cache tags cannot decouple the transfers table from a settings write. The tagging was
never the problem and no amount of tag precision fixes it.

### Consequence for the design

The write must leave the server-action path. Shape:

- `PATCH /api/investments/[id]/kosztorys-settings` route handler — `requireAuth`, write,
  `revalidateTag(CACHE_TAGS.investments)` (route-handler context, per the AGENTS.md rule). Route
  handlers set no `x-action-revalidated`, so nothing re-renders.
- It returns the recomputed figures; the panel seeds from server props and owns them in client state.

**This cannot ship without client-side ownership of the figures.** `materialsNetRate` reaches four
consumers, three of them page-level siblings of the panel (Marża strip, materials tile, transfers
header/CSV). Remove the route render and those three go stale until the next navigation. So the
decoupling (#3) and the optimistic/pending work (parked as "the end") are **one refactor**, not two —
#3 without it ships visibly stale numbers. They should be planned and built together.

## Scope change 2026-07-27 — settings left the investment page instead of being decoupled

The owner cut the problem rather than solving it: **investment settings are edited in the kosztorys
editor only.** The investment page's panel now renders the figures read-only and links across with
`?ustawienia=1`, which opens the totals panel with the „Ustawienia inwestycji" block expanded.

This retires S4's route-handler design **for this route**. With no settings write on
`/inwestycje/[id]`, there is nothing there to decouple from the transfers table — the render that S4
proved unavoidable simply never fires. The mechanism finding stands and still governs the editor
side, where the same writes now live; it is just no longer blocking.

Landed in `37349c77` (panel split, `investment-summary-panel-client.tsx` deleted) and `94e881a4`
(editor back arrow). Note the client `[PERF:client]` marks went with the deleted wrapper, so
client-side click→paint is no longer instrumented on that route.

### The `?ustawienia=1` arrival is URL state, deliberately

Rejected a localStorage write from the linking page. The panel's open state is a persisted
**preference** (`usePersistedEnum`, key `table-columns:kosztorys-totals-open`), so writing it would
flip the reader's default for every future visit off one click. It also covers only half the target —
the settings block itself is `CollapsibleSection`'s `useState(defaultOpen)`, not persisted. A one-shot
arrival intent belongs in the URL; the flag is seeded into `useState` once rather than read every
render, so closing the panel hands control back to the preference.

## S3 measured 2026-07-27 — the `cache()` dedup works and is not felt

`query.fetchReferenceData` fires **once** per render, confirmed across every POST in the deployed
logs (was 3×). Worth ~60 ms and invisible next to the variance. Five instrumented clicks:

| action resolved | painted | client gap |
| --------------- | ------- | ---------- |
| 1123 ms         | 1399 ms | 276 ms     |
| 226 ms          | 444 ms  | 218 ms     |
| 1311 ms         | 1935 ms | 624 ms     |
| 222 ms          | 422 ms  | 200 ms     |
| 293 ms          | 679 ms  | 386 ms     |

Server-side those same clicks cost **200–450 ms total**. So the two ~1.2 s clicks are ~900 ms of
cold lambda + Neon wake — **not our code**, the same cold/warm boundary that produced S2's fake
"28× cache cliff". And **every** click pays 200–620 ms between the server answering and the pixel
changing: pure client-side React rebuilding the transfers table.

**Conclusion: server work is no longer the problem on this page.** The remaining perceived latency is
(1) the client re-render, (2) intermittent cold starts. Neither is a slow query, so the owner's
"we're hiding slow queries" objection to optimistic UI no longer applies — there is no slow query
left to hide.

## S6 landed 2026-07-27 — the media lookup, cached whole and read via raw SQL

`fetchMediaByIds` ran **uncached on every render**, as a serial hop behind the transfers query (it
needs their invoice ids). Now the whole table is cached under a new `CACHE_TAGS.media` and filtered
in memory. `a1bf7234` + `72ff0ea1`.

**Why cache the whole table and not the id set** — the inversion is the point. The id-filtered read
ran on every render; the whole-table read runs only after a media write, and reads outnumber media
writes by orders of magnitude. The full sweep is also cheaper outright: **0.26 ms vs 1.6 ms**
(`EXPLAIN ANALYZE`, prod restore) — 988 rows / 808 kB read sequentially beats one index probe per id.

**Why a Payload collection hook, against the "side effects go in the server action" rule** — four
write paths exist, not the two initially assumed:

1. `POST /api/upload-file` → `uploadFile()` → `payload.create`. Three UI entry points funnel here
   (`invoice-upload-dialog`, `edit-transfer-form`, `expense-form` via `resolveInvoiceMediaIds` —
   the last uploads 10–20 receipts per submit, 4 concurrent).
2. `setTransferInvoice` (`src/lib/actions/transfers.ts:311`) deletes the replaced media
   **fire-and-forget** — unawaited, so it can land after the action returns and after any
   action-level revalidation. An action-side bump races it and sometimes loses.
3. - 4. Payload admin panel create/update/delete. _(Owner: `/admin` is never used, so this is not a
        live path — but it costs nothing to cover and the hook is one line either way.)_

The collection is the one seam all four cross. `afterDelete` also bumps `transfers`:
`transactions_invoice_id_media_id_fk` is `ON DELETE SET NULL`, so removing a media row silently nulls
every transfer pointing at it — a pre-existing staleness nothing invalidated before.

**Invalidation verified from code, not by clicking.** `fetchReferenceData` is `unstable_cache`d under
six tags (`users`, `investments`, `cashRegisters`, `otherCategories`, `expenseCategories`,
`kosztoryses`) and every one of those collections invalidates through the same
`makeRevalidateAfterChange` helper. If `revalidateTag(tag, 'default')` from a Payload hook did not
expire an `unstable_cache` entry, reference data would be permanently stale app-wide. Media is the
seventh tag on a mechanism already proven six times. `skipRevalidation` is never set on any media
path (tests, seed scripts and kosztorys batch ops only).

### Raw SQL over `payload.find` — and the prediction that was wrong

First cut used `payload.find`; the cold populate measured **375 ms for 949 docs** while the DB does
the select in 0.26 ms. That is ORM hydration, and it is re-paid on the first render after every media
write — which the bulk expense form triggers 10–20 times per submit. Swapped for
`select id, url, filename, mime_type from media` via `getDb`.

Safe because `url` is a **stored column** holding the finished serving path
(`/api/media/file/<filename>`, populated on all 988 rows), so the string is byte-identical to what
`payload.find` returns; the collection is `read: () => true` and the old call already passed
`overrideAccess`. Residual risk is theoretical: reconfiguring the media serving path would leave
stored URLs stale where `payload.find` would recompute — and would break every existing link anyway.

**Result: 375 ms → 100–124 ms (950 docs). I predicted single digits and was wrong** — the residual is
the Neon round-trip plus ~100 kB of rows on the wire, not ORM overhead. Floor doesn't move without
shipping fewer columns.

Warm renders, which is what matters — `TransferTableServer buildTransferRows`:

| before any of this work              | after             |
| ------------------------------------ | ----------------- |
| 25, 30, 33, 39, 41, 143, 151, 265 ms | 11, 16, 17, 33 ms |

### Still open

- **The tree** (Q3 / the correction above) — ~120–175 ms warm on the investment page, four unbounded
  queries for two scalars. Fix shape still unsettled; **not** a SQL port of `kosztorysClientTotals`.
- **Worst-case tree read** remains unmeasured — no kosztorys in this DB approaches the
  `limit: 100000` on stage progress.
- **Optimistic / pending UI** — now the only remaining lever on perceived latency (see S3's client
  gap), still parked by the owner.
- **Media invalidation** never exercised by a live upload/delete; accepted on the shared-mechanism
  argument above.
