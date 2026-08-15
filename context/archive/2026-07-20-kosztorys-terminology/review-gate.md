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

_Trimmed at archive (2026-08-15): every `fixed` finding removed — its durable record is the commit that applied it. What survives is the negative space git cannot hold: what was looked at and deliberately not changed. Pre-trim tally: 21 fixed, 8 dismissed, 3 dropped, 1 skipped · 0 open._

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
- [x] dismissed · simplify/efficiency · `eslint-rules/no-domain-drift.mjs:53` · 21 regexes per
      Identifier benchmarked at ~100 ms against a 37 s `pnpm lint` (≈0.25 %, and that's an over-count).
      A combined alternation saves ~86 ms but destroys the per-stem fix message; a first-char prefilter
      is measurably slower. Leave it.
- [x] dismissed · simplify/efficiency · `src/lib/db/kosztorys-client-totals.ts:92` ·
      `GROUP BY investment_id, global_discount` — the second key is functionally dependent on the first,
      so it adds no groups; `max()` would be equivalent, not cheaper. The in-file comment already says
      this correctly.
- [x] 🟡 WARNING · dismissed · impl-review · `eslint.config.mjs` · `/^strata|Strata|^straty|Straty/`
      was flagged as liable to fire on English words. Tested against
      `strata/totalStrata/strategy/substrataId/demonstrate/Strategy` — only the two Polish forms match.
      No realistic collision.
- [x] 🔵 OBSERVATION · dismissed · code-review · `SectionPieBaseT` · the `'planned' | 'executed'` union
      flip was checked for a persistence path; its only consumer is a local `useState`, never written
      to the DB or a URL, so no stored value can hold the old Polish literals.
- [x] dropped · simplify · `chart-slices.ts:91` + `materials-breakdown-table.tsx:59` · the two
      `${row.origin}-…` React keys were proposed for extraction into a shared helper. They are not the
      same key: the pie prefixes `expense-`, the table does not. Unifying them would change the pie's
      id space to fix nothing.
- [x] dismissed · simplify/altitude · `eslint.config.mjs:96` · the `src/payload-types.ts` ignore was
      argued to be dead weight at the wrong level. Confirmed: dropped it, `pnpm lint` still reports 0
      drift. Entry and its half of the comment removed.
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
