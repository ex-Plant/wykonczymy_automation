# Review-gate ledger — kosztorys-terminology · 2026-08-15

Slice: EX-548, branch `ex-548-kosztorys-terminology`, commits `f4bbdfa9..938e0564` (129 files).

Fan-out: `10x-impl-review`, `code-review`, `comment-noise-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`.
Dropped: `tailwind-v4-audit` — zero CSS changes, className strings byte-identical (prettier reflow only).
Step 0.5 skipped — no `verify-manual-checks` skill installed in this environment.

**Behaviour-neutrality of the rename is corroborated three independent ways**: `code-review`'s
golden-master diff (only the `totalRabat`→`totalDiscount` key moved; every numeric byte-identical),
`impl-review`'s two mechanical checks (per-file numeric-literal multisets identical; the
identifier-stripped token stream differs only where a comment or a Prettier reflow explains it), and
the suites that ran during implementation.

## Findings

- [x] fixed · impl-review · `src/components/ui/register-balance-display.tsx:14` →
      `signed-money-display.tsx` · `RegisterBalanceDisplay` was a generic signed-money renderer named
      after one of its six uses — `financial-stats.tsx:145` feeds it `margin` under `label="Marża"`,
      `pracownicy/[id]` feeds it `payoutsTotal`. Inherited from `SaldoDisplay`; the rename made it
      legible, not new. Now `SignedMoneyDisplay` with prop `amount` (was `registerBalance`), helper
      `signedMoneyColor` (was `registerBalanceColor`), file `signed-money-display.tsx`; all 6 consumers + the e2e comment moved. `label = 'Saldo'` stays the default — a register balance is the
      commonest caller — with a comment saying so, so the default reads as convenience rather than as
      the component's subject.
      test: no automated test · — pure rename, `tsc` is the gate; no behaviour change, no guard owed
- [x] dismissed · module-cohesion · `src/lib/kosztorys/summary-economics.ts:217-260` +
      `reconciliation.ts:64-104` · **premise is false.** `reconciliation.ts` does not re-implement the
      bucketing, it _consumes_ it: `buildSettlementPlaneVerdict` takes `taggedNet`/`taggedGross` as
      arguments and its own docblock says it reads them from `bucketDepositsByPlane`. Verified by
      grepping every `vatPlane` reader in `src/lib` — `summary-economics.ts:241` is the only one, which
      is exactly the invariant the code claims. Nor was a `deposit-planes.test.ts` owed: the proposed
      cases (null plane, mixed NET+GROSS, empty set) already exist as
      `summary-economics.test.ts:419-460`, plus a fifth for the tagged-vs-settled distinction.
      (`deposits-table.tsx:56` does sum per plane, but over a three-bucket display partition that
      includes a literal `null` bucket — `tally` takes a non-null `VatPlaneT` and cannot express it.)
- [x] fixed · simplify/efficiency · `src/lib/db/kosztorys-client-totals.ts:52` ·
      `JOIN kosztorys_stages ks ON ks.id = sp.stage_id` removed. It filtered and projected nothing:
      `stage_progress.stage_id` is `NOT NULL REFERENCES kosztorys_stages(id) ON DELETE CASCADE`
      (`20260709_0_add_kosztorys_stages.ts:26`), so an inner join to that PK matches exactly one row
      always, and Postgres only performs join-removal on OUTER joins — it built and probed the hash on
      every execution. Measured on the local DB: 0.668 ms with, 0.150 ms without, same 202 rows.
      The comment claiming it "mirrors the TS path, which sums over the investment's stage list" was
      the reason it looked load-bearing, and it was **wrong** — the join carries no investment
      predicate, so it mirrors nothing. Comment deleted with the join rather than corrected.
      test: no automated test · — guarded by the existing golden-master parity spec. Run against
      `db-test` before and after: `pnpm test:parity` 3/3 green both times, plus the DB-backed
      `kosztorys-client-totals.test.ts` 4/4 (the TS↔SQL parity spec that pins this exact query).
