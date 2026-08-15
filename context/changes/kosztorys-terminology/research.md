---
date: 2026-08-15T11:30:29+02:00
researcher: ex-Plant
git_commit: 37e27b24dfc595bb4f53cfc57aec3f38e6fa5bfa
branch: staging
repository: wykonczymy
topic: 'EX-548 — Polish→English domain-naming drift: re-inventory at HEAD'
tags: [research, codebase, kosztorys, domain-naming, ex-548, plane-suffix, eslint-guard]
status: complete
last_updated: 2026-08-15
last_updated_by: ex-Plant
supersedes: 'the 2026-07-26 revision of this file (commit a5ef7baf) — deleted, recoverable via git log --follow'
---

# Research: EX-548 domain-naming drift — re-inventory at HEAD

**Date**: 2026-08-15T11:30:29+02:00
**Researcher**: ex-Plant
**Git Commit**: `37e27b24`
**Branch**: `staging`
**Repository**: wykonczymy

## Research Question

The prior inventory was taken on 2026-07-26 at `a5ef7baf`. ~490 commits have landed since (whole
subsystems added: `sheet-import/`, the settlement split, `summary-reading.ts`,
`kosztorys-client-totals.ts`). Which of its findings still hold, what is the drift surface at HEAD,
and what must the rename plan actually cover?

## Summary

**The rename got bigger mechanically and smaller conceptually.** The drift surface is now
**84 distinct identifiers / 1204 occurrences / 103 files** (excluding the sanctioned `kosztorys`
noun), up from ≈61 identifiers at the prior pass. But only **~22 names were newly minted**; the rest
is the _same_ family relocated — roughly 80% of the non-sanctioned drift tokens now live in files
that did not exist at `a5ef7baf`. The prior pass's central prediction held: every week of delay
re-types the same drift into more files.

Four things changed the plan's shape:

1. **The one-commit hazard is gone.** EX-555 (`f72c68a1`) renamed `laborCostsNetFromKosztorys` →
   bare `laborCostsNet`, so the target name is unoccupied. Q1's two-step swap is now two independent
   one-step renames.
2. **A new plane collision appeared, at the type level.** `SummaryReadingT`
   (`src/lib/kosztorys/summary-reading.ts:14-17`) carries `laborCostsNet` + `rabatAmount` for
   _either_ plane depending on which constructor built it. This **invalidates ruling Q5**.
3. **Trap T4 fixed itself** — `wplatyNet` was deleted rather than disambiguated
   (`context/archive/2026-08-12-wplaty-jedno-zrodlo/`). Trap T1 survived its file's deletion and now
   lives at `summary-reading.ts:51-59`.
4. **Blast radius is still zero for the rename** — but two new _frozen_ surfaces appeared that the
   plan must route around: the `sheet_column_mapping` jsonb keys and the pre-existing `'RABAT'`
   Postgres enum value.

Every artifact we would have planned from is stale, including `change.md`'s own gate 3.

## Detailed Findings

### 1. The measurement instrument

Measured with the dormant `local/no-domain-drift` rule resurrected read-only in a scratchpad config,
widened to 26 stems and to `e2e/`. **Identifier AST nodes only, never grep** — ~30% of Polish text
hits are UI strings, JSX copy and comments that are correct by policy.

```
TOTAL           2396 occ | 170 distinct identifiers | 219 files   (all 26 stems)
non-kosztorys   1204 occ |  84 distinct identifiers | 103 files   (the actual drift surface)
```

By stem (ids / occ), drift only:

| stem      | ids | occ |     | stem                                                                | ids    | occ  |
| --------- | --- | --- | --- | ------------------------------------------------------------------- | ------ | ---- |
| rabat     | 22  | 326 |     | doZaplaty                                                           | 4      | 70   |
| saldo     | 16  | 144 |     | sumaPrac                                                            | 3      | 90   |
| robocizn  | 11  | 191 |     | etap                                                                | 3      | 160  |
| wydatki   | 6   | 56  |     | bilans / wplat / przedmiar / pomiar                                 | 2 each | 4–11 |
| materialy | 4   | 86  |     | netto / doRozliczenia / reszta / lacznie / marza / wykonan / brutto | 1 each | 3–17 |

