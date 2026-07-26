# Review-gate ledger — 2026-07-26-kosztorys-section-header-rows (EX-580) · 2026-07-26

Diff under review: `2929c530..HEAD` on branch `kosztorys-section-header-rows`.
No `verify-manual-checks` skill in this project → Step 0.5 (browser verification pass) skipped;
the manual checks live in `context/foundation/manual-checks.md` under the EX-580 heading.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.
Mutating pass: `primitive-reuse-scan` + a serial fix pass in the main thread.

## Findings

<!-- Format: [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

- [x] 🔴 CRITICAL · filed EX-584 · impl-review · `kosztorys-editor-body.tsx:227` + `src/lib/kosztorys/synthetic-rows.ts` · a multi-row paste **spanning** a section boundary loses one line — verified in dsg's source (`DataSheetGrid.js:540-600`): paste is strictly positional (`newData[min.row + rowIndex] = …`) and `isCellDisabled` skips only the write, never the index, so marking band cells disabled would NOT fix the shift. Needs a paste interception that re-expands the clipboard around band indices → review-worthy, filed rather than fixed
      test: test-driven-debugging · e2e — recorded in EX-584 so the regression guard travels with the fix
- [x] 🟡 WARNING · fixed · impl-review · `e2e/kosztorys-section-headers.spec.ts:64,74,81` · `expect(await itemOrdinals(page))` was a non-retrying snapshot racing React after the expand click → now `expect.poll`; the „Razem" guard asserted only that the label was visible → now captures the totals row's text before the fold and asserts it unchanged after
      test: e2e — the spec IS the test; this is the guard itself
- [x] 🟡 WARNING · dismissed · impl-review · `src/scripts/seed-kosztorys-bands.ts:20` + `e2e/kosztorys-section-headers.spec.ts:57` · the fixture's expected 600 does NOT depend on a persisted view: `usePriceView` keys localStorage per investment (`use-price-view.ts`) and the seed creates a fresh investment each run, so the editor always opens on the `client` default — where the seeded `clientPrice` is the price in play
- [x] 🟡 WARNING · skipped · impl-review · `context/foundation/manual-checks.md:241-252` · all 12 EX-580 boxes unticked → nothing exercised in a browser; verification is tsc + eslint + unit specs. Hard-blocks `Done`/archive by design, so EX-580 goes to **in review**, not archive
- [x] 🟡 WARNING · fixed · impl-review · `change.md` · the colour-rail rewrite (`8e131593`) + `seed-kosztorys-bands.ts` were described as landed "outside this change" while shipping on this branch — `change.md` now says so, and the plan carries a `## Drift from the plan` section
- [x] 🔵 OBSERVATION · dropped · impl-review · `kosztorys-editor-body.tsx:151-168` · the `sectionHeader` memo depends on two per-render identities — real, but the whole editor is written this way; changing memo policy here alone is churn without a measurement
- [x] 🔵 OBSERVATION · fixed · impl-review · `grid/cells/section-header-cell.tsx` · plan said the whole label block toggles, shipped is the chevron only — deliberate (the rename input owns the rest); now documented in the plan's drift section
- [x] 🔵 OBSERVATION · fixed · impl-review · `grid/kosztorys-synthetic-rows.tsx` · `ordinalGutterColumn`'s placement differs from the plan — better placement, recorded as drift
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/lib/kosztorys/section-header-rows.ts:12-14` · `sectionIdFromHeaderRow` had no production caller — deleted; the spec now asserts the id derivation directly
- [x] 🔵 OBSERVATION · fixed · impl-review · `hooks/use-inline-rename.ts` · blur committed unconditionally, so focusing a name and clicking away fired a redundant rename write — now guarded on `draft !== startedWith`, which fixes the band cell and the „Sekcja" cell at once
      test: no automated test — the hook has no spec harness and the guard is one comparison; covered by manual check EX-580/§rename
- [x] fixed · tailwind · `grid/cells/section-header-cell.tsx:58` · inline `style` for the dot's background → `bg-(--section-rail,var(--color-muted-foreground))`
- [x] fixed · tailwind · `src/styles/globals.css` · rail width / divider width / wash percentages repeated across four rules → four custom properties on `.kosztorys-grid`, each literal written once
- [x] fixed · code-review · `src/styles/globals.css` · the gutter's `color-mix(… var(--section-rail, transparent) 14% …)` made an unpinned gutter 86% opaque, letting scrolled cells bleed through the sticky column — the background now falls back to `--color-background` while the rail keeps `transparent`
      test: no automated test — a pure paint bug with no DOM-observable signal; covered by manual check EX-580/§rail
- [x] dismissed · tailwind · `src/styles/globals.css:320-327` · unlayered `.kosztorys-grid` block — benign and documented: dsg's own stylesheet is unlayered, so a layered utility loses regardless of specificity
- [x] dropped · tailwind · repo-wide · no Tailwind-aware ESLint plugin — pre-existing, not this diff's debt
- [x] fixed · feature-first + cohesion + scatter (three independent reports) · `src/lib/kosztorys/synthetic-rows.ts` (new) · the synthetic-id namespace was split — the lib asserted `id < 0` over two constants living in a client component. All ids, predicates and row factories now live in one lib module; `section-header-rows.ts` keeps only the grouping algorithm, and `kosztorys-synthetic-rows.tsx` imports them back
- [x] fixed · feature-first · `src/lib/kosztorys/synthetic-rows.ts` · `isSyntheticRow` (the whole-namespace predicate) no longer sits under a section-header module name
- [x] fixed · feature-first · `src/styles/globals.css` + `kosztorys-editor-body.tsx` · `kosztorys-section-header` and `kosztorys-section-start` were two class names for one state, always applied together — collapsed to one, and the two CSS rules merged
- [x] dismissed · feature-first · `grid/cells/section-header-cell.tsx:44`, `grid/kosztorys-synthetic-rows.tsx:24` · column-id literals in the component tier — the repo has no symbolic column-id constants anywhere (`column-config.ts` itself keys its records with raw literals); introducing them for the band alone would be the inconsistency, not the fix
- [x] dismissed · feature-first · `grid/cells/section-header-cell.tsx:44` · `sectionHeaderSlot()` next to the cell it describes matches the folder's established convention (`computed-cell.tsx`, `unit-column.tsx`, `discount-columns.tsx`)
- [x] dropped · feature-first · `e2e/kosztorys-section-headers.spec.ts:34` · the E2E couples to a CSS class — dsg's `rowClassName` hands out only a className, so there is no data-attribute to couple to instead
- [x] dropped · feature-first · change-wide · "band" in prose vs "section header" in identifiers — one is the sheet-side word, the other the code-side one; renaming either way buys nothing
- [x] fixed · cohesion · `grid/kosztorys-synthetic-rows.tsx` · four kinds behind one filename — fell out for free once the id namespace moved to lib; the file is now cells + column factories only
- [x] skipped · cohesion · `kosztorys-editor-body.tsx:101-147` · the 45-line `columnTotals` block is pure and would test better as `buildColumnTotals()` in lib — real, but it is pre-existing („Razem"-row) code this diff only moved past, and extracting it deserves its own review
- [x] dropped · cohesion · `use-kosztorys-editor.ts:1182-1190` · `sectionHandlers` is a fresh object literal each render — same class as the memo observation above
- [x] dismissed · cohesion · `grid/cells/section-header-cell.tsx:12-50` · 6 exports — the four types are the component's own `columnData` contract
- [x] dismissed · cohesion · `src/lib/kosztorys/section-colors.ts`, `column-config.ts` · flagged only on export count; each is one registry with one reason to change
- [x] dismissed · cohesion · `use-kosztorys-editor.ts`, `kosztorys-v2-columns.tsx` · pre-existing size; the split is deferred by EX-515 and this diff shrank the columns module
- [x] fixed · comment-noise · `grid/kosztorys-synthetic-rows.tsx:14,20,92`, `kosztorys-editor-body.tsx:100,182,241`, `use-kosztorys-editor.ts:1181`, `section-header-cell.tsx:18,63` · nine comments that restated code, narrated a wrapper, or carried vanished state ("used to sit on…", "not in the row „…" menu") — deleted or trimmed to the non-inferable clause
- [x] dismissed · comment-noise · 7 further flagged comments (`section-header-cell.tsx:146`, `kosztorys-synthetic-rows.tsx:23,36`, `kosztorys-section-actions-menu.tsx:23,50`, `section-header-rows.ts:43`, `seed-kosztorys-bands.ts:1`) · each carries a non-inferable cross-file constraint or justifies an absence
- [x] skipped · scatter · `src/lib/kosztorys/` · 39 flat files, no subdirectories — pre-existing junk drawer, this diff is only the +1; subdividing is its own approved refactor
- [x] fixed · scatter · `grid/cells/` vs `grid/` · the synthetic-row cell renderers were split across two levels under an unstated rule — the shared ⋯ trigger now lives with its twin in `components/ui/datasheet-grid/`, and the remaining split is cells-in-`cells/` vs column-factories-in-`grid/`
- [x] dismissed · scatter · `grid/cells/section-header-cell.tsx:12,20,32` · the three context types are the cell's own props contract; every consumer is in the same layer
- [x] dismissed · scatter · `use-kosztorys-editor.ts:298` + `:1189` · `handleRenameSection` bound twice — intentional, the „Sekcja" column stays for copy/paste and sorting

- [x] fixed · reuse-scan · `components/ui/datasheet-grid/cell-menu-trigger.tsx` (new) · the cell-sized ⋯ trigger was written twice, byte-identical, in `kosztorys-row-actions-menu.tsx` and `kosztorys-section-actions-menu.tsx` — extracted as `CellMenuTrigger` beside its header twin `HeaderMenuTrigger`
- [x] fixed · reuse-scan · `grid/cells/section-header-cell.tsx` · the band's `SectionNameField` re-implemented `SectionNameCell` (same `useInlineRename` wiring, same fallback-to-canonical-value rule) — deleted; `SectionNameCell` took a `className` and the band uses it
- [x] dismissed · reuse-scan · `SectionDot` vs `ui/count-badge.tsx`, `ui/pie-legend.tsx` · no existing colour-dot primitive; `CountBadge` is a pill with a 99+ cap, not the band's „N poz." text
- [x] dropped · reuse-scan · repo root · the skill asks for a persisted `.reuse-scan.json` homes map — `AGENTS.md` § Important Directories already maps them, and a second copy is the exact smell the scan exists to catch

- [x] fixed · simplify · `src/lib/kosztorys/row-ops.ts` · `applyAddItem` appended to the end of the whole array, so an item added while a section filter isolated a middle section left that section's rows non-contiguous — and the band grouping would then emit a second band with a duplicate id (duplicate keys in dsg's virtualizer). It now lands after the last row of its own section; `buildSectionHeaderRows` additionally keeps a `banded` set so a non-contiguous list degrades to a mis-grouped block rather than a corrupt render
      test: TDD · unit — `section-row-ops.test.ts` covers both placements (own-section insert, append when the section is new)
- [x] fixed · simplify · `src/lib/kosztorys/section-header-rows.ts` · a section collapsed before a search stayed collapsed during it, hiding matches behind a band that gives no hint they exist — the grid read as "no results". The fold is suppressed while the search box is non-empty and restored when it clears
      test: TDD · unit — `section-header-rows.test.ts` § "ignores a collapsed section while a search is active"
- [x] fixed · simplify · `grid/cells/section-header-cell.tsx:21` · `SectionHeaderHandlersT.onInsert` took a whole row to read one field — narrowed to `(sectionId, dir)`, and `handleInsertSection` with it
- [x] fixed · simplify · `src/lib/kosztorys/section-colors.ts` · `HUE_SPREAD_ORDER` is a hand-written index permutation with no guard — a typo silently drops one colour and paints another twice. New `section-colors.test.ts` asserts the sequence is a permutation of the palette and that no two adjacent entries share a hue
      test: TDD · unit — `src/__tests__/lib/kosztorys/section-colors.test.ts`

## Simplify pass

Ran the mutating pass serially in the main thread (`/simplify` scope + `primitive-reuse-scan`) —
7 applied, 0 proposed, 4 dismissed/dropped; every finding folded into `## Findings` above tagged
`simplify` / `reuse-scan`. No separate report file: this ledger is the report.

## Tests & suite

- `pnpm typecheck` — pass
- `pnpm lint` — pass (0 errors; 85 pre-existing warnings, all `db` unused in migrations)
- `pnpm exec vitest run src/__tests__/lib/kosztorys/` — 23 files, 296 pass / 14 skipped (skips are the
  DB-backed specs, which need the 5435 container)
- `pnpm test:e2e` — **not run**: it cannot run inside a git worktree (symlinked `node_modules` breaks
  the Turbopack production build). Tracked as **EX-582** (`e2e-backlog`) — run from the main tree once
  this branch merges. Plan row 5.1 stays open for the same reason.

New/changed specs this gate: `section-colors.test.ts` (new), `section-row-ops.test.ts`
(`applyAddItem` placement), `section-header-rows.test.ts` (search-suppresses-collapse, duplicate-band
guard, id derivation), `kosztorys-section-headers.spec.ts` (retrying assertions, „Razem" invariant).
