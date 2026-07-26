---
date: 2026-07-26T16:48:49+02:00
researcher: ex-Plant
git_commit: a5ef7baf
branch: staging
repository: wykonczymy
topic: 'EX-548 domain terminology drift — re-inventory and classification at HEAD'
tags: [research, codebase, kosztorys, domain-naming, ex-548, plane-suffix, eslint-guard]
status: complete
last_updated: 2026-07-26
last_updated_by: ex-Plant
---

# Research: EX-548 domain terminology drift — re-inventory and classification at HEAD

**Date**: 2026-07-26T16:48:49+02:00
**Researcher**: ex-Plant
**Git Commit**: `a5ef7baf`
**Branch**: `staging`
**Repository**: wykonczymy

## Research Question

Re-run the EX-548 drift inventory and the A/B1/B2/gray classification against the current code.
The 2026-07-20 research (commit `2562a2e1`) is stale: paths moved, new drift landed, and the
evidence base for decisions.md Q2 no longer exists. Features are still landing concurrently, so the
pass must be code-grounded and must record how fast the surface is moving.

## Summary

**The rename is still the right next step, and it is smaller and better-bounded than it looked —
but all three of the plan's supporting artifacts (glossary, decisions.md, the eslint guard) are
wrong at HEAD.**

1. **The surface is measurable now, not estimated.** Running the repo's own dormant AST rule
   read-only replaces the prior pass's "≈35 identifiers" with hard numbers: **31 distinct
   identifiers / 337 occurrences / 47 files** for the nine stems the guard already lists, **22 more**
   matched only by extended stems, and **8 more** (`wydatki*` / `reszta*` / `doRozliczenia*`) that no
   stem list covers — ≈ **61 identifiers** total. grep is unusable here: ~30% of Polish text hits are
   UI strings, JSX text and comments, all correct by policy, none of them visible to the rule's
   `Identifier` visitor.

2. **The blast radius is near zero — this is a pure TypeScript symbol rename.** No drift identifier
   is a DB column, a Payload field name, or a persisted-JSON key. Verified by sweeping every
   `name: '…'` in `src/collections/*.ts` and every quoted SQL identifier in `src/migrations/*.ts` for
   all 17 stems: zero hits (the Polish in migrations is all comments). Both persisted jsonb payloads
   are already fully English. What _is_ frozen is a short list of **string values** next to those
   identifiers — uppercase DB enum values, the Google-Sheets label strings and column order, and one
   localStorage value.

3. **~⅓ of the drift surface was created in the six days since the last pass.** 16 inventoried
   identifiers did not exist on 2026-07-20 (`sumaPracPreRabat`, `globalRabatNet`, `doZaplatyGross`,
   `sumaPracMismatch`, `rabatMismatch`, `nettoShown`, `isBruttoMaterial`, `BruttoNettoSummary`,
   `PercentRabatTool`, the `applyPercentRabat*` family, `materialyPair`, `itemRabat`,
   `maxEtap`/`etapFirst`, `executedWorkNetPreRabat`, …). HEAD moved three times _during this research
   pass_ (`b1a608db` → `c541242c` → `a5ef7baf`). Drift is compounding faster than the plan is being
   executed — that is the argument for landing rename + guard now rather than after the next slice.

4. **The guard as committed would certify the codebase clean while ~22 real drift identifiers
   survive**, and it has a structural blind spot. In code-identifier positions its nine stems match
   far less than a grep suggests (`strata` → 0, `zaliczk` → 0, `robocizn` → 1, `etap` → 2), while the
   _unlisted_ families (`sumaPrac*`, `doZaplaty*`, `materialy*`, `saldo*`, `wydatki*`, `reszta*`,
   `netto*`, `brutto*`, `wykonan*`) carry the bulk of the real work. And because the rule visits
   `Identifier` nodes, it **cannot see Polish string-literal union members** —
   `SectionPieBaseT = 'przedmiar' | 'wykonane'` and
   `SummaryViewT = 'summary' | 'wydatki' | 'wplaty' | 'etapy' | 'podwykonawcy'` are invisible to it.

5. **All three decisions.md rulings need re-confirming, and Q2's is now actively wrong.** Q1 and Q3
   still describe HEAD correctly. Q2 does not: `rabatAmount` is no longer computed anywhere — the
   `discountAmount + itemRabatTotal` arithmetic is gone, the selection moved down into
   `clientTotalsFromSubtotals`, and `rabatAmount` is now just a **second name for `rabatClientNet`**
   with a single producer. Coining `effectiveDiscountNet` would _create_ a rule-4 violation rather
   than resolve one.

Plus one out-of-scope discovery: **`saldo*` is the single largest drift family in the repo**
(16 distinct identifiers, ~155 occurrences, 20 files), entirely on the registers/transfers plane. It
needs a scope ruling before the guard is enabled — a `saldo` stem turns 20 unrelated files red.