`kosztorys` (86 ids / 1192 occ) is the sanctioned Cat-A entity noun — counted for completeness,
never drift. `etap`'s 160 occurrences are almost entirely one test-fixture identifier (`etapQty`,
`src/__tests__/fixtures/kosztorys-sheet/header-blocks.ts:9`, 154 sites).

**Zero hits — pure regression stems:** `zaliczk`, `strata`, `wyplat`. They fire on nothing today and
exist only to prevent reintroduction. (`wplat` is _not_ zero: 2 ids / 5 sites.)

### 2. Category B2 — the plane collisions

The recon compares exactly two figures (`src/lib/kosztorys/reconciliation.ts:120-121`):

| identifier                      | def site                                                            | → proposed                    |
| ------------------------------- | ------------------------------------------------------------------- | ----------------------------- |
| `sumaPracNet`                   | `src/lib/kosztorys/settlement-client-totals.ts:18` (produced `:66`) | `laborCostsNetFromKosztorys`  |
| `laborCostsNetFromTransactions` | `src/lib/kosztorys/reconciliation.ts:33`                            | _already correct_             |
| `rabatClientNet`                | `src/lib/kosztorys/settlement-client-totals.ts:22` (produced `:67`) | `discountNetFromKosztorys`    |
| `investmentRabat`               | `src/lib/kosztorys/types.ts:164`, input `reconciliation.ts:35`      | `discountNetFromTransactions` |

**Correction to the prior pass:** it asserted "B2 is exactly four identifiers". That was never true —
`laborCostsNetFromTransactions` already existed at `a5ef7baf` (`03a48583`) wearing its correct name;
the table listed only the four needing a _change_. The set is five, one of which is already done.

**The hazard is gone.** `laborCostsNetFromKosztorys` has zero hits at HEAD (EX-555 renamed it to bare
`laborCostsNet`, `src/components/kosztorys/editor/use-kosztorys-editor.ts:538`). The target name is
free, so the `sumaPracNet` and `rabatClientNet` renames are independent.

**New collision, at the type level.** `SummaryReadingT` (`src/lib/kosztorys/summary-reading.ts:14-17`)
is `{ laborCostsNet, rabatAmount }` — and it has **two producers on two planes**:
`readingFromTransactions` (`:20-25`, `financials.totalLaborCosts − totalRabat`) and
`readingFromKosztorys` (`:33-41`, `clientTotals.sumaPracNet − rabatClientNet`). Verified directly:
`rabatAmount` is produced at `summary-reading.ts:23` and `:36-39`, plus the editor prop at
`src/components/kosztorys/editor/kosztorys-editor-body.tsx:333`.

This is a _plane switch expressed as a type_, not a collision between two names. So the suffix rule
does **not** apply here — the correct rename is bare `discountAmount`. **Ruling Q5 is overtaken**: it
collapses `rabatAmount` onto `discountNetFromKosztorys` on the premise of a single producer, which
would mislabel the v1 reading.

### 3. The labor-ish family, re-derived at HEAD

Let `doneNet` = Σ section `net` (post-discount), `itemRabatNet` = Σ section `discount`.

1. **`sumaPracNet` = `doneNet + itemRabatNet`** — `settlement-client-totals.ts:66`. Pre-discount
   executed value at client prices; the recon operand. Now also has a **second implementation in
   SQL** (`src/lib/db/kosztorys-client-totals.ts:86,98`) for the listing fold, pinned by a parity
   spec.
2. **`laborCostsNet` = `doneNet − globalRabatNet`** — `use-kosztorys-editor.ts:538`. Post-discount,
   never the recon. Renamed from `laborCostsNetFromKosztorys`; formula unchanged.
3. **`sumaPracPreRabat(laborCostsNet, rabatAmount)`** — `src/lib/kosztorys/summary-economics.ts:121`.
   Reconstructs #1 from a reading. **Q4's "delete it" ruling is unexecuted and now weaker**: with two
   readings this is the one place that rebuilds the pre-discount figure for _either_ plane
   (consumers: `blocks/settlement-summary.tsx:84`, `tabs/summary-overview-tab.tsx:153` — the ruling's
   named consumers `brutto-netto-summary.tsx` / `mixed-summary.tsx` do not exist).
4. **`executedWorkNetPreRabat`** — `settlement-client-totals.ts:82`. Still zero prod call sites, but
   **promoted in intent**: its docblock declares it the single-plane parity oracle for
   `subcontractorDueByPlane`, and `subcontractor-due-by-plane.test.ts:66,234,251` uses it as one. The
   prior pass's "delete rather than rename" is now wrong — it is a live test oracle.

