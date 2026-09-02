# Review-gate ledger — EX-699 / 2026-08-31-kosztorys-row-height · 2026-08-31

Scope: this slice's files only. The working tree is shared with a parallel session
(work-catalogue), whose files are deliberately excluded from every check below.

Reviewed set:

- committed earlier: `patches/react-datasheet-grid@4.11.6.patch`, `src/lib/kosztorys/row-key-diff.ts`,
  `src/lib/kosztorys/text-wrap.ts`, `src/lib/kosztorys/text-measure.ts` (+ their specs)
- uncommitted: `src/styles/globals.css`, `src/hooks/use-element-height.ts`,
  `src/components/ui/datasheet-grid/{read-only-cell-text,read-only-long-text,row-resize-handle}.tsx`,
  `src/components/kosztorys/editor/{kosztorys-editor-body,use-kosztorys-editor}.ts(x)`,
  `src/components/kosztorys/editor/grid/ordinal-gutter-column.tsx`,
  `src/components/kosztorys/editor/hooks/{use-kosztorys-view-state,use-row-height-cache-reset,use-row-heights,use-wrap-column-widths}.ts`,
  `src/lib/kosztorys/{row-height,row-content-height,row-content-lines}.ts` (+ their specs)

## Findings

<!-- One checkbox per finding, most-severe first. source ∈ verify | impl-review | code-review |
     comment-noise | feature-first | module-cohesion | structure-scatter | tailwind | reuse-scan. -->

- [x] 🔵 OBSERVATION · dismissed · impl-review + code-review · `src/components/ui/datasheet-grid/read-only-cell-text.tsx:29` · the editor lost its „…" cue at the resting 32 px — owner's call (2026-08-31): no truncation cue is wanted. The row is the owner's to drag and the popover still shows the whole text, so an ellipsis would buy nothing and would cost the whole-line clip.
      test: no automated test — a visual cue, judged in the browser

- [x] dismissed · impl-review · `plan.md` phases 4–5 · the plan named a spec path AGENTS.md forbids (`__tests__/components/…` for a `lib/` source); the implementation filed it correctly, so the plan was the wrong half.
- [x] skipped · structure-scatter · `use-wrap-column-widths.ts` · `.dsg-*` selectors in a hook rather than in the datasheet-grid seam — the hook has to read the rendered grid, and the seam owner has no way to measure on its behalf. `row-content-height.ts`'s copy of the same knowledge is gone with the file.
- [x] dropped · tailwind · `row-height.ts` × `globals.css` · `ROW_VERTICAL_PADDING = 12` is restated as `5px`/`6px` margins — CSS cannot import the constant, and the split doesn't map onto a single `@theme` token. The comment carries the derivation.
- [x] dropped · code-review · `text-measure.ts` · `widthCache` is unbounded — its ceiling is the document's own character count, on a five-user app.
- [x] dropped · code-review · `use-kosztorys-editor.ts` · a sheet import or snapshot restore orphans height entries, and an undone delete does not restore one — litter only; section and item ids are not reused in production.
- [x] dropped · tailwind · repo-level · no Tailwind-aware ESLint plugin, so arbitrary values are invisible to CI — adding a dependency is out of this slice, and `pnpm install` is hazardous on this machine (AGENTS.md).

## Tests & suite

- `pnpm typecheck`, `pnpm lint`, `pnpm test` — green (3125 passed / 195 skipped / 224 plików).
- `pnpm test:e2e` — nie uruchamiane (ok. godzina na przebieg); ryzyko przeglądarkowe wisi jako EX-757 (`e2e-backlog`).
- Weryfikacja ręczna — przeprowadzona 2026-08-31 w Chromium, wszystkie punkty planu (fazy 1, 3, 4, 5)
  odhaczone z dowodami w `context/foundation/manual-checks.md`, sekcja „EX-699".

_Trimmed at archive (2026-09-02): 22 `fixed` finding(s) removed — a fixed finding's durable record is its commit; what survives is the negative space git cannot hold. Pre-trim tally: 22 fixed, 7 other, 0 open._
