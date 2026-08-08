# Review-gate ledger — feat/kosztorys-summary (full branch) · 2026-08-07

Scope: the **whole branch** `feat/kosztorys-summary` vs `staging` — 46 files under `src`,
+1195/−824, plus the uncommitted working tree at gate time (15 modified files).

This supersedes nothing: the earlier `2026-07-29-netto-expense-grossup` gate covered the first 10
commits of this branch and closed all its boxes. This gate re-reviews the whole branch because five
further commits and a session of owner rulings landed on top, reshaping the settlement block, the
wydatki tab and the settings controls after that gate closed.

Step 0.5 browser pass **skipped**: the owner drove this panel live in the browser through the whole
session, ruling on each iteration — a dispatched verification pass would re-check what he had just
signed off on. Manual verification is sourced from him directly at Step 4.

## Findings

- [x] fixed by owner ruling (2026-08-08) · impl-review · `settlement-mode-options.ts:7` · the
      „Mieszane" description told the owner that adding a **wydatek inwestycyjny** is where he picks
      the netto/brutto pool — the sentence is the wpłata field's own description with the noun
      swapped. Three distinct netto/brutto switches live side by side: the settlement mode itself, a
      wpłata's plane (`bucketDepositsByPlane` — the ONE this mode actually turns on), and the
      wydatek's type + materiały pricing control (which apply in **every** mode). The copy named the
      third while describing the first. Rewritten to name the wpłata and to say what the split buys:
      „Dodając wpłatę określasz, czy trafia do puli netto czy brutto. Rozliczenie dzieli się wtedy na
      dwa tory — gotówkowy bez VAT i fakturowy z VAT-em na robociznę."
      test: no automated test — a copy string; asserting its wording would pin the sentence, not the
      behaviour behind it

- [x] 🔴 CRITICAL · fixed · code-review · `lib/kosztorys/summary-economics.ts:166` ·
      `resztaGross = toGross(doRozliczeniaNet, vatRate)` grossed **materiały** along with the prace,
      contradicting `combinedPair`'s face-value rule. Concrete: robocizna 700, materiały brutto 369,
      VAT 23%, no wpłaty → „Łącznie" printed brutto 1230 while „Pozostało brutto" three rows below
      printed 1314,87 — the same debt at two amounts on one screen, the 84,87 gap being exactly VAT
      on a materiały receipt. Now `resztaGross = combined.gross − paidNet`: the gross-up runs on
      „Łącznie", where materiały already sits at face value on both axes, and the wpłaty come off
      after it. **This changes money in tryb mieszany** — see the close-out note.
      test: test-driven-debugging · unit — three `computeMixedSettlement` brutto-section specs
      rewritten to the new rule plus two new ones, incl. a case at `materialsNetRate ≠ vatRate`
      (the old fixture passed the two as equal, which is precisely why the bug hid) and one
      asserting `resztaGross` reconciles with `combinedPair` and is NOT `doRozliczeniaNet × (1+VAT)`

- [x] 🟡 WARNING · fixed · code-review · `summary-panel-content.tsx:245` · the settings popover got
      the **stored** `materialsNetRate` while the Materiały tab got `effectiveNetRate`, so at tryb
      brutto one surface printed „Netto" (plus the saved stawka) and the other „Brutto" — one setting
      answering its own question two ways on one screen. Both now take `effectiveNetRate`; the lock
      reason is derived once in the panel and passed to both, so they cannot drift apart again.
      Nothing is lost — the rate is kept, not cleared, so switching back to netto restores it.
      test: no automated test — a prop-threading fix across two render surfaces of one control; the
      settlement-block E2E (EX-651) is where it would be asserted

- [x] 🟡 WARNING · dismissed by owner ruling (2026-08-07) · impl-review ·
      `blocks/settlement-summary.tsx` · both money columns stand in the client-facing preview too.
      Side effect collected: `settlementModeToPanelAxis` + `PanelAxisT` **deleted**, the only
      surviving question being `settlementMode === 'MIXED'`

- [x] 🟡 WARNING · fixed by owner ruling (2026-08-07) · impl-review · `settlement-groups.ts:93` ·
      „Do zapłaty netto" carried `danger` like its brutto twin, so two red closing figures stacked
      and read as two debts. Red dropped, bold kept
      test: TDD · unit — `settlement-groups.test.ts` pins the asymmetry at a `doZaplatyNet > 0`

- [x] 🔵 OBSERVATION · fixed · code-review · `materials-net-pricing-control.tsx:37`,
      `tabs/summary-expenses-tab.tsx:92` · `Math.round(rate * 100)` displayed a saved 7,5% as **8%**
      and then persisted the 8 on the next „Zapisz" — a display rounding that corrupted the stored
      value on re-save
      test: no automated test — folded into the shared `ratePercent` below, whose contract is the
      thing worth pinning; deferred with EX-651's settlement-block E2E

- [x] 🔵 OBSERVATION · fixed · code-review · `vat-rate-field.tsx:23` · `tree.vatRate * 100` rendered
      `28.999999999999996` at a stored 0,29, and `DecimalField`'s „Zapisz" then stayed **permanently
      armed**: the committed 29 never matched the value read back, so `typed` never resynced. Same
      root as the finding above; one fix closes both