**Family verdict: same size, shifted meaning.** The real change is one layer up — the plane-selection
wrapper (`summary-reading.ts`) now sits above the family, so figures 2 and 3 belong to whichever
reading built them, not to the kosztorys plane.

### 4. Traps — re-verified

| trap                                                 | verdict at HEAD                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1** kosztorys values in transactions-named fields | **File gone, pattern survives.** `financialsOnReading` (`src/lib/kosztorys/summary-reading.ts:51-59`) writes `totalLaborCosts: reading.laborCostsNet + reading.rabatAmount`, read plane-blind by `calculate-margin.ts:17,19` and `calculate-balance.ts:12,16`. Now the **default** path on the listing (`shape-investments.ts:26-27`) and the v2 panel. |
| **T3 / Q9** `remaining = dueNet − payoutsTotal`      | **Still true**, now rounded — `src/lib/kosztorys/subcontractor-summary.ts:138`. Evidence supports **stay bare** (§5).                                                                                                                                                                                                                                   |
| **T4** `wplatyNet` two definitions                   | **Resolved at source.** Identifier deleted; both surfaces now read via `fetchDepositTransactionsForInvestment` → `getDepositTransactions` with a fixed `type = 'INVESTOR_DEPOSIT'` guard (`src/lib/db/sum-transfers.ts:320`).                                                                                                                           |

### 5. Q9 — recommend closing as "stay bare"

- `dueNet` (`subcontractor-summary.ts:48`) is purely kosztorys-derived (via `subcontractorDueByPlane`'s
  `combined`, `src/lib/kosztorys/subcontractor-due.ts:38`). No transactions-side twin of the amount
  owed to a subcontractor exists or could.
- `payoutsTotal` (`:50`, computed `:89`) is purely transactions-derived. No kosztorys twin.
- `remaining` is a _difference across_ the two planes, not a _comparison of_ one concept measured
  twice. Contrast `reconciliation.ts:120-121`, where `reconcile(expected, actual)` compares one
  figure against its own twin — that is what the suffix warns about.

`dueNetFromKosztorys` would imply a nonexistent `dueNetFromTransactions`. Owner ruling still owed, but
the recommendation is unchanged and now better evidenced.

### 6. Blast radius — still zero for the rename, two new frozen surfaces

Verified across `src/collections/*.ts`, `src/migrations/*.ts`, `snapshot-format.ts`,
`serialize-preset.ts`: **no drift identifier is a DB column, a Payload field, or a persisted-JSON
key.** Every Payload field name is English; every `ADD COLUMN` identifier is English. The only Polish
in the schema is table names (`kosztorys_items`, `kosztoryses`) — the sanctioned noun.

`rabat_client_net` (`src/lib/db/kosztorys-client-totals.ts:87`) is **a SQL alias, not a column** —
confirmed against every quoted identifier in `src/migrations/`. Free to rename with its mapper field.
Same for `suma_prac_net` and `global_rabat_net` (`:86`, `:88`).

Two surfaces the plan must _not_ treat as free:

- **`'RABAT'` on `enum_transactions_type`** (`src/migrations/20260611_add_rabat_enum.ts:7`) — a live
  Postgres enum value, reflected in `src/payload-types.ts` and used as a URL query filter value by
  `src/components/transfers/transfer-filters.tsx`. Every `rabat → discount` rename **stops at the
  enum literal** and its `TRANSFER_TYPES` key (`src/lib/constants/transfers.ts:146`).
  Migration-bearing; schedule separately if ever.
- **`kosztoryses.sheet_column_mapping` jsonb** (migration `20260814_0_…`, field
  `src/collections/sheets.ts:70`) — its **keys are persisted** and are `ColumnFieldT` members
  (`src/lib/kosztorys/sheet-import/columns.ts:36-43`). All English already, but renaming any of them
  is now a data migration rather than code motion. New frozen surface since the prior pass.

### 7. Where the new drift came from

**`sheet-import/` is the one subsystem that minted a fresh drift family** rather than inheriting one
— eleven `Robocizna` identifiers, five of them banned hybrids (rule 3):

