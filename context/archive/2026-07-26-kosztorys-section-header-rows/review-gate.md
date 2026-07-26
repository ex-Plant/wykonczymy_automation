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
- [x] 🟡 WARNING · dismissed · impl-review · `src/scripts/seed-kosztorys-bands.ts:20` + `e2e/kosztorys-section-headers.spec.ts:57` · the fixture's expected 600 does NOT depend on a persisted view: `usePriceView` keys localStorage per investment (`use-price-view.ts`) and the seed creates a fresh investment each run, so the editor always opens on the `client` default — where the seeded `clientPrice` is the price in play
- [x] 🟡 WARNING · skipped · impl-review · `context/foundation/manual-checks.md:241-252` · all 12 EX-580 boxes unticked → nothing exercised in a browser; verification is tsc + eslint + unit specs. Hard-blocks `Done`/archive by design, so EX-580 goes to **in review**, not archive
- [x] 🔵 OBSERVATION · dropped · impl-review · `kosztorys-editor-body.tsx:151-168` · the `sectionHeader` memo depends on two per-render identities — real, but the whole editor is written this way; changing memo policy here alone is churn without a measurement
- [x] dismissed · tailwind · `src/styles/globals.css:320-327` · unlayered `.kosztorys-grid` block — benign and documented: dsg's own stylesheet is unlayered, so a layered utility loses regardless of specificity
- [x] dropped · tailwind · repo-wide · no Tailwind-aware ESLint plugin — pre-existing, not this diff's debt
- [x] dismissed · feature-first · `grid/cells/section-header-cell.tsx:44`, `grid/kosztorys-synthetic-rows.tsx:24` · column-id literals in the component tier — the repo has no symbolic column-id constants anywhere (`column-config.ts` itself keys its records with raw literals); introducing them for the band alone would be the inconsistency, not the fix
- [x] dismissed · feature-first · `grid/cells/section-header-cell.tsx:44` · `sectionHeaderSlot()` next to the cell it describes matches the folder's established convention (`computed-cell.tsx`, `unit-column.tsx`, `discount-columns.tsx`)
- [x] dropped · feature-first · `e2e/kosztorys-section-headers.spec.ts:34` · the E2E couples to a CSS class — dsg's `rowClassName` hands out only a className, so there is no data-attribute to couple to instead
- [x] dropped · feature-first · change-wide · "band" in prose vs "section header" in identifiers — one is the sheet-side word, the other the code-side one; renaming either way buys nothing
- [x] skipped · cohesion · `kosztorys-editor-body.tsx:101-147` · the 45-line `columnTotals` block is pure and would test better as `buildColumnTotals()` in lib — real, but it is pre-existing („Razem"-row) code this diff only moved past, and extracting it deserves its own review
- [x] dropped · cohesion · `use-kosztorys-editor.ts:1182-1190` · `sectionHandlers` is a fresh object literal each render — same class as the memo observation above
- [x] dismissed · cohesion · `grid/cells/section-header-cell.tsx:12-50` · 6 exports — the four types are the component's own `columnData` contract
- [x] dismissed · cohesion · `src/lib/kosztorys/section-colors.ts`, `column-config.ts` · flagged only on export count; each is one registry with one reason to change
- [x] dismissed · cohesion · `use-kosztorys-editor.ts`, `kosztorys-v2-columns.tsx` · pre-existing size; the split is deferred by EX-515 and this diff shrank the columns module
- [x] dismissed · comment-noise · 7 further flagged comments (`section-header-cell.tsx:146`, `kosztorys-synthetic-rows.tsx:23,36`, `kosztorys-section-actions-menu.tsx:23,50`, `section-header-rows.ts:43`, `seed-kosztorys-bands.ts:1`) · each carries a non-inferable cross-file constraint or justifies an absence
- [x] skipped · scatter · `src/lib/kosztorys/` · 39 flat files, no subdirectories — pre-existing junk drawer, this diff is only the +1; subdividing is its own approved refactor
- [x] dismissed · scatter · `grid/cells/section-header-cell.tsx:12,20,32` · the three context types are the cell's own props contract; every consumer is in the same layer
- [x] dismissed · scatter · `use-kosztorys-editor.ts:298` + `:1189` · `handleRenameSection` bound twice — intentional, the „Sekcja" column stays for copy/paste and sorting

- [x] dismissed · reuse-scan · `SectionDot` vs `ui/count-badge.tsx`, `ui/pie-legend.tsx` · no existing colour-dot primitive; `CountBadge` is a pill with a 99+ cap, not the band's „N poz." text
- [x] dropped · reuse-scan · repo root · the skill asks for a persisted `.reuse-scan.json` homes map — `AGENTS.md` § Important Directories already maps them, and a second copy is the exact smell the scan exists to catch

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