- [x] dismissed · simplify/efficiency · `eslint-rules/no-domain-drift.mjs:53` · 21 regexes per
      Identifier benchmarked at ~100 ms against a 37 s `pnpm lint` (≈0.25 %, and that's an over-count).
      A combined alternation saves ~86 ms but destroys the per-stem fix message; a first-char prefilter
      is measurably slower. Leave it.
- [x] dismissed · simplify/efficiency · `src/lib/db/kosztorys-client-totals.ts:92` ·
      `GROUP BY investment_id, global_discount` — the second key is functionally dependent on the first,
      so it adds no groups; `max()` would be equivalent, not cheaper. The in-file comment already says
      this correctly.
- [x] 🟡 WARNING · fixed · impl-review · `context/domain/01-domain-distillation.md:34-57,180` ·
      KROK 1's anchor table cited five dead paths and pre-rename identifiers, KROK 4 row 2 still called
      the Polish-generic drift open, and `verified_at` pointed at the pre-rename SHA — all rewritten
      against `938e0564`. (impl-review also claimed EX-650's `settlement-*` split and EX-675's
      `totalLoss` reversal went unmentioned; reading KROK 4 rows 5-6 disproved that, so the fix was
      narrowed to what was genuinely stale.)
- [x] 🟡 WARNING · dismissed · impl-review · `eslint.config.mjs` · `/^strata|Strata|^straty|Straty/`
      was flagged as liable to fire on English words. Tested against
      `strata/totalStrata/strategy/substrataId/demonstrate/Strategy` — only the two Polish forms match.
      No realistic collision.
- [x] 🔵 OBSERVATION · dismissed · code-review · `SectionPieBaseT` · the `'planned' | 'executed'` union
      flip was checked for a persistence path; its only consumer is a local `useState`, never written
      to the DB or a URL, so no stored value can hold the old Polish literals.
- [x] fixed · impl-review · `context/domain/02-glossary.md:18-20,45-58` · the "Drift in code" column
      still advertised `bilans`/`saldo`/`marza`/`wplaty`/`wyplaty`/`rabat`/`strata` as outstanding and
      the preamble still called the file a pre-rename spec; both now read as executed, and
      `queries/register-saldo.ts:10` (deleted path) → `lib/queries/register-balance.ts:10`.
- [x] fixed · module-cohesion · `eslint.config.mjs` → `eslint-rules/no-domain-drift.mjs` · the guard
      rule + its 21-stem table were inline in the flat config, which is wiring, not rule logic.
- [x] fixed · simplify/altitude · `eslint-rules/no-domain-drift.mjs` · **root-cause rewrite.** The rule
      matched `/^stem|Stem/` against raw `Identifier` names, i.e. it used **letter case as a proxy for
      "frozen DB enum value"** — which exempted `ROBOCIZNA_TAB` and `PRE_RABAT_CLIENT` for exactly the
      reason it exempted `RABAT`. Now: split each name on `_`/camelCase and test every word
      case-insensitively, with the frozen values named outright (`FROZEN = {RABAT, KOREKTA}`); plus two
      literal visitors — a `TSLiteralType` union member and an `id`/`key`/`value`/`type` property — so a
      Polish _code value_ is caught while Polish UI copy (`label:`/`name:`/`title:`, JSX children) stays
      invisible. Added the missing `korekt` stem. Verified: rule loads, `pnpm lint` reports 0 drift
      after the sweep below.
- [x] fixed · simplify/altitude · the widened guard's worklist — **72 survivors**, all renamed, `tsc` + 155 affected specs green: `ROBOCIZNA_TAB` → `LABOR_TAB` (value `'kosztorys_robocizny'` stays —
      it is the Google tab's name; renamed to `LABOR_TAB` rather than `LABOR_TAB_TITLE` to keep it
      distinct from `read-sheet.ts:73`'s `laborTabTitle`, which is the _discovered_ title),
      `ROBOCIZNA_FIELDS` → `LABOR_FIELDS`, the four `*_ROBOCIZNA_HEADER` fixtures → `*_LABOR_HEADER`,
      `KOREKTA_LABEL`/`RABAT_LABEL` → `CORRECTION_LABEL`/`DISCOUNT_LABEL` (Polish values stay — UI
      copy), `PRE_RABAT_CLIENT` → `PRE_DISCOUNT_CLIENT`, `FIRST_PRACA_ROW` → `FIRST_ITEM_ROW`,
      `BRUTTO`/`NETTO` → `GROSS`/`NET`, `RABAT_IS_CLIENT_ONLY` → `DISCOUNT_IS_CLIENT_ONLY`, and the
      chart-slice code values `'robocizna'`/`'materialy'`/`'netto'`/`'brutto'`/`'korekta'` →
      `'labor'`/`'materials'`/`'net'`/`'gross'`/`'correction'`.
- [x] dropped · simplify · `chart-slices.ts:91` + `materials-breakdown-table.tsx:59` · the two
      `${row.origin}-…` React keys were proposed for extraction into a shared helper. They are not the
      same key: the pie prefixes `expense-`, the table does not. Unifying them would change the pie's
      id space to fix nothing.
- [x] dismissed · simplify/altitude · `eslint.config.mjs:96` · the `src/payload-types.ts` ignore was
      argued to be dead weight at the wrong level. Confirmed: dropped it, `pnpm lint` still reports 0
      drift. Entry and its half of the comment removed.
- [x] fixed · impl-review · `eslint-rules/no-domain-drift.mjs:9-13` · the blind-spot comment named only
      Polish string unions; it now also names SCREAMING_CASE constants, snake_case aliases inside
      template literals, and filenames — the three classes that actually leaked through this slice.
- [x] fixed · comment-noise · `eslint.config.mjs:98` · `Whole app INCLUDING tests, scripts and e2e`
      restated the `files` glob two lines below it.
- [x] fixed · structure-scatter · `src/lib/db/kosztorys-client-totals.ts:76-92` · `global_rabat` CTE
      alias → `global_discount`. Verified file-local first (5 hits, one file, not a DB column).
- [x] fixed · structure-scatter · `src/scripts/seed-kosztorys-reconciliation.ts` · `SUMA_PRAC_NET` →
      `LABOR_COSTS_NET`; SCREAMING_CASE is one of the guard's blind spots, so it survived the sweep.
- [x] fixed · feature-first · `src/lib/kosztorys/wydatki-datasets.ts` → `expense-datasets.ts` (+ its
      spec, + 3 importers) · filenames are the guard's other blind spot; the exported symbols were
      already `ExpenseDatasetT` / `partitionExpenseRows`.
- [x] fixed · comment-noise · `src/hooks/transfers/recalculate-balances.ts:33-34` · the comment named
      `fetchWorkerRegisterBalances`, which exists nowhere — and whose pre-rename form `fetchWorkerSaldos`
      didn't either. Deleted rather than corrected; the remaining line carries the real rationale.
- [x] fixed · comment-noise · `src/lib/kosztorys/calc.ts:91`,
      `src/__tests__/lib/kosztorys/kosztorys-calc.test.ts:73`, `src/lib/kosztorys/column-config.ts:55`,
      `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:98` · four comments pointed at
      `settlement.ts`, split into five files by EX-650. Re-aimed at `settlement-client-totals.ts` /
      `settlement-rows.ts` / `subcontractor-due.ts`.
- [x] fixed · comment-noise · `e2e/helpers.ts:50,55-59,62-77`, `e2e/transfer-create.spec.ts:12-28`,
      `e2e/transfer-cancel.spec.ts:13-47`, `src/components/ui/register-balance-display.tsx:8`,
      `src/components/forms/hooks/use-register-balance.ts:29`,
      `src/lib/actions/validate-source-register.ts:45` · the rename swept prose too, leaving
      „the registerBalance" as an English noun and two test titles reading
      `the source register registerBalance`. Prose reverted to "balance"; one mis-swept Locator
      variable renamed `balanceText`.
- [x] fixed · comment-noise · `src/lib/kosztorys/settlement-client-totals.ts:79` · `What it deliberately
    does NOT do: add the global discount back.` duplicated `with no global-discount add-back` three
      lines up.
- [x] fixed · comment-noise · `src/lib/kosztorys/chart-slices.ts:10` · comment anchored the palette to
      `SLICE_COLORS`, a constant no longer in the tree.
- [x] fixed · comment-noise · `src/lib/db/calculate-margin.ts:1`, `calculate-balance.ts:3` · the
      `(margin)` / `(investor balance)` glosses became redundant once the functions were
      `calculateMargin` / `calculateBalance`. Polish prose kept — the glossary rules it in.
- [x] fixed · comment-noise · `src/types/transfers.ts:3` · the `TransferRowT` docblock had drifted onto
      `InvoiceFileT`; moved back onto its symbol.
- [x] fixed · simplify/reuse · `src/lib/kosztorys/summary-economics.ts` · `computeAmountDue` and
      `computeMixedSettlement` each spelled out the same settled deduction, so EX-675's rule (a strata
      deducts at face value on netto AND brutto alike, never widening the VAT base) lived twice.
      Extracted `deductSettled(combined, settledNet)`; both call it.