`parseRobocizna` (`parse-robocizna.ts:82`), `ParsedRobociznaT` (`:25`), `resolveRobocizna`
(`resolve-columns.ts:179`), `ResolvedRobociznaT` (`:53`), `RobociznaFailureT` (`:51`),
`resolvedRobocizna` (`build-import-plan.ts:98`), `MissingRobociznaTabError` (`read-sheet.ts:46`),
`ImportGridsT.robocizna` (`:30`), `robociznaGid` (`:33`), `robociznaFormulas` (`:35`),
`robociznaTitle` (`:73`).

The rest of that module is exemplary English (`ColumnFieldT`, `resolve-columns`, `footer-totals`,
`formula-health`), which makes this look like **one unchallenged early naming decision propagating
through eight files**, not a systemic lapse. Nothing in it is persisted → cheapest high-value fix in
the whole change.

The other new-file drift is _relocation_: `sumaPracNet` / `rabatClientNet` / `doZaplaty*` /
`materialyBreakdown` carried wholesale into `settlement-client-totals.ts`, `summary-reading.ts`,
`settlement-groups.ts`, `whole-investment-financials.ts`, `investment-summary-panel.tsx`,
`investment-transactions.ts` — all new files.

Also new: three Polish-hybrid plural helpers — `praceNoun` / `sekcjeNoun`
(`src/components/kosztorys/editor/dialogs/preset-picker-groups.ts:4-5`) and `wplatyNoun`
(`src/components/kosztorys/summary/settlement-plane-warning.tsx:10`). Their **string payloads are
correct Polish UI copy**; only the identifiers are hybrids. `sheet-report-words.ts` (also new)
already does this right (`itemNoun`, `rateNoun`, `columnNoun`) — converge on it.

### 8. Same name, two different things (bugs, not drift)

- **`robocizna`** — a money figure (`summary-economics.ts:155`, `MixedSettlementT.robocizna: number`,
  **post**-discount) vs a raw cell grid (`sheet-import/read-sheet.ts:30`, `ImportGridsT.robocizna:
unknown[][]`) vs a **pre**-discount total (`chart-slices.ts:74` parameter). Same word, two discount
  axes, one screen.
- **`rabat`** — four distinct types: a recon verdict object (`reconciliation.ts:24`), an
  already-**negated** `MoneyPairT` (`tables/summary-breakdown-table.tsx:31`), a **fraction**
  (`sheet-import/parse-robocizna.ts:136`), a **column index** (`seed-investment-from-sheet.ts:60`).
- **Rename hazard, not a current bug:** `saldo` (cash-register balance, `use-saldo.ts:6`) and `bilans`
  (what the client owes, `calculate-balance.ts`) **both translate to `balance`**. A blind rename
  creates in English exactly the rule-4 violation we are removing. Keep them apart —
  `registerBalance*` for the hook family, `balance` reserved for the investment figure.
- `MaterialyBreakdownRowT.net` (`src/types/investment-financials.ts:59`) holds **brutto** on a `gross`
  row — an English name already lying about its plane. Worth fixing in the same pass.

### 9. Category A — Polish is correct, do not rename by reflex

`przedmiar` (`grid/kosztorys-v2-columns.tsx:341`), `headerMarkPrzedmiar` / `headerMarkPomiar`
(`src/scripts/seed-investment-from-sheet.ts:56-57`), `withoutPomiarHeader` (test), the whole
`kosztorys` stem, and the `…FromKosztorys` suffixes.

**Not Category A despite appearances: `etap` and `robocizna`.** AGENTS' rule-1 test is the English
equivalent, and it names both — `etapy` → `stage`, `robocizna` → `laborCosts`, Polish in UI labels and
prose only. Both are B1 throughout; only the tab-title _string_ `'kosztorys_robocizny'` stays.

Also unconditionally staying: `ROBOCIZNA_TAB`'s value, `STAGE_MARKER = 'wykonano'`, every
`FIELD_MATCHERS` / `RATE_GROUP_MATCHERS` / `FOOTER_ROWS` literal (`sheet-import/columns.ts`), the pie
slice `name: 'Robocizna'`, `label = 'Saldo'`, and `etapQty`'s fixture header string — all transcribed
sheet data or UI copy.

### 10. The guard — what re-enabling actually needs

`eslint.config.mjs:16-50, 140-148`, committed commented out with `TODO(EX-548)`.