## Detailed Findings

### 1. Inventory method — resurrect the dormant guard, don't grep

`eslint.config.mjs` ships a custom flat-config rule `local/no-domain-drift`, committed **commented
out** with a `TODO(EX-548)` marker; re-enabling it is the slice's definition of done. Running it
read-only against HEAD is the only reliable inventory tool, because it scopes matches to `Identifier`
AST nodes and therefore ignores Polish UI strings, JSX text, comments and test titles — all of which
are correct by policy and all of which a grep counts.

Confirmed by measurement: tokenizing every tracked `src/**/*.{ts,tsx}` + `e2e/**/*.ts` with comments
and string/template literals stripped yields **6,059 code identifiers**, versus 13,117 tokens in full
text. Representative non-code hits: `Netto`/`Brutto` at
`src/components/kosztorys/summary/grid/summary-money-headers.tsx:11,14`; `Robocizna` at
`src/components/kosztorys/summary/tabs/summary-stages-tab.tsx:47`; `Etap` at
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:156`; `Zaliczki` at
`src/components/kosztorys/summary/blocks/subcontractor-summary.tsx:202`.

**Measure stem coverage on Identifier nodes, never on grep output** — the methodological lesson of
this pass, and one that belongs in `lessons.md`.

#### Nine stems already in the guard — 31 identifiers, 337 occurrences, 47 files

`rabatClientNet` 47, `rabat` 38, `totalRabat` 31, `wplatyNet` 31, `rabatAmount` 27,
`investmentRabat` 19, `sumaPracPreRabat` 15, `executedWorkNetPreRabat` 12, `bilans` 12,
`robocizna` 11, `applyPercentRabatSchema` 10, `globalRabatNet` 10, `marza` 10, `wplaty` 9,
`applyPercentRabatToAllItemsAction` 7, `handleApplyPercentRabat` 6, `rabatMismatch` 4, `maxEtap` 4,
then the 3-and-under tail (`listingBilans` / `listingMarza` / `detailBilans` / `detailMarza`,
`postRabatNet`, `rabatNet`, `PercentRabatTool`, `itemRabatNet`, `createItemWithRabat`, `itemRabat`,
`showRabat`, `wyplaty`, `etapFirst`).

#### Extended stems NOT in the guard — 22 identifiers

`sumaPracNet` 54, `materialy` 29, `MaterialyBreakdownRowT` 22, `doZaplaty` 19,
`materialyBreakdown` 19, `buildMaterialyBreakdown` 17, `computeDoZaplatyRM` 13, `doZaplatyGross` 7,
`nettoShown` 7, `materialyPair` 6, `sumaPrac` 6, `nettoDoc` 4, `sumaPracMismatch` 4, `wykonaneNet` 4,
`przedmiar` 3, `BruttoNettoSummary` 3, `noBrutto` 3, `isBruttoMaterial` 3, `headerMarkPrzedmiar` 3,
`pomiar` 3, `headerMarkPomiar` 2, `wykonane` 1.

#### A third family no stem list covers — 8 identifiers

`doRozliczeniaNet` (`src/lib/kosztorys/summary-economics.ts:154`), `resztaGross` (`:156`),
`WydatkiDatasetT` (`src/lib/kosztorys/wydatki-datasets.ts:4`), `WydatkiPartitionT` (`:6`),
`partitionWydatkiRows` (`:16`), `availableWydatkiDatasets` (`:39`), `wydatkiRowHref` (`:51`),
`wydatkiInwestycyjne` (`src/scripts/audit-investment-parity.ts:42`, script-only).

#### One fixture boundary

`totalRabat` appears **100×** in `src/__tests__/fixtures/financial-golden-master.json`. The rename
requires regenerating that fixture (`pnpm test:parity` is the gate) — mechanical, but it must be one
atomic commit with the type change.

### 2. Classification at HEAD (A / B1 / B2 / gray)

**Cat A holds for exactly three things** — `przedmiar`, `pomiar`, and the two sheet column-index keys
`headerMarkPrzedmiar` / `headerMarkPomiar` (`src/scripts/seed-investment-from-sheet.ts:56,57`).

Both nouns now exist as identifiers, which the prior research denied: `przedmiar` at
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:306` (a local column-group array), as
a `SectionPieBaseT` union member (`src/lib/kosztorys/chart-slices.ts:46`) and as a
`BASE_DESCRIPTIONS` record key (`src/components/kosztorys/summary/charts/section-share-pie.tsx:22`);
`pomiar` once, at `src/scripts/seed-sync-test-inv67.ts:124`. Rule 1's English-equivalent test still
protects both: `przedmiar` means _quantity-surveyed offered scope_ (English is `quantityTakeoff` /
`billOfQuantities` — a term of art, not a plain swap), and `pomiar z natury` is not even stored in
our model — it **is** `Σ etapów` (`src/lib/kosztorys/settlement.ts:195`; sheet `O = SUM(D:M)`).
Contrast `etap → stage` and `podsumowanie → summary`, which lost their A defense because a clean
English word was already dominant in the code; here the stored per-row field is `plannedQty`, with no
`przedmiar` synonym competing.

