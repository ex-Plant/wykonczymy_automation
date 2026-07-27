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
