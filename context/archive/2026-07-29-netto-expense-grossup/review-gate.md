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

### Closed out 2026-08-07 — the last four boxes

- [x] 🔵 follow-up · dismissed · the informational „ile bez VAT-u" reading is gone on the 95 investments without a materiały rate — deliberately, and the owner confirmed it (2026-08-07) rather than merely tolerated it: with no rate saved the investor is billed the receipt, so a netto twin prints an amount nobody owes. Reviewed on inv 42 „Białostocka 5" against the running app, whose stale render still showed the substituted column (54 090,88 = 56 258,15 ÷ 1,08 + 2 000) and made the substitution visible as arithmetic. Ruling as stated: the materiały rate is the ONLY thing that crosses a netto-billed wydatek — no rate, no crossing, on either axis.

- [x] 🟡 WARNING · dismissed by owner ruling (2026-08-07) · impl-review · `blocks/settlement-summary.tsx:34` · both money columns stand in the client-facing preview too, exactly as in the owner's view — the ruling extends, it was not merely silent on it. Its stated side effect was then collected: `settlementModeToPanelAxis` and `PanelAxisT` are **deleted**, the only surviving question being `settlementMode === 'MIXED'` in `summary-overview-tab.tsx`. `moneyAxis` is gone from that tab's props; the two spec cases that pinned the dead projection are rewritten
- [x] filed EX-650 · module-cohesion · `src/lib/kosztorys/settlement.ts` · genuine grab-bag (399 LOC, 18 exports: view filtering + client totals + subcontractor settlement + row math + section subtotals — four reasons to change). This branch touched ONE line of it; splitting it is its own review-worthy refactor
- [x] filed EX-651 · 🟡 WARNING · owed-a-test · impl-review · browser-level settlement risk · the settlement block has no Playwright spec. Deferred to the E2E backlog (`e2e-backlog` label) rather than authored here — the block's shape was still moving under owner rulings through 2026-08-07, so a spec written now would pin a moving target

### Fixed

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
gate's mutating step was carried out inline instead. Its results were the `fixed` boxes, trimmed at
archive time — notably the `settlement-groups.ts` extraction (the reuse/altitude finding all three
structure audits converged on), the one-home comment dedup, and the tailwind token swap.

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