**Cat B2 (plane suffix) is exactly four identifiers, and two of them are an atomic swap.** The
reconciliation still compares exactly two figures — `src/lib/kosztorys/reconciliation.ts:73-74`,
`KosztorysReconciliationT = { laborCosts, rabat }` (`:16-19`):

| now                                                                                          | target                        | note                                                                     |
| -------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| `sumaPracNet` (`src/lib/kosztorys/settlement.ts:54`, produced `:102`)                        | `laborCostsNetFromKosztorys`  | the actual recon operand — **but the target name is currently occupied** |
| `laborCostsNetFromKosztorys` (`src/components/kosztorys/editor/use-kosztorys-editor.ts:408`) | `laborCostsNetAfterDiscount`  | post-rabat, never reaches the recon — wears the pair's name wrongly      |
| `rabatClientNet` (`src/lib/kosztorys/settlement.ts:58`, produced `:103`)                     | `discountNetFromKosztorys`    | target free (0 hits)                                                     |
| `investmentRabat` (`src/lib/kosztorys/reconciliation.ts:29`)                                 | `discountNetFromTransactions` | target free                                                              |

The first two must move in **one commit** — any intermediate state either shadows or mis-labels the
recon operand. This is decisions.md Q1, still correct at HEAD.

**Everything else is B1 or gray.** The B1 set splits usefully by cost:

- **Free (tests/scripts only)** — `listingBilans` / `listingMarza` / `detailBilans` / `detailMarza`
  (`src/__tests__/investment-render-parity-db.test.ts:86-92`), `postRabatNet`, `rabatNet`,
  `createItemWithRabat`, `itemRabat`, `nettoDoc`; `marza`, `wyplaty`, `wydatkiInwestycyjne`
  (`src/scripts/audit-investment-parity.ts:40,42,43`), `maxEtap`, `etapFirst`, `pomiar`.
- **Near-free (one prod site)** — `bilans` (only prod site
  `src/components/transfers/print-button.tsx:35`). `executedWorkNetPreRabat`
  (`src/lib/kosztorys/settlement.ts:118`) is **prod-dead — all nine call sites are tests**, so it is
  a dead-export deletion candidate rather than a rename target.
- **Mechanical, target verified free** — `MaterialyBreakdownRowT` → `MaterialsBreakdownRowT`,
  `buildMaterialyBreakdown` → `buildMaterialsBreakdown`, `materialyBreakdown` →
  `materialsBreakdown`, `totalRabat` → `totalDiscount`, `wplatyNet` → `depositsNet`,
  `computeDoZaplatyRM` → `computeAmountDueLaborAndMaterials` (Q3, unchanged), the
  `applyPercentRabat*` / `PercentRabatTool` family, `globalRabatNet`, `itemRabatNet`, `nettoShown`,
  `noBrutto`, `isBruttoMaterial`, `BruttoNettoSummary`, `wykonaneNet`, `showRabat`, `rabatMismatch`,
  `sumaPracMismatch`.
- **Blocked by a name collision** — `materialyPair` cannot become `materialsPair`
  (`src/lib/kosztorys/summary-economics.ts:54` is a _different_ function, taking `MaterialsT`); it
  needs a third name. Bare `materialy` cannot become `materials` at any of its three prod sites
  (`summary-economics.ts:107,139,179`), because each sits inside a function already binding
  `materials: MaterialsT`.
- **Half-renamed seams inside one file** — `isBruttoMaterial` sits one line above `isNetMaterial`
  (`src/lib/db/investment-financials.ts:70-71`); `globalRabatNet` is produced by
  `globalDiscountAmount` (`src/lib/kosztorys/calc.ts:174`);
  `src/components/kosztorys/summary/tables/materials-breakdown-table.tsx` is English-named while
  importing `MaterialyBreakdownRowT`.

### 3. Four labor-ish net figures are really two numbers

Let `doneNet` = Σ section `net` (post-rabat), `itemRabatNet` = Σ section `discount`,
`globalRabatNet` = `globalDiscountAmount(doneNet, …)`.

1. `sumaPracNet` = `doneNet + itemRabatNet` — `src/lib/kosztorys/settlement.ts:102`. Pre-rabat
   executed value at client prices. **The recon operand.**
