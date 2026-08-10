# Review-gate ledger — branch `konradantonik/ex-536-zaliczka-v2` → origin/staging · 2026-07-24

Unit of work: the **63 commits** `origin/staging (87dc511c) .. HEAD (25583ff6)` — the whole
zaliczka / tryb-mieszany / netto-brutto arc. **107 files, +5187 / −1488** (72 non-test code files,
11 test files, 24 doc files). Clean superset of staging (63 ahead, 0 behind). No single 10x change
folder anchors it → fallback branch-diff scope.

Change folders in scope (in-flight, touched vs staging): `netto-expense-type` (EX-536),
`kosztorys-tryb-mieszany`, `kosztorys-zaliczka-v2`, `etap-tool-plane` (EX-565),
`kosztorys-percent-rabat-bulk-apply` (EX-564).

New migrations (both `transactions` schema): `20260721_0_drop_kosztorys_stage_from_transactions`,
`20260721_1_add_vat_plane_to_transactions`. Prod migration is a deploy-time gate, not a slice blocker.

Surviving checks (fan-out): `/code-review` (diff-scoped), `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `tailwind-v4-audit`,
`comment-noise-audit` (flag-only, diff-scoped). `/10x-impl-review` **subsumed into doc
reconciliation** — 5 change folders, no single anchoring `plan.md`, and initial decisions were
overturned, so "does code match plan" is the reconciliation job (Phase D), not a mechanical run.

Step 0.5 (browser/manual verification): **skipped by user directive** (2026-07-24) — "do not do any
manual checks; add any found to `context/foundation/manual-checks.md`". Fan-out only.

**Trimmed at archive (2026-08-10).** The 11 `fixed` findings were removed: each one's durable record
is its commit, and a ledger line describing a change is strictly worse evidence than the change.
Kept in condensed form: the ⚠ client-facing money change, because its owner-visibility flag and test
disposition are not recoverable from the diff. What else survives is the negative space git cannot
hold — what a reviewer looked at and chose **not** to act on, and why. Moved here from the
`.review-gate/` fallback path, which had no lifecycle of its own.

Final tally before the trim: **11 fixed, 2 dismissed, 2 dropped, 1 skipped, 0 open**
(plus 5 resolved Phase-D reconciliation actions, kept below).

`tailwind-v4-audit`: **CLEAN** — 42 files inspected, zero anti-patterns introduced. The new
`--shadow-panel` `@theme` token consumed via the generated `shadow-panel` utility is the correct
pattern.

`code-review` verified correct: summary-economics money math (grossPair inverse, materiały planes
combined without inventing VAT, mixed settlement no double-deduct), `bucketDepositsByPlane`
null=netto, chart-slices, full `vatPlane` plumbing end-to-end, and the clean removal of the
zaliczka-by-stage plane (zero dangling readers of `kosztorys_stage_id`).

File-organization (feature-first + module-cohesion + structure-scatter): **CLEAN.** Contract types in
the right tier, every component/hook single-concern, no new competing homes.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `page.tsx:90` · non-mixed „Wpłaty"/„Do zapłaty" drew `wplatyNet` from `financials.totalIncome` (ALL deposit types incl. `COMPANY_FUNDING` + `OTHER_DEPOSIT`) while the deposit list / Wpłaty tab / plane pie / Mieszane use the `INVESTOR_DEPOSIT`-only query → the same panel showed 3 deposit totals per toggle. Narrowed to the `INVESTOR_DEPOSIT`-only base. Self-consistency-restoring, not a new domain ruling. **⚠ CLIENT-FACING money change on legacy data — flagged for owner visibility; blast radius = legacy/admin rows only, since EX-557 hides investment on `COMPANY_FUNDING`.**
      test: TDD · integration — authored `src/__tests__/lib/db/get-deposit-transactions.test.ts`, guarding the exact base `wplatyNet` now sums.
- [x] skipped · 🔵 OBSERVATION · code-review · `kosztorys-totals-panel.tsx:127` · `useState(vatPercent)` seeds `materialsReductionPercent` once; won't track a `vatRate` change. Latent only — `vatRate` is a server-sourced constant prop today, no live failure. Not worth a behavior change now.
      test: no automated test — latent, no observable failure with the current constant prop.
- [x] dismissed · 🔵 OBSERVATION · code-review · migration `20260721_1` deploy-ordering · the `vat_plane` SELECT 500s if code ships before the migration runs. NOT a code bug — a deploy-time gate → recorded as a deploy/manual note, not a code finding.
- [x] dismissed · comment-noise · `money-axis.ts:299`, `summary-grid.tsx:257` · borderline "now"/mild-restatement — survive the STRIP TEST (they justify a concrete constraint / are part of a doc-symmetry set). Keep.
- [x] dropped · structure-scatter · `summary-axis.ts:1` · `summaryMoneyCols` sits in `kosztorys/` while the `SUMMARY_LABEL_COL`/`SUMMARY_VALUE_COL` + `SummaryTable` it feeds live in `ui/summary-grid.tsx` — but it also depends on `MoneyAxisT`/`axisShows` from `lib/kosztorys/money-axis.ts`, so kosztorys placement is defensible (a wash). Too marginal to churn.
- [x] dropped · simplify · `summary-expenses-tab.tsx:47` · `materialsReductionPercent / 100` duplicates the panel's `/100` — but the tab needs the raw percent for its CoeffField, so only a second `/100` would move; too minor to churn.

## Simplify pass

Ran a read-only simplification analysis over the summary/kosztorys cluster (22 files); 6 findings,
applied in the main thread — 5 fixed, 1 dropped. Each folded into `## Findings` (the fixed ones
trimmed above). Typecheck green after the multi-file prop-prune.