- **Stems carried today (9):** `bilans`, `marza`, `rabat`, `zaliczk`, `wplat`, `wyplat`, `robocizn`,
  `strata`, `etap`.
- **Live stems it would MISS (12):** `saldo` (16 ids), `sumaPrac`, `materialy`, `doZaplaty`,
  `wydatki`, `reszta`, `doRozliczenia`, `lacznie`, `prace`, `wykonan`, `netto`, `brutto`. **Q8
  mandated adding `^saldo|Saldo` and it was never done.**
- **Glob:** `files: ['src/**/*.{ts,tsx}']`, `ignores: ['src/migrations/**']`. **`e2e/` is excluded and
  carries live drift** (`e2e/helpers.ts:56,66` `readSaldo` / `readSaldoStable`;
  `e2e/investments-listing-kosztorys.spec.ts:16` `sumaPracNet`). Root `scripts/` holds no TS — that
  concern is moot; `src/scripts/**` is already in scope and does carry drift.
- **String-literal blindness** (the visitor is `Identifier(node)` only) hides exactly two things in
  product code:
  1. `SectionPieBaseT = 'przedmiar' | 'wykonane'` (`src/lib/kosztorys/chart-slices.ts:47`) — **not
     persisted anywhere** (no localStorage, URL param, DB or preset), so a free two-line rename. This
     is the one blind-spot exploit worth closing in this change.
  2. `InvestmentStatusT = 'active' | 'completed' | 'planowana'` (`src/types/reference-data.ts:15`) —
     a mixed-language union backed by a **real prod enum value**
     (`20260718_0_add_planowana_investment_status.ts:9`). Migration-bearing; out of scope but must be
     recorded in the glossary's DB-column guardrail.

**So re-enabling is not "a pure uncomment"** — that claim in EX-548's description is false.

### 11. Artifact staleness — everything we would plan from is wrong

**`context/domain/02-glossary.md`** — 11 of 13 rows in §1 cite a line that no longer holds the
concept; one cites `transfer-rules.ts`, **a file that does not exist**. The plane-suffix table
describes a pair (`laborCostsNetFromKosztorys` ↔ `laborCostsNetFromTransactions`) whose first half has
zero hits. §2 cites four files/symbols that do not exist (`kosztorys-summary.tsx`,
`computeCashSettlement`, `depositsSplit`, `DepositsSplitT`). Missing entirely: `saldo`, `sumaPrac`,
`doZaplaty`, `materialy`, `wydatki`, `reszta`, `doRozliczenia`, `wykonan`, `brutto`, `netto`, `prace`,
`InvestmentStatusT`. The `stage` row's "rename landed EX-536" is **false** — 159 sites remain.