2. `laborCostsNetFromKosztorys` = `doneNet − globalRabatNet` —
   `src/components/kosztorys/editor/use-kosztorys-editor.ts:408`. Post-rabat, a genuinely different
   number. Feeds `computeSummarySplit` / `computeDoZaplatyRM` / `computeMixedSettlement`. Never the
   recon.
3. `sumaPracPreRabat(laborCostsNetFromKosztorys, rabatAmount)` —
   `src/lib/kosztorys/summary-economics.ts:124-126`. Substituting:
   `(doneNet − globalRabatNet) + (globalRabatNet + itemRabatNet)` = `doneNet + itemRabatNet` =
   **exactly `sumaPracNet`**. The repo's own test asserts the identity
   (`src/__tests__/lib/kosztorys/summary-economics.test.ts:380-383`). One concept, two names, plus a
   redundant recomputation — a **rule-4 violation and a delete candidate, not a rename target**.
4. `executedWorkNetPreRabat(subtotals)` = `Σ(net + discount)` —
   `src/lib/kosztorys/settlement.ts:118-120`. Same construction as #1, view-generalized, prod-dead.

### 4. Cross-plane traps

- **T1 — a kosztorys value inside a transactions-named field.**
  `src/lib/kosztorys/kosztorys-driven-financials.ts:19` returns
  `{ ...financials, totalLaborCosts: sumaPracNet, totalRabat: rabatClientNet }`, read plane-blind by
  `src/lib/db/calculate-margin.ts:14` and `src/lib/db/calculate-balance.ts:7-8`. This **falsifies the
  glossary's "`totalLaborCosts` stays bare" exemption at that call site** — the field is bare, but
  its value is plane-specific.
- **T3 — an unguarded third cross-plane seam.** `src/lib/kosztorys/subcontractor-summary.ts:35`
  computes `remaining = dueNet − payoutsTotal`, both names bare and neither in the plane table.
  Needs an owner ruling: one concept on two planes (→ suffix) or two distinct concepts (→ stay bare).
- **T4 — `wplatyNet` already holds two different values.**
  `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:81` = Σ `INVESTOR_DEPOSIT` rows only (the
  comment at `:78-80` says so), while `src/lib/queries/client-kosztorys.ts:66` =
  `financials.totalIncome` = `sumBucket(rows, 'income')`, which includes `COMPANY_FUNDING` /
  `OTHER_DEPOSIT`. The owner editor and the client share link therefore compute „Wpłaty" and
  „Do zapłaty" from different bases. **This is a bug, not a naming problem** — it wants its own Linear
  issue and a test, independent of the rename.
- **T5 — "plane" means three unrelated things** in this codebase: the recon plane
  (kosztorys/transactions), `ToolPlaneT` (`w_tools` / `own_tools`), and the VAT plane
  (`NET` / `GROSS`). A mechanical grep for `plane` mostly hits the wrong two.
- **T6 — one-plane figures must stay bare** (`depositsByStage`; aggregates at their own source such
  as `totalLaborCosts`). Hanging the suffix on everything destroys its warning value.

### 5. Boundary crossings — what is frozen

| kind                                                                                                      | verdict                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB columns / Payload field names                                                                          | **no drift identifier is one** — 0 hits across `src/collections/*.ts` and quoted identifiers in `src/migrations/*.ts`                                                                                                                       |
| persisted jsonb (`kosztorys_snapshots.payload`, `kosztorys_presets.payload`)                              | already fully English — `src/lib/kosztorys/snapshot-format.ts:37-44`, `src/lib/kosztorys/types.ts:25-51`                                                                                                                                    |
| DB enum **values** (`'RABAT'`, `'LOSS'`, `'LABOR_COST'`, `'NET'`/`'GROSS'`, `'w_tools'`/`'own_tools'`, …) | **frozen** — `src/migrations/20260611_add_rabat_enum.ts:7`, `src/lib/constants/transfers.ts:325`                                                                                                                                            |
| Sheets label strings — `TRANSFER_TYPE_LABELS.RABAT = 'Rabat'`, `.LOSS = 'Strata'`                         | identifiers renameable, **strings frozen**: they are both the `typ` column value written into every client sheet (`src/lib/google/tab-rows.ts:104`) and the SUMIF criterion (`src/lib/google/sheet-summary.ts:42`)                          |
| `TRANSFERS_SUMMARY_TYPES` order, `CORRECTION_MOVED_LABEL`                                                 | **frozen** — column order / slots (`src/lib/constants/transfers.ts:315,317-330`)                                                                                                                                                            |
| `RABAT_LABEL` / `LABOR_LABEL` / `INCOME_LABEL`                                                            | identifiers renameable, **string values coupled** — the investment header matches tiles by label text (`src/lib/db/map-category-costs.ts:17-19` ↔ `src/components/investments/financial-stats.tsx:80,88,91`)                                |
| sheet column indices (`headerMarkPrzedmiar: 13`, `headerMarkPomiar: 14`, `etapFirst: 3`)                  | keys renameable, **values frozen** — `src/scripts/seed-investment-from-sheet.ts:52-60`                                                                                                                                                      |
| localStorage                                                                                              | keys all sanctioned (`table-columns:kosztorys-*`); one **value** matters — `'brutto'` in `MaterialsNetPricingT` (`src/components/kosztorys/summary/hooks/use-materials-net-pricing.ts:9-10`); changing it soft-resets user prefs to `'net'` |
| cache tags, query params, cookies                                                                         | **no drift** — `src/lib/cache/tags.ts:1-17`                                                                                                                                                                                                 |
| Polish route segments (`kosztorys_v2`, `/inwestycje`, `/kasa`, `/podglad-klienta`, `/k/[token]`)          | **policy — the rename must not propagate to URLs**                                                                                                                                                                                          |
| Vitest snapshot key `setupMaterialyTab`                                                                   | renameable; obsoletes 2 snapshots (`src/__tests__/lib/google/__snapshots__/sheets-golden.test.ts.snap:179,779`) — needs `vitest -u`                                                                                                         |
| server-action ids (`applyPercentRabatToAllItemsAction`, …)                                                | safe — ids are per-build; only a client on a stale bundle fails transiently mid-deploy                                                                                                                                                      |
| `_payload_migrations` row `20260611_add_rabat_enum`                                                       | **frozen** (`src/migrations/index.ts:37,246-248`)                                                                                                                                                                                           |