## Tests & suite

- **Manual checks: registered, not executed** (user directive 2026-07-24).
  `context/foundation/manual-checks.md` — retired the stale typed-`C` slice-B checks and added a
  consolidated `kosztorys-podsumowanie-tabs` section: money-axis (Netto/Brutto/Mieszane), materiały
  brutto→netto reduction, deposit `vatPlane` split, the ⚠ `wplatyNet` `INVESTOR_DEPOSIT`-only base
  (owner sign-off flagged), Wydatki/Robocizna tabs + „Postęp prac" bar, and the two-migration
  deploy-ordering note.
- **`pnpm typecheck`: green** (run after the multi-file prop-prune).
- **Full suite (lint / test / test:e2e / build): NOT run — awaiting user go.** The DB-integration leg
  (`get-deposit-transactions.test.ts`) needs the 5435 `db-test` container up.

## Doc reconciliation (Phase D)

Discovery map compiled (agent) + code-verified. **What shipped vs what the docs said:**

**Change folders (5):**

- `netto-expense-type` (EX-536) · `planned` — **VERIFIED not shipped** (no
  `INVESTMENT_EXPENSE_NET`/`netAmount`/`netRate` in code; only a design/plan doc rides this branch).
  Status correct. ⚠️ internal design wrinkle: commit `9e52b393` "netRate editable per expense" vs
  `design.md` "netAmount immutable after create" — reconcile intent (future work, low priority).
- `kosztorys-tryb-mieszany` (EX-536) · `implemented` — shipped; `plan.md` already carries a
  "Reconciled 2026-07-22 — shipped differently in 3 ways" banner + the 2026-07-23 flip. ✔
- `kosztorys-zaliczka-v2` (EX-536) · `implemented` — shipped (materiały brutto→netto waterfall).
- `etap-tool-plane` (EX-565) · `planned` — **docs-only on this branch**. Correct.
- `kosztorys-percent-rabat-bulk-apply` (EX-564) · `planned` — **docs-only**. Correct.

**Roadmap gaps found:** no slice row for zaliczka-v2 / tryb-mieszany / netto-expense-type /
etap-tool-plane / percent-rabat — the whole arc lived ONLY as blocker prose under **S-12**
(EX-536, `roadmap.md:464`). Two `implemented` change folders had no roadmap representation, and
EX-564 / EX-565 were absent entirely.

**Reconciliation actions (all resolved 2026-07-24):**

- [x] roadmap · added a "Shipped beyond the entry-axis (zaliczka-v2 batch)" bullet under S-12: the
      EX-536 presentation layer grew into the full tabbed Podsumowanie, still presentation-only,
      does not unblock the S-12 archive.
- [x] roadmap · registered EX-564 (percent-rabat, Backlog) + EX-565 (etap-tool-plane, Todo) as
      planned follow-ons under S-12.
- [x] linear · verified — all three states already correct: EX-536 **Done**, EX-564 **Backlog**,
      EX-565 **Todo**. No changes.
- [x] identifier · verified — the plan-flagged `materialyNet`/`materialsNet` is **not in shipped
      code**. The real half-translations (`wplatyNet`, `materialyPair`, `materialyBreakdown`) are
      AGENTS.md rule-3 violations but **pervasive and parked under EX-548** ("the rest of the
      codebase is undecided; do not fix beyond EX-532", owner ruling) → not renamed now, by mandate.
- [x] traceability · added `linear: EX-536` to `kosztorys-zaliczka-v2/change.md` frontmatter.