- [x] fixed · simplify · `src/app/(frontend)/pracownicy/[id]/page.tsx:52` · a local mis-swept by the
      rename; now `payoutsTotal`, matching the `'PAYOUT'` row it reads.
- [x] dismissed · simplify/reuse · `settlement-client-totals.ts:85` · `sumSectionSubtotalsNet` was
      proposed as the dedup target for `clientTotalsFromSubtotals`'s `doneNet + itemDiscountNet`. It
      would _add_ a third reduce pass to replace two sums already in scope — a pessimisation.
- [x] dismissed · simplify · `SummaryReadingT.discountAmount` · claimed derivable and therefore
      redundant. It isn't: `summary-overview-tab.tsx:153` consumes it through
      `laborCostsNetPreDiscount(laborCostsNet, discountAmount)`, and it is an independent field of the
      reading, not a projection of another one.
- [x] skipped · simplify · `readingFromTransactions` · dead by grep, but it is the v1 reading AGENTS.md
      documents as the surface where legacy `LABOR_COST`/`RABAT` stays readable. Deleting it is a
      product call about v1, not a cleanup, so it does not belong in a rename slice.
- [x] dropped · comment-noise · ~19 comment lines exceeding printWidth 100 · Prettier does not wrap
      comments, so these are hand-fix-only cosmetics with no reader cost.
