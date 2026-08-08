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

- [x] 🟡 WARNING · dismissed by owner ruling (2026-08-07) · impl-review ·
      `blocks/settlement-summary.tsx` · both money columns stand in the client-facing preview too.
      Side effect collected: `settlementModeToPanelAxis` + `PanelAxisT` **deleted**, the only
      surviving question being `settlementMode === 'MIXED'`

- [x] filed EX-651 · 🟡 WARNING · impl-review · the settlement block has no Playwright spec.
      Deferred to the E2E backlog (`e2e-backlog`) — the block's shape moved under owner rulings all
      the way through 2026-08-07, so a spec written now would pin a moving target
      test: e2e — deferred with the coverage into the tracked issue

- [x] dropped · comment-noise · ~14 sites across the summary tree · the „VAT dotyczy wyłącznie prac"
      rationale is restated in up to six files. Real duplication, but each restatement sits where a
      reader would otherwise re-derive the wrong arithmetic — and the CRITICAL in the close-out below
      is what happens when that reasoning is _absent_ from one of them. Not worth the churn of
      centralising

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
- Full suite (`lint` / `test` whole-tree / `test:e2e` / `build`) — not run **at gate time**, pending
  the owner's ruling on the mieszany arithmetic. The ruling kept the fix (see the close-out), the
  branch merged to `staging`, and the pre-push gate (typecheck + whole-tree tests) has run over it
  since. `test:e2e` remains owed as EX-651, non-blocking per the 2026-07-28 ruling.

## Close-out — the mieszany arithmetic change (2026-08-08)

The branch's one CRITICAL finding (`summary-economics.ts:166`) was fixed and the fix **stands** — the
revert considered at gate time was not taken. It is the only change on this branch that moves a
number a client can already have seen, so it is recorded here in full rather than trimmed away with
the other fixed findings.

**The rule that changed.** „Pozostało brutto" used to be computed by grossing up the net remainder
(`toGross(doRozliczeniaNet, vatRate)`) — which applies VAT to **materiały** as well as prace. But
materiały enter „Łącznie" at face value on both axes, because a materiały receipt is already a gross
amount. So the same debt printed twice on one screen at two amounts, differing by exactly the VAT on
the materiały. The remainder is now derived from the figure that already has the split right:
`resztaGross = combined.gross − paidNet` (`summary-economics.ts:166`).

**Who sees a different number.** Only **tryb mieszany**, and only where an investment has materiały
on the brutto axis. Everything netto-only or brutto-only is arithmetically untouched. Where it does
move, it moves **down** by the VAT that was being charged twice — the old figure overstated what the
client owed, so no client was ever undercharged by the bug.

**Why it's safe to leave standing.** The rule is pinned by five `computeMixedSettlement` specs —
three rewritten plus two new — including a case where `materialsNetRate ≠ vatRate` and one asserting
`resztaGross` reconciles with `combinedPair` rather than being `doRozliczeniaNet × (1+VAT)`. The old
fixture passed those two rates as equal, which is precisely why the bug hid for as long as it did.
