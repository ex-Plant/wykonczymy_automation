# Review-gate ledger — netto-expense-grossup · 2026-08-07

Scope: the **whole branch** `feat/netto-expense-grossup` vs `staging` — 10 commits, 28 code files.
Reviewed in a detached worktree at `.claude/worktrees/review-netto-grossup`.

Files under review:

- `src/lib/kosztorys/summary-economics.ts`, `src/lib/kosztorys/settlement.ts`
- `src/components/kosztorys/summary/**` (blocks, tables, grid, tabs, controls, panel)
- `src/components/ui/{summary-grid,label-hint-icon,info-tooltip,tooltip,labeled-mode-select,decimal-input}.tsx`
- `src/app/(frontend)/inwestycje/[id]/page.tsx`, `src/components/kosztorys/editor/use-kosztorys-editor.ts`
- `src/__tests__/lib/kosztorys/{summary-economics,kosztorys-empty-sections}.test.ts`

Checks that dropped out: none — all seven fan-out checks apply. Step 0.5 browser pass skipped
(no `verify-manual-checks` skill installed; the owner verifies this slice manually).

**Plan drift, now corrected.** `plan.md` / `plan-brief.md` / `change.md` described the rejected
two-bridge rate model and gated the gross-up on `settlementMode === 'GROSS'`. All three were
rewritten in this pass to record what actually shipped, with the superseded wording struck rather
than deleted so the reversal stays legible.

## Findings

### Open — owed a decision or a Linear issue

- [ ] 🔴 CRITICAL · needs-owner-call · code-review + impl-review · `tabs/summary-expenses-tab.tsx:57` + `summary-economics.ts:69` · „Materiały" netto and „Podsumowanie" Materiały netto disagree **by the whole VAT** whenever no materiały rate is saved — which is the state of all 96 investments today. VAT 23%, grossBase 12 300 → „Wydatki" Razem netto 10 000,00, „Podsumowanie" Materiały netto 12 300,00. The **brutto** sides agree exactly on both paths, which is what makes the netto split read as a slip rather than two deliberate readings. Branch-introduced: on `staging` the Netto column rendered only when a rate governed; the `?? vatRate` fallback arrives with `807b7fad`. Two coherent exits — (a) give `materialsPair`'s netto axis the same fallback, so one rate governs both planes in both tabs (moves a headline figure and flows into „Do zapłaty" netto), or (b) drop the fallback and let the Netto column appear only when a rate governs (smallest diff, no figure moves, but reverts the „answerable on every investment" intent). **Not fixed — picking one is the owner's call, not mine.**
      test: TDD · unit — pin `materialsPair(m, null, vat).net` against Σ `breakdownRowPair(row, vat)` over the same rows, once the reading is settled