- [x] dropped · comment-noise · ~50 pre-existing noise comments in files the rename merely brushed ·
      real, but fixing them would balloon a rename diff into an unrelated comment sweep.

## Simplify pass

Ran `/simplify` (reuse · simplification · efficiency · altitude, four agents in parallel over
`f4bbdfa9~1..HEAD` + the working tree) — 8 applied, 0 proposed, 6 dismissed, 3 dropped, 1 skipped;
each finding folded into `## Findings` above (tagged `simplify/<angle>`). No separate report file —
this ledger is the single source of truth, per the gate contract.

The pass's centre of gravity was the altitude finding: the guard's `Identifier`-only, case-as-proxy
matching was itself the reason three drift survivors made it through the rename. Fixing the rule
first, then re-running it as the worklist, is what turned a subjective sweep into a closed one —
`pnpm lint` now reports **0** drift across `src/**` + `e2e/**`.

## Tests & suite

- `pnpm typecheck` — pass. The load-bearing leg for a rename slice: a missed call site is a type error
  by construction, so tsc is what proves the sweep is complete.
- `pnpm lint` — 0 `local/no-domain-drift` violations across `src/**` + `e2e/**`. Exits 1 on 2
  **pre-existing, unrelated** `'console' is not defined` errors in `test.js`, which is untracked AND
  gitignored (`git log`/`git status` both empty for it).
- `pnpm test` — 153 files, 2268 passed, 115 skipped (the DB-backed specs, which need `db-test` up).
- `pnpm build` — pass.
- `pnpm test:parity` — 3/3, run against `db-test` **before and after** removing the no-op JOIN, plus
  the DB-backed `kosztorys-client-totals.test.ts` 4/4. This is the only leg in the gate that pins the
  TS↔SQL client-view parity, and the JOIN removal is the only edit in the slice that touches SQL.
- `pnpm test:e2e` — **not run**, and none owed: `plan.md` records the ruling that this slice is not
  browser-level (no UI string moves), so it owes no spec of its own. Not deferred, not filed — the
  obligation does not arise.

**No new specs authored, and none owed.** The slice changes no behaviour, so there is no behaviour to
pin. The two findings that carried a test disposition were both resolved by an existing guard rather
than a new one: the JOIN removal by the golden-master parity spec, and the deposit-bucketing finding
by `summary-economics.test.ts:419-460`, which already covers the exact cases it asked for.