Adjacent and worth folding in: the sheet-write key `typ` (`src/lib/google/sheet-configs.ts:40,69`;
producers `src/lib/google/tab-rows.ts:49,80,104`). The key name is internal — column letters derive
from key _order_ (`sheet-configs.ts:99-101`) — so `typ` → `type` is safe **if atomic** across config
and producers.

### 6. Tooling readiness

**Present:** `ast-grep` / `sg` v0.44.1 on PATH (satisfies the plan's read-and-verify-only leg);
`pnpm typecheck` = `tsc --noEmit`, **green at HEAD**, and `tsconfig.json:26-32` includes `src/`,
`e2e/` and `scripts/`, so one command is a repo-wide gate; `.husky/pre-commit` runs `eslint --fix` on
staged files (**this is where a re-enabled guard actually bites**); `.husky/pre-push` runs typecheck +
vitest + `test:integration` + `test:parity`.

**Missing — each one a plan line item:**

- **`ts-morph` is not installed** (neither deps nor devDeps). Gate #2 wants a type-aware codemod, so
  this is a new devDep — or the rename runs through tsserver rename (IDE F2), type-aware by
  construction and needing no dependency at all.
- `jscodeshift` is absent and should stay absent — not type-aware, so it fails Gate #2.
- No `sgconfig.yml`; ast-grep rules must be passed inline (`sg -p '…' -l ts`).
- **`pnpm lint` is not in `.husky/pre-push`** — only the pre-commit staged-file pass. A batch landed
  via `--no-verify` or an amend never sees the drift rule. If the guard is meant to be a hard gate,
  add it.
- **The commented rule's `files: ['src/**/\*.{ts,tsx}']`** (`eslint.config.mjs:144`) **excludes `e2e/`,
where there is live drift** — `sumaPracNet`at`e2e/kosztorys-reconciliation.spec.ts:15,98,104`.

### 7. The guard's stem list must change before it is enabled

Proposed additions, each **false-positive-checked against all 6,059 code identifiers — 0 English
collisions**:

```js
[/^sumaPrac|SumaPrac/,  'sumaPrac* → laborCostsNet* (pre-discount)'],
[/^doZaplaty|DoZaplaty/,'doZaplaty* → amountDue*'],
[/^materialy|Materialy/,'materialy* → materials* (Materiały stays in UI labels)'],
[/^wykonan|Wykonan/,    'wykonane* → executed*'],
[/^netto|Netto/,        'netto* → net* (the `net`/`Net` suffix is the English form and is fine)'],
[/^brutto|Brutto/,      'brutto* → gross*'],
[/^wydatki|Wydatki/,    'wydatki* → expenses*'],
[/^reszta|Reszta/,      'reszta* → remainder* / outstanding*'],
[/^doRozliczenia|DoRozliczenia/, 'doRozliczenia* → toSettle*'],
```

Notes that matter:

- `^netto|Netto` correctly does **not** match `net` / `Net` / `netAmount` / `toNet` / `plannedNet` —
  the stem requires the `-tto`.
- Keep the two literal casings and **never the `i` flag**: `/materialy/i` would catch camelCase names
  like `materialYield`.
- **Reject `/^suma|Suma/`** — it buys nothing over `^sumaPrac`, and bare `suma`/`Suma` in this repo
  are only Polish _string_ content (`src/components/kosztorys/summary/charts/slice-pie.tsx:44`). It
  does not hit `summary` (the doubled `m` blocks it), but it would fire on a future legitimate
  `sumaOf`-style token.
- `przedmiar` / `pomiar` are Cat A, so stems for them would need per-site `eslint-disable` comments.
  Decide deliberately — a stem for a Cat-A noun is a guard against yourself, not against drift.
- Two listed stems match **zero** code identifiers at HEAD (`strata|Straty`, `zaliczk`) — pure
  regression guards, correctly kept.

**The structural blind spot: `Identifier`-scoped visiting cannot see Polish string-literal type
members.** Two live cases:

- `src/lib/kosztorys/chart-slices.ts:46` — `export type SectionPieBaseT = 'przedmiar' | 'wykonane'`
- `src/components/kosztorys/summary/hooks/use-summary-view.ts:9` —
  `export type SummaryViewT = 'summary' | 'wydatki' | 'wplaty' | 'etapy' | 'podwykonawcy'`

Neither is persisted (both are `useState` + React keys), so both are safe to rename — but the guard
will never flag them or their successors. Closing this needs a second visitor (`TSLiteralType` /
`Literal` inside `TSUnionType`), a small addition worth making while the rule is being edited anyway.

### 8. Out of scope, but it blocks the guard: the `saldo*` family

**16 distinct identifiers, ~155 occurrences, 20 files**, entirely on the registers/transfers plane:
`saldo` 64, `SaldoDisplay` 16, `Saldo` 12, `isSaldoLoading` 12, `fetchSaldo` 11, `resetSaldo` 7,
`useSaldo` 5, `SaldoSummary` 5, `setSaldo` 4, `saldoColor` 4, `getRegisterSaldo` 4, `totalSaldo` 3,
`setIsSaldoLoading` 3, `SaldoSummaryPropsT` 2, `SaldoDisplayPropsT` 2, `fetchWorkerSaldos` 1
(`src/components/forms/hooks/use-saldo.ts`, `src/components/forms/form-components/saldo-summary.tsx`,
`src/app/(frontend)/kasa/[id]/page.tsx`, and 17 more).

Larger than the entire kosztorys drift set, and this change explicitly scopes itself to the
kosztorys/terminology surface. **Adding a `saldo` stem turns 20 unrelated files red**, so the owner
must choose: (a) add the stem and expand this change, (b) add the stem and file the `saldo` rename as
its own slice, executed before the guard is enabled, or (c) leave the stem out and accept that
`saldo` drift is unguarded. Not deciding is the one option that fails — the guard cannot be enabled
without an answer.

### 9. Artifact staleness

**`context/domain/02-glossary.md`** — many rows are FALSE on location or drift status:

- `transfer-rules.ts` was deleted by `a510c208`; `DEPOSIT_TYPES` now lives at
  `src/lib/constants/transfers.ts:263`; `kosztorys-summary.tsx` no longer exists.
- Several **false "clean" drift cells** — e.g. the `laborCosts` row claims resolved, but `robocizna`
  is a live `MixedSettlementT` key at `src/lib/kosztorys/summary-economics.ts:149`.
- The `przedmiar` / `pomiar` rows are FALSE: canonical is `plannedQty`
  (`src/collections/kosztorys-items.ts:38`) and `stageQtySum` / `rowTotalQtyDone`
  (`src/lib/kosztorys/settlement.ts:181`); no `pomiar` identifier exists in `src/lib` at all.
- Wrong canonical names: `unitPrice` is really `clientPrice`; `netValue` is really `rowValueForView`;
  "cash settlement" is really `computeMixedSettlement` / `MixedSettlementT` (whose fields
  `robocizna` / `materialy` / `doRozliczeniaNet` / `resztaGross` / `doZaplatyGross` are five drift
  identifiers the glossary never lists); "deposits split" is really `bucketDepositsByPlane` /
  `DepositPlaneSumsT`.
- TRUE rows: the whole `zaliczki` retirement (all four sub-claims), and `stage` — except `'etapy'`
  survives in `SummaryViewT` (`src/components/kosztorys/summary/hooks/use-summary-view.ts:9`, whose
  five members are all Polish).
- **None of the three decisions.md rulings, and none of the four owed corrections, have landed.**
- **18 concepts are missing entirely** — netto expense type, the wydatki tab partition
  (`WydatkiDatasetT`), invoice/invoiceNote, the etap tool plane, subcontractor settlement, section
  header rows, the percent-rabat tool, mixed settlement, the money axis, the summary view switch, the
  section-share pie base, the kosztorys-shares collection, materials-net pricing, the v1/v2
  financials toggle, and more.

**`context/domain/01-domain-distillation.md`** — **regenerate from scratch, do not patch.** Roughly
25 of its ~35 `file:line` citations are stale or point at deleted code. Its #1 finding is still TRUE
at HEAD and should survive regeneration: the ≥1-item floor in `src/lib/kosztorys/delete-policy.ts:45`
is client-only, while `removeItemAction` (`src/lib/actions/kosztorys.ts:447`) and `removeSectionAction`
(`:243`) are unguarded.

**EX-548's own description is stale** — it cites a 27-symbol count (real: ≈61), a Cat-A list that no
longer matches the rules, a worked example in `zaliczki.ts` (deleted), and
`context/domain/03-drift-rename-worksheet.md`, which **has never existed in any branch**
(`git log --all` on that path is empty; it is absent from `wip-ex548-terminology` too, whose docs were
already recovered onto `staging` by `d72d91b4`). The issue has been `In Progress` since 2026-07-20.

## Code References

- `eslint.config.mjs:140-148` — the commented `local/no-domain-drift` config block; `files` excludes `e2e/`
- `src/lib/kosztorys/reconciliation.ts:16-19,29,73-74` — the recon type and its two comparisons
- `src/lib/kosztorys/settlement.ts:54-63,98-104,118-120,181,195` — kosztorys totals, `sumaPracNet`, the prod-dead `executedWorkNetPreRabat`, pomiar-as-Σetapów
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:408` — post-rabat figure wearing the recon pair's name
- `src/lib/kosztorys/summary-economics.ts:33,54,107,124-126,139,149-159,179` — `materialyPair` vs `materialsPair`, the `sumaPracPreRabat` duplicate, `MixedSettlementT`'s five Polish keys
- `src/lib/kosztorys/kosztorys-driven-financials.ts:19` — T1, kosztorys values in transactions-named fields
- `src/lib/db/calculate-margin.ts:14`, `src/lib/db/calculate-balance.ts:7-8` — the plane-blind consumers
- `src/lib/kosztorys/subcontractor-summary.ts:35` — T3, the unguarded third seam
- `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:78-81` vs `src/lib/queries/client-kosztorys.ts:66` — T4, `wplatyNet`'s two definitions
- `src/lib/kosztorys/chart-slices.ts:46,73,75-76` and `src/components/kosztorys/summary/hooks/use-summary-view.ts:9` — Polish string-literal unions the guard cannot see
- `src/lib/kosztorys/wydatki-datasets.ts:4,6,16,39,51` — the unstemmed `Wydatki*` family
- `src/lib/constants/transfers.ts:147,158,315,317-330` — frozen sheet strings and column order
- `src/lib/db/map-category-costs.ts:17-19,39` — label-string coupling and `buildMaterialyBreakdown`
- `src/lib/db/investment-financials.ts:70-76,86` — `isBruttoMaterial` beside `isNetMaterial`
- `src/lib/kosztorys/delete-policy.ts:45`, `src/lib/actions/kosztorys.ts:243,447` — the distillation's #1 finding, still true
- `src/__tests__/fixtures/financial-golden-master.json` — 100 `totalRabat` occurrences
- `src/__tests__/lib/kosztorys/summary-economics.test.ts:380-383` — the test proving `sumaPracPreRabat ≡ sumaPracNet`
- `e2e/kosztorys-reconciliation.spec.ts:15,98,104` — drift outside the guard's `files` glob

## Architecture Insights

- **The AST rule is the inventory tool, not just the gate.** Its `Identifier` scoping is what makes
  the Polish-UI / English-code policy machine-checkable at all. Any future audit of this kind should
  start by running the guard read-only rather than by grepping.
- **The rename is safe precisely because the persistence layer was built English-first.** Payload
  field names, migrations and both jsonb payloads carry no Polish. Drift lives entirely in derived
  view/compute shapes — which is why a type-aware rename plus `tsc` is a sufficient gate.
- **Drift concentrates where two figures meet.** Every gray case in this pass (`sumaPracPreRabat`,
  `rabatAmount`, `wplatyNet`, `remaining`) is a place where one number is reachable by two routes. The
  naming problem is a symptom; rule 4 ("one concept, one name") is really a design constraint on the
  compute layer.
- **A stem list is a policy statement.** Adding `przedmiar` or `saldo` is not a mechanical
  completeness move — it decides whether a Cat-A noun is allowed and whether a neighbouring plane is
  in scope. Review the list as spec, don't append to it as cleanup.

## Historical Context (from prior changes)

- `context/changes/kosztorys-terminology/change.md` — the three non-negotiable gates (code-grounded
  research first; type-aware, `tsc`-gated codemod with ast-grep read/verify only; regenerate the
  distillation from scratch). Invariants / aggregate / ACL are explicitly separate later slices.
- `context/changes/kosztorys-terminology/decisions.md` — Q1 and Q3 verified still correct; **Q2's
  premise no longer exists at HEAD** (Summary, finding 5).
- `context/changes/kosztorys-terminology/research.md` @ `2562a2e1` (2026-07-20) — superseded by this
  document; its "≈35 identifiers" estimate, its claim that `przedmiar` / `pomiar` are not
  identifiers, and its `rabatAmount` formula are all wrong at HEAD.
- `context/foundation/lessons.md` (last entry) — enforce one-concept-one-name with an AST rule, not
  grep; ship the guard dormant until the renames land; **renames first, then enable — never the
  reverse.** This pass confirms all three and adds a fourth: measure stem coverage on Identifier
  nodes, and keep the stem list itself under review.

## Related Research

- `context/changes/kosztorys-terminology/frame.md` — the four risk dimensions this pass answers
  (inventory completeness → §1; A/B category correctness → §2; plane collisions → §4; model staleness
  → §9).

## Open Questions

> **Resolved 2026-07-26** — items 1-5 below were ruled on by the owner; the rulings live in
> `decisions.md` (Q4-Q8) and supersede the framing here. Item 6 (T3) is the only one still open.
> Items 7-10 are unchanged and still owed.
>
> - 1 → **delete** `sumaPracPreRabat`, don't rename (Q4)
> - 2 → **collapse** `rabatAmount` onto `discountNetFromKosztorys`; decisions.md Q2 superseded (Q5)
> - 3 → **`balance`**, accept the overload (Q6)
> - 4 → **keep both members Polish**, under a new narrow "Cat A by association" exemption (Q7)
> - 5 → **fold `saldo` into this change** and add the stem now — the size argument below did not
>   survive contact with the code: the SQL already aliases `AS balance`
>   (`sum-transfers.ts:57,83,91,100,123`) and `register-saldo.ts` renames it back to `saldo`, so it
>   is a half-renamed seam, not a decision (Q8)
> - 6 → still open; the recommendation is **stay bare**

Owner rulings needed before the codemod runs:

1. **`sumaPracPreRabat` — rename or delete?** Provably identical to `sumaPracNet`
   (`summary-economics.ts:124-126`, proven by `summary-economics.test.ts:380-383`). Deleting it and
   threading the real figure into `brutto-netto-summary.tsx:102`, `mixed-summary.tsx:60` and
   `summary-overview-tab.tsx:103` removes a figure from the domain, but changes the prop set of three
   components — behavior-shaped, so not a codemod's call.
2. **`rabatAmount` — is decisions.md Q2 superseded?** At HEAD it is the same value as
   `rabatClientNet`, with one producer (`kosztorys-editor-body.tsx:299`). Rule 4 says collapse the two
   onto `discountNetFromKosztorys`; coining `effectiveDiscountNet` would preserve a duplicate. Note
   `discountAmount` is _still_ unavailable as a target — it is now a per-row grid column id
   (`src/lib/kosztorys/column-config.ts:25-26`), a different occupant than the Q2 ruling assumed.
3. **`bilans` → `balance`, given `balance` already means cash-register / worker balance**
   (`src/components/tables/cash-registers.tsx:12`, `src/components/tables/users.tsx:16`, a DB column
   in `src/migrations/20260211_212425.ts:10`)? Accept the overload (`calculateBalance` already returns
   bilans inwestora, so there is precedent) or use `investorBalance`. One prod site, so either is
   cheap.
4. **`SectionPieBaseT = 'przedmiar' | 'wykonane'`** — rule 1 keeps `'przedmiar'` (A) and sends
   `'wykonane'` → `'executed'` (B1), producing a mixed-language union in one type. Accept the mix, or
   leave both Polish as a matched pair of sheet-base labels?
5. **The `saldo` scope question** (§8) — expand this change, file a separate slice, or leave the stem
   out of the guard?
6. **T3 (`subcontractor-summary.ts:35`)** — is `remaining` / `dueNet` one concept on two planes
   (→ plane suffix) or two distinct concepts (→ stay bare)?

Independent of the rename, each owed a Linear issue:

7. **`wplatyNet` has two producers with two different definitions** (T4) — the owner editor and the
   client share link compute „Wpłaty" / „Do zapłaty" from different bases. A correctness bug with no
   test.
8. **`removeItemAction` / `removeSectionAction` bypass the ≥1-item floor** in `delete-policy.ts:45`
   (the distillation's #1 finding, still true at HEAD).
9. **`executedWorkNetPreRabat` is prod-dead** — delete rather than rename.
10. **EX-548's description and `context/domain/02-glossary.md` both need rewriting** before the
    codemod, since the glossary _is_ the rename spec and ~⅓ of its citations are wrong. The worksheet
    the issue cites (`context/domain/03-drift-rename-worksheet.md`) has never existed — either write
    it or drop the reference.