- [ ] 🟡 WARNING · needs-owner-call · impl-review · `blocks/settlement-summary.tsx:34` + `settlement-groups.ts` · `MONEY_AXIS = 'both'` is hardcoded **and the block renders under `preview`** — the client share. A netto-settled client now reads a „Do zapłaty brutto" they are not invoiced. The ruling that both columns always stand was about the owner's own view; nothing covers the client-facing one. Side effect: `settlementModeToPanelAxis`'s `'net'`/`'gross'` arms are dead — only `'mixed'` is read, so it can collapse to a boolean `isMixed` once confirmed
- [ ] 🟡 WARNING · needs-owner-call · impl-review · `settlement-groups.ts` (mieszany branch) · „Do zapłaty netto" silently changed meaning. In the deleted `mixed-summary.tsx` it was `doRozliczeniaNet` and sat at the **bottom of the faktura tor** labelled „lub gotówką netto", so it read as _or_. It is now `mixed.doZaplatyNet`, promoted to the netto tor's headline with `bold`+`danger` — two bold red closing figures that plausibly read as two debts. It also deducts the _other_ tor's wpłaty, which don't appear in that table, so the netto tor can't be reconciled top-down — the exact failure the one-column-per-tor split exists to prevent. **Arithmetic is correct; placement and styling are what mislead.** Fix would be to restore the „lub gotówką netto" label and drop `bold`/`danger`, or move it back under „Do zapłaty brutto"
- [ ] deferred · module-cohesion · `src/lib/kosztorys/settlement.ts` · genuine grab-bag (399 LOC, 18 exports: view filtering + client totals + subcontractor settlement + row math + section subtotals — four reasons to change). This branch touched ONE line of it; splitting it is its own review-worthy refactor. **Box stays open until filed in Linear** (project „Wykonczymy") with its id recorded
- [ ] 🟡 WARNING · owed-a-test · impl-review · browser-level settlement risk · per AGENTS.md a browser-level slice owes its E2E — the settlement block has no Playwright spec. Either author it under `e2e/` or file it as `e2e-backlog` in Linear before archive

### Fixed

- [x] 🟡 WARNING · fixed · code-review + impl-review · `summary-investment-settings.tsx` · the materiały-rate control rendered at tryb brutto while `summary-panel-content.tsx` forced `effectiveNetRate = null` there — a control that persists a stawka moving no figure, and printed a phantom „23 % (−18 699,19 zł)". **Restored the `settlementMode !== 'GROSS'` gate on the control**, keeping the rate half: verified that `investment-financials.ts:89` hard-zeroes the concession at GROSS server-side, so un-gating the rate instead would have made the panel disagree with marża/bilans
      test: no automated test — a render gate on a popover; the E2E above is where it would be asserted
- [x] 🟡 WARNING · fixed · impl-review · `lib/kosztorys/chart-slices.ts` · the expense pie sliced `row.net` raw while the table beside it routed every row through `breakdownRowPair` — a `netBilled` row contributed `net × (1+rate)` to „Razem" but bare `net` to the pie. `expensePieSlices` now takes the rate and slices on the brutto plane; the false „the reduction is uniform" comment is gone
      test: TDD · unit — new `__tests__/lib/kosztorys/chart-slices.test.ts` asserts Σ slices === Razem at a saved rate and at none
- [x] 🟡 WARNING · fixed · code-review + impl-review · settlement rows · „Do zapłaty brutto" took `danger` from `doZaplaty.net`; the axes straddle zero independently, so a real brutto debt rendered un-alarmed on a slightly-overpaid netto. Each row's tone now comes from its own amount
      test: TDD · unit — the sign-split case in `__tests__/components/kosztorys/summary/settlement-groups.test.ts`
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/lib/kosztorys/summary-economics.test.ts` · the three missing success-criteria cases authored: a negative row keeps its sign and ratio (the „Korekta (bez kategorii)" −14,29 case Phase 1 exists to fix, previously untested at any layer), a `gross`-origin row at `netRate = null`, and `materialsPair` with `netRate = null` — the path that actually fires in production and the reason the Materiały divergence above got through
- [x] 🔵 fixed · impl-review · `summary-economics.ts:112,145,188` · `materialsNetRate: number | null = null` was **defaulted** while `vatRate` was required, so an omitted rate silently picked the fallback. Defaults dropped; the two call sites that relied on them now pass `null` explicitly
- [x] 🔵 fixed · code-review · `tables/materials-breakdown-table.tsx` · header said „Netto (bez VAT {n}%)" for what is the materiały concession whenever one is saved, and `Math.round` made the printed formula stop reproducing the printed figures at a fractional rate (7,5% → „8%"). Header is now bare „Netto"; the footnote carries the unrounded rate
- [x] 🔵 fixed · code-review · `src/components/ui/info-tooltip.tsx` · the comment attributed the click-toggle to a handler on the same element; it works by `defaultPrevented` suppressing Radix's handler on the **wrapping Trigger**. Rewritten to name the parent, so a refactor that unwraps it can't silently kill touch access to every hint
- [x] 🔵 fixed · impl-review · stale comments the diff falsified · `summary-economics.ts:53` and `blocks/settlement-summary.tsx:45` both claimed `netBilled` is „frozen at face value" (true on the netto axis only — it now bridges to brutto); `settlement-summary.tsx:62-64` claimed the rate drives an „Obniżka materiałów" line that lives in the hidden Marża tab; `summary-panel-content.tsx:216` claimed two consumers of `doZaplaty` where there is one; `investment-summary-panel.tsx:105` claimed an action row that no longer exists
- [x] 🔵 fixed · impl-review + code-review · `{change,plan,plan-brief}.md` · all three asserted the rejected model (two rates, gross-up only at `GROSS`) — the opposite of what ships, and what a future reader finds first. Rewritten with the superseded wording struck; the six `plan.md` Progress boxes ticked, the last two annotated as having landed as their inverse; `change.md` gained a section recording the Marża-tab hide, both-columns-always, and the rate-control gate
- [x] fixed · feature-first · `tabs/summary-overview-tab.tsx` → new `summary/settlement-groups.ts` · ~70 lines of pure `→ SettlementGroupT[]` view-model extracted out of the component file (flagged independently by all three structure audits). `SettlementGroupT` moved off `summary-totals-table.tsx` onto the module that produces it; the tab is down to one call. The mieszany branching is now unit-testable without mounting the tab — which is exactly what the new spec does
- [x] fixed · comment-noise · the one-column-per-tor rationale was written in four homes (`summary-totals-table.tsx` twice, `settlement-summary.tsx`, `summary-overview-tab.tsx`) — kept ONE, at the type that encodes the decision; trimmed the rest plus the vanished-state tails
- [x] fixed · tailwind · `src/components/ui/tooltip.tsx:47` · `rounded-[2px]` → `rounded-xs` (the theme override leaves `--radius-xs` stock, so a 1:1 token swap)

### Dismissed / dropped / skipped

- [x] dropped · code-review · `tabs/summary-overview-tab.tsx` · „Wpłaty netto" and „Wpłaty brutto" link to the same unfiltered deposit list — real, but the transfers list's query contract (`investment-transfers-href.ts` / `buildTransferFilters`) has no `vatPlane` dimension at all. Adding one is a feature, not a review fix; the link still lands on the right list, only broader than its label promises
- [x] dismissed · code-review · `settlement-summary.tsx:38` · settlement kwoty right-align under the breakdown's Brutto heading — the equal-width columns are the owner's explicit instruction („te kolumny mają być równe")
- [x] dismissed · code-review · `settlement-summary.tsx:34` · mieszany shows a Łącznie brutto no settlement step consumes — the owner ruled both money columns always stand
- [x] dropped · code-review · `summary-panel-content.tsx:219` · `computeDoZaplatyRM` computed then ignored on the mixed branch — pure and cheap
- [x] dismissed · impl-review · `summary-panel-content.tsx:193` · Marża tab hidden, unplanned, and it hits the investment page panel too — but it carries `TODO(EX-649)` with a restore recipe and keeps the whole `SummaryMarginTab`/`calculateMargin`/`financials` plumbing live. A coherent parked decision; now recorded in `change.md`
- [x] dismissed · impl-review · guardrails · `git diff --name-only staging...HEAD` confirms nothing under `src/lib/{db,queries,actions}`, `src/types`, `src/collections`, `src/migrations` moved — `deriveFinancials`, `totalMaterialCosts`, `calculateBalance`/`calculateMargin`, the investments listing, `preview-kosztorys.ts` and `/raporty` untouched exactly as planned, and no migration
- [x] dropped · impl-review · `decimal-input.tsx:17` `w-14 → w-20` is global (hits `vat-rate-field`, `materials-net-pricing-control`, `kosztorys-global-settings`, `rabat-value-field`) — intended, and four of those hold two-digit percentages that read better wide
- [x] dropped · impl-review · the three `roundToCents` rabat-field limbs have no regression test (only `emptySectionIds` got one); the round-before-no-op-check does swallow a sub-grosz edit, which is the point of quantizing to grosze
- [x] dismissed · scatter · `blocks/` vs `tables/` vs the loose `summary/` root · a coherent split (composite section / single table / panel shell + settings); the branch added no file to the root — `settlement-groups.ts` is the first, and it is a sibling of the block it feeds
- [x] dismissed · scatter · both deletions · `mixed-summary` folded into one block with zero orphans; `investment-settings-link` removed with its consumer
- [x] dropped · scatter · `?ustawienia=1` · `grep -rn ustawienia src` returns zero hits — nothing ever read that param, so the deleted deep-link was already inert. Only worth revisiting if one-click-from-investment-page is still wanted
- [x] skipped · scatter · `summary/` root holds 12 files across 4 kinds — mild junk-drawer, NOT deepened by this branch; a `controls/` subdir is the fix if it ever matters
- [x] skipped · module-cohesion · `summary-economics.ts:206-245` · the deposit VAT-plane bucketing (`bucketDepositsByPlane`, `DepositTallyT`) is off-topic for an economics module — takes ledger rows not derived numbers, zero internal coupling. Pre-existing; the branch's edits to this file are all on-topic
- [x] dismissed · feature-first · `summary-economics.ts:29` · `breakdownRowPair` placement — right tier, right module, consumer pulls it rather than re-deriving
- [x] dismissed · feature-first · deletions + all `components/ui/` edits — no orphans, no domain copy left in the primitives tier; the `noVat` removal moved domain knowledge OUT of `ui/`, the right direction
- [x] dropped · feature-first · `src/components/ui/label-hint-icon.tsx:23-29` · the `noStages` variant still hard-codes kosztorys copy in a primitive — pre-existing, and the module's header shows it's a deliberate convention
- [x] dropped · module-cohesion / tailwind · `src/components/ui/summary-grid.tsx:10,12` · `SUMMARY_LABEL_COL`/`SUMMARY_VALUE_COL` as TS constants inside a component kit rather than `@theme` tokens — they're only ever track-list fragments, never utilities; a token would buy nothing
- [x] dismissed · tailwind · `summary-grid.tsx:29` inline `gridTemplateColumns`; `tooltip.tsx:47` `translate-y-[calc(...)]`; `kosztorys-totals-panel.tsx:25,29` `transition-[height]`/`transition-[visibility]` — grid track lists and one-off arrow geometry are the documented carve-outs, and Tailwind ships no `transition-height` utility
- [x] dropped · tailwind · `tabs/summary-{expenses,overview}-tab.tsx` · `lg:flex-row` (1280) as the stack→row break — deliberate for wide money tables, not an upstream-tier copy artifact
- [x] skipped · tailwind · summary panel-wide · zero `sm:` classes, fixed-track grids overflow under 768 — a responsive concern, out of the v4-syntax remit; route to `responsive-audit` if the panel is ever wanted on a phone

## Simplify pass

**Not run as a separate `/simplify` invocation.** `/simplify` is a user-triggered built-in; the
gate's mutating step was carried out inline instead, and its results are the `fixed` boxes above —
notably the `settlement-groups.ts` extraction (the reuse/altitude finding all three structure audits
converged on), the one-home comment dedup, and the tailwind token swap. If a separate pass is wanted
over the post-fix tree, run `/simplify` now — the shape it would review has changed since the
fan-out.

## Tests & suite

- `pnpm exec tsc --noEmit` — **clean** (worktree needs `src/payload-types.ts` +
  `src/app/(payload)/admin/importMap.js` copied in; both gitignored, neither appears in any diff)
- `pnpm exec eslint` on the touched trees — **clean**
- `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/components` — **440 passed**, 27
  skipped (the DB-backed specs; no `db-test` container in this worktree)
- New specs: `__tests__/lib/kosztorys/chart-slices.test.ts` (2),
  `__tests__/components/kosztorys/summary/settlement-groups.test.ts` (3), plus 3 cases added to
  `summary-economics.test.ts`
- **Full suite (`typecheck && lint && test && test:e2e && build`) not run** — awaiting the user's go