**`context/domain/01-domain-distillation.md`** — **`change.md` gate 3 is itself stale.** The file is
not dated 2026-07-08; its frontmatter reads `created: 2026-07-20` and it _is_ the from-scratch
regeneration the gate demands, verified on `2562a2e1`. That mandate was discharged. But the
2026-07-20 revision is now heavily stale on different grounds: `settlement.ts` was split into five
files (nine dead citations), `zaliczki.ts` was deleted (EX-536 — `zaliczk` has zero hits, so KROK 1's
whole „Zaliczka" row and KROK 3D's `kosztorysStage` bridge are dead), and **EX-675 inverted KROK 3B's
"strata never touches bilans"** — `calculate-balance.ts:18` adds `financials.totalLoss`. Regeneration
is genuinely required; the _reason_ in `change.md` is not.

**`decisions.md`** — Q1 overtaken on evidence (conclusion survives), Q2 correctly superseded, Q3
stands (unexecuted), **Q4 overtaken on every cited fact**, **Q5 overtaken on substance** (§2), **Q6
overtaken — its evidence base `print-button.tsx` does not exist and `BILANS_LABEL` has zero hits**, Q7
stands (its glossary Cat-A entry was never recorded), Q8 stands but its guard-stem action was never
taken, **Q9 confirmed still open**.

**Linear EX-548's description** — the "27 drift symbols / ~32 files" inventory is stale in both
directions; the worked example (`zaliczki.ts`) no longer exists; `lib/queries/client-kosztorys.ts`
does not exist; `robociznaNet` has zero hits; the "Categories A: keep `etap`, `robocizna`,
`podsumowanie`, `sumaPrac`" line **directly contradicts** the later owner rulings. The body was never
updated after 2026-07-20.

**`context/domain/03-drift-rename-worksheet.md`** — confirmed: **has never existed on any branch**
(`git log --all` on the path returns nothing). EX-548 still cites it as the home of the per-symbol
classification. Dangling reference.

## Code References

- `src/lib/kosztorys/reconciliation.ts:120-121` — the two-figure recon; the only true B2 seam
- `src/lib/kosztorys/summary-reading.ts:14-59` — the plane switch + surviving trap T1
- `src/lib/kosztorys/settlement-client-totals.ts:18-82` — `sumaPracNet` / `rabatClientNet` home
- `src/lib/db/kosztorys-client-totals.ts:86-99` — the SQL twin and its aliases
- `src/lib/kosztorys/sheet-import/read-sheet.ts:30-73` — the new `Robocizna` hybrid family
- `src/lib/kosztorys/summary-economics.ts:121-200` — `sumaPracPreRabat`, `doZaplaty*`, `reszta*`
- `src/lib/kosztorys/subcontractor-summary.ts:138` — Q9's formula
- `eslint.config.mjs:16-50,140-148` — the dormant guard
- `src/migrations/20260611_add_rabat_enum.ts:7` — the one migration-bearing literal

## Architecture Insights

- **The drift is not evenly distributed** — it clusters at the seam where the kosztorys plane meets
  the transactions plane (`summary-reading.ts`, `reconciliation.ts`, `settlement-client-totals.ts`),
  which is exactly where a wrong name is most expensive. Away from that seam, new modules
  (`row-conditions.ts`, `sheet-column-mapping.ts`, `settlement-mode.ts`, `subcontractor-due.ts`) are
  clean English.
- **A figure that acquires a second implementation acquires a second name.** `sumaPracNet` now exists
  in TS and in SQL; `laborCostsNet` now exists on two planes. Both happened _after_ the prior
  inventory, and both are why the rename gets harder monthly.
- **The naming rules are being followed by new code that touches the schema and broken by new code
  that doesn't.** Every persisted identifier added since `a5ef7baf` is English; the Polish went into
  in-memory types and locals, where nothing forced a decision.

## Historical Context (from prior changes)

- `context/archive/2026-08-12-wplaty-jedno-zrodlo/change.md` — trap T4 resolved by _removing_ the
  contested field rather than picking a winner between its two bases.
- EX-555 (`f72c68a1`) — freed `laborCostsNetFromKosztorys` as a name, dissolving Q1's hazard.
- EX-536 — deleted `zaliczki.ts`, retiring the `zaliczk` stem to pure-regression status.
- EX-650 (`e6d57f78`) — split `settlement.ts` into five files; the single largest source of dead
  citations in every artifact.

## Open Questions

1. **Q9** (`remaining` / `dueNet`) — owner ruling still owed; recommendation **stay bare**, now with
   the plane evidence in §5.
2. **Q5 needs re-ruling** — `rabatAmount` has two producers, so the correct target is bare
   `discountAmount`, not `discountNetFromKosztorys`.
3. **Q4 needs re-ruling** — `sumaPracPreRabat` is no longer deletable-by-inlining; it is the only
   plane-agnostic reconstruction of the pre-discount figure.
4. **`executedWorkNetPreRabat`** — prior pass said delete; it is now a documented test oracle. Rename
   (`…PreDiscount`) rather than delete.
5. **Scope call:** does this change absorb the `saldo` family (16 ids / 144 occ, entirely outside
   kosztorys)? Q8 folded it in; it is the single largest B1 block and would roughly double the diff.
6. **`'RABAT'` enum and `'planowana'` status** — both migration-bearing. Recommend: explicitly out of
   scope, recorded in the glossary's DB guardrail.

## Appendix — full per-identifier classification

Runtime identifiers, non-test, grouped by subsystem. `A` = Polish is correct; `B1` = mechanical
English rename; `B2` = plane suffix; `gray` = needs a ruling.

### Recon seam / client totals

| identifier                                                | def site                              | cat | →                             |
| --------------------------------------------------------- | ------------------------------------- | --- | ----------------------------- |
| `sumaPracNet`                                             | `settlement-client-totals.ts:18`      | B2  | `laborCostsNetFromKosztorys`  |
| `rabatClientNet`                                          | `settlement-client-totals.ts:22`      | B2  | `discountNetFromKosztorys`    |
| `investmentRabat`                                         | `types.ts:164`                        | B2  | `discountNetFromTransactions` |
| `globalRabatNet`                                          | `settlement-client-totals.ts:27`      | B1  | `globalDiscountNet`           |
| `itemRabatNet`                                            | `settlement-client-totals.ts:62`      | B1  | `itemDiscountNet`             |
| `executedWorkNetPreRabat`                                 | `settlement-client-totals.ts:82`      | B1  | `executedWorkNetPreDiscount`  |
| `rabat` (recon verdict field)                             | `reconciliation.ts:24`                | B1  | `discount`                    |
| `rabat_client_net` / `suma_prac_net` / `global_rabat_net` | `db/kosztorys-client-totals.ts:86-88` | B1  | SQL aliases only              |

### Summary reading / investment financials

| identifier                | def site                            | cat | →                                        |
| ------------------------- | ----------------------------------- | --- | ---------------------------------------- |
| `rabatAmount`             | `summary-reading.ts:16`             | B1  | `discountAmount` (**not** a suffix — §2) |
| `totalRabat`              | `types/investment-financials.ts:19` | B1  | `totalDiscount`                          |
| `MaterialyBreakdownRowT`  | `types/investment-financials.ts:59` | B1  | `MaterialsBreakdownRowT`                 |
| `buildMaterialyBreakdown` | `db/map-category-costs.ts:45`       | B1  | `buildMaterialsBreakdown`                |
| `materialyBreakdown`      | `kosztorys/types.ts:159`            | B1  | `materialsBreakdown`                     |
| `isBruttoMaterial`        | `db/investment-financials.ts:82`    | B1  | `isGrossMaterial`                        |

### Summary economics / settlement panel

| identifier                                  | def site                                                                       | cat  | →                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `sumaPracPreRabat`                          | `summary-economics.ts:121`                                                     | B1   | `laborCostsNetPreDiscount`                                     |
| `computeDoZaplatyRM`                        | `summary-economics.ts:136`                                                     | B1   | `computeAmountDue`                                             |
| `robocizna` (field)                         | `summary-economics.ts:155`                                                     | B1   | `laborCostsNet`                                                |
| `materialy` (field)                         | `summary-economics.ts:156`                                                     | B1   | `materialsBilled`                                              |
| `doRozliczeniaNet`                          | `summary-economics.ts:160`                                                     | B1   | `outstandingNet`                                               |
| `resztaGross`                               | `summary-economics.ts:162`                                                     | B1   | `remainderGross`                                               |
| `doZaplatyGross` / `doZaplatyNet`           | `summary-economics.ts:165,169`                                                 | B1   | `amountDueGross` / `amountDueNet`                              |
| `doZaplaty` (prop)                          | `summary/settlement-groups.ts:17`                                              | B1   | `amountDue`                                                    |
| `wykonaneNet`                               | `tabs/summary-stages-tab.tsx:20`                                               | B1   | `executedNet`                                                  |
| `sumaPrac` / `sumaPracMismatch`             | `blocks/settlement-summary.tsx:84`, `tables/summary-breakdown-table.tsx:19`    | B1   | `laborCostsPair` / `laborCostsMismatch`                        |
| `rabat` / `rabatMismatch` / `showRabat`     | `tables/summary-breakdown-table.tsx:31,22`, `blocks/settlement-summary.tsx:81` | B1   | `discount` / `discountMismatch` / `showDiscount`               |
| `RabatValueField`                           | `summary/rabat-value-field.tsx:37`                                             | B1   | `DiscountValueField` (+ file)                                  |
| `applyPercentRabatSchema`                   | `kosztorys/percent-rabat.ts:9`                                                 | B1   | `applyPercentDiscountSchema` (+ file)                          |
| `applyPercentRabatToAllItemsAction`         | `actions/kosztorys.ts:232`                                                     | B1   | `applyPercentDiscountToAllItemsAction`                         |
| `handleApplyPercentRabat`                   | `editor/use-kosztorys-editor.ts:1290`                                          | B1   | `handleApplyPercentDiscount`                                   |
| `wplatyNoun`                                | `summary/settlement-plane-warning.tsx:10`                                      | gray | `depositNoun` — **Polish string payload stays**                |
| `praceNoun` / `sekcjeNoun`                  | `editor/dialogs/preset-picker-groups.ts:4-5`                                   | gray | `itemNoun` / `sectionNoun` — same caveat                       |
| `costTotalsPieSlices(robocizna, materialy)` | `chart-slices.ts:74`                                                           | B1   | `(laborCostsNet, materialsBilled)`; slice `name:` strings stay |

### Wydatki datasets

`WydatkiDatasetT` (`wydatki-datasets.ts:4`), `WydatkiPartitionT` (`:6`), `partitionWydatkiRows`
(`:16`), `availableWydatkiDatasets` (`:39`), `wydatkiRowHref` (`:51`) — all **B1** →
`ExpenseDatasetT`, `ExpensePartitionT`, `partitionExpenseRows`, `availableExpenseDatasets`,
`expenseRowHref`. The union values (`'gross'|'net'|'settled'`) are already English.

### Sheet import

`resolveRobocizna` (`resolve-columns.ts:179`) → `resolveLaborColumns`; `ResolvedRobociznaT` (`:53`) →
`ResolvedLaborColumnsT`; `RobociznaFailureT` (`:51`) → `LaborColumnsFailureT`; `resolvedRobocizna`
(`build-import-plan.ts:98`) → `resolvedLaborColumns`; `parseRobocizna` (`parse-robocizna.ts:82`) →
`parseLaborTab` (+ file); `ParsedRobociznaT` (`:25`) → `ParsedLaborTabT`; `ImportGridsT.robocizna`
(`read-sheet.ts:30`) → `laborGrid`; `robociznaGid` (`:33`) → `laborTabGid`; `robociznaFormulas`
(`:35`) → `laborGridFormulas`; `robociznaTitle` (`:73`) → `laborTabTitle`; `MissingRobociznaTabError`
(`:46`) → `MissingLaborTabError`; `rabat` local (`parse-robocizna.ts:136`) → `discountFraction`. All
**B1**; `ROBOCIZNA_TAB`'s value and every matcher literal stay.

### Saldo (cash registers — outside kosztorys, scope call open)

`getRegisterSaldo` (`queries/register-saldo.ts:10`), `useSaldo` / `saldo` / `setSaldo` /
`isSaldoLoading` / `setIsSaldoLoading` / `fetchSaldo` / `resetSaldo`
(`components/forms/hooks/use-saldo.ts:5-27`), `saldoColor` / `SaldoDisplay` / `SaldoDisplayPropsT`
(`components/ui/saldo-display.tsx:7,13,20`), `SaldoSummary` / `SaldoSummaryPropsT`
(`forms/form-components/saldo-summary.tsx:4,10`), `totalSaldo`
(`dashboard/user-register-stats.tsx:26`) — all **B1** → `…Balance…`, keeping `balance` for the
investment figure per §8. The `label = 'Saldo'` default string stays.

### Editor grid / seed scripts

`przedmiar` (`grid/kosztorys-v2-columns.tsx:341`) **A**; `headerMarkPrzedmiar` / `headerMarkPomiar`
(`src/scripts/seed-investment-from-sheet.ts:56-57`) **A**; `etapFirst` (`:55`) → `stageFirst`,
`maxEtap` (`:98`) → `maxStage`, `rabat` column key (`:60`) → `discount`, `rabat` local (`:129`,
`seed-kosztorys.ts:118`) → `discountFraction` — all **B1**.

### Test-only (no runtime risk)

`etapQty` (`__tests__/fixtures/kosztorys-sheet/header-blocks.ts:9`, 154 sites — **its Polish header
string must stay verbatim**, it is transcribed sheet data), `bilans` / `marza` / `materialy` /
`wydatkiInwestycyjne` (`__tests__/settled-vs-unsettled-expense.test.ts:31-35`), `detailBilans`
(`__tests__/investment-render-parity-db.test.ts:142`), `postRabatNet`, `rabatNet`, `wplaty`,
`lacznie`, `withRabat`, `_originalRabat`, `createItemWithRabat`, `itemRabat`, `nettoDoc`,
`readSaldo` / `readSaldoStable` (`e2e/helpers.ts:56,66`), `sumaPracNet` seed type
(`e2e/investments-listing-kosztorys.spec.ts:16`). `withoutPomiarHeader` is **A**.