- [x] fixed · simplify · `lib/kosztorys/format.ts` · five sites converted a stored rate to a display
      percent with three different formulas (`* 100`, `Math.round(* 100)`, a local `toLocaleString`).
      Unified into `ratePercent` (numeric, for the fields) + `ratePercentText` (pl-PL prose, no
      suffix). `materials-breakdown-table.tsx` had already got this right **and documented the exact
      7,5 → 8 trap** — that was the tell

- [x] fixed · structure-scatter · `components/kosztorys/summary/inline-mode-select.tsx` → moved to
      `components/ui/`. It carries no kosztorys knowledge at all (label / value / options /
      description) and both its callers are tabs, not the summary root

- [x] fixed · module-cohesion · `summary/materials-pricing-options.ts` split · `PricingModeT`,
      `pricingModeOf`, `materialsNetRateForMode` moved to `lib/kosztorys/materials-pricing-mode.ts`,
      mirroring the existing `settlement-mode.ts` / `settlement-mode-options.ts` split — and for the
      same stated reason: the lucide **value** import must not ride along with the mode logic

- [x] fixed · code-review · `lib/kosztorys/settlement.ts:6,10` · three dead imports (`toGross`,
      `stageValueGrossKey`, `stageValueNetKey`) left by the branch's edits. Removed; gated on tsc

- [x] fixed · comment-noise · `blocks/settlement-summary.tsx:24` · vanished-state tail („it no longer
      decides which columns exist") pointing at the deleted `PanelAxisT`. Rewritten to state the
      present rule and attribute the ruling

- [x] fixed · comment-noise · `grid/summary-row.tsx:55` · „`hint` used to hide behind a hover-only
      tooltip icon; it now…" — vanished-state. Rewritten as the standing reason (a hint explains how
      the figure beside it was reached, which is what a reader must hover to discover they needed)

- [x] fixed · impl-review · `2026-07-29-netto-expense-grossup/change.md:66` and
      `review-gate.md:39` · both recorded the materiały-rate control as **hidden** at tryb brutto,
      which commit 3975ffc3 reversed to greyed-out-with-a-reason. Corrected in place, with this
      gate's effective-rate fix recorded alongside

- [x] fixed · impl-review · `context/foundation/manual-checks.md:704` · the check named the „Marża"
      tab, hidden since 2026-08-07 (`TODO(EX-649)`) — unrunnable as written. Narrowed to „Wydatki"
      with the exclusion and its condition recorded

- [x] fixed (EX-650, done same day rather than deferred — owner, 2026-08-08) · module-cohesion ·
      `lib/kosztorys/settlement.ts` · a grab-bag of 399 LOC / 18 exports with four reasons to change.
      **Deleted and split into five flat siblings**, matching the directory's convention (no barrels,
      no subdirs anywhere under `lib/kosztorys/`) so every import names the concern it reached for: - `settlement-view.ts` (30) — which etapy belong to a price view - `settlement-rows.ts` (79) — one row's pomiar / wartość / pozostało - `settlement-aggregates.ts` (152) — the etap axis, section subtotals, empty sections - `settlement-client-totals.ts` (84) — the figures the robocizna/rabat recon compares - `subcontractor-due.ts` (69) — the plane-aware crew settlement, filed beside its
      `subcontractor-price-*` / `subcontractor-summary` neighbours
      The dependency order came out acyclic and one-directional (view ← rows ← aggregates ←
      client-totals; subcontractor-due depends on none of them), which is the evidence the seams were
      real rather than cosmetic. All 16 importers repointed; no barrel, no re-export shim.
      test: no automated test — a pure move; the 444 existing specs are the guard, and they were
      repointed rather than rewritten, so any figure that moved would have failed one

- [x] filed EX-651 · 🟡 WARNING · impl-review · the settlement block has no Playwright spec.
      Deferred to the E2E backlog (`e2e-backlog`) — the block's shape moved under owner rulings all
      the way through 2026-08-07, so a spec written now would pin a moving target
      test: e2e — deferred with the coverage into the tracked issue

- [x] dropped · comment-noise · ~14 sites across the summary tree · the „VAT dotyczy wyłącznie prac"
      rationale is restated in up to six files. Real duplication, but each restatement sits where a
      reader would otherwise re-derive the wrong arithmetic — and the CRITICAL above is what happens
      when that reasoning is _absent_ from one of them. Not worth the churn of centralising

- [x] skipped · housekeeping · untracked `test.js` at the repo root · debris, but **not this
      session's file** — a parallel agent owns the working tree. Flagged, not deleted

## Simplify pass

Ran inline in the main thread (serial, after the read-only fan-out) rather than as a separate
`/simplify` invocation — the fan-out's own findings were the input, and every one of them is folded
into `## Findings` above tagged `simplify` / `module-cohesion` / `structure-scatter` /
`comment-noise`. 4 applied, 0 proposed, 1 dropped. No second report file.

## Tests & suite

- `npx tsc --noEmit` — clean
- `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/components/kosztorys` — 444 passed,
  27 skipped (42 files)
- `npx eslint` over the touched trees — clean
- Full suite (`lint` / `test` whole-tree / `test:e2e` / `build`) — **not run**: awaiting the owner's
  go, since the mieszany arithmetic change below may be reverted first
