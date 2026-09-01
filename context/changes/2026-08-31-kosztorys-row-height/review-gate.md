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

- [x] 🔴 CRITICAL · fixed · code-review · `src/styles/globals.css` · `.dsg-cell { overflow: hidden }` clipped the long-text editing overlay (112 px textarea in a 32 px cell, 81 px invisible). The cell rule was redundant — the stretched text span already clips itself — so it is gone. Verified in the browser: textarea spills 81 px below the cell, read-only spans still clip at exact 20 px multiples.
      test: test-driven-debugging · e2e — filed EX-757 (the cascade is invisible to a unit test)
- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/kosztorys/row-content-height.ts` (deleted) · fit-to-content read `.dsg-cell` from the DOM, but the grid virtualizes columns horizontally, so a double-click on the deliberately-sticky gutter handle fitted a scrolled-away description to one line and persisted 32 px. The fit is now computed from the row's DATA through the same `rowContentLines` the preview uses. Verified at scrollLeft 985 with „Opis prac" absent from the DOM: the row still fits to 52 px, same as at 0.
      test: test-driven-debugging · e2e — filed EX-757
- [x] 🟡 WARNING · fixed · impl-review + code-review · `use-wrap-column-widths.ts` · `headers[index + 1]` assumed absolute column indexing into a horizontally virtualized NodeList — a resize while scrolled measured „Opis prac" against another column. Now looked up by `headerClassName` (`wrapColumnHeaderClass`), and a width once measured is KEPT when its column scrolls out of the DOM.
      test: TDD · unit — the class contract is asserted where it is produced (`row-content-lines`); the DOM half is in EX-757
- [x] 🟡 WARNING · fixed · code-review · `src/styles/globals.css` · the same cell rule clipped the outer half of the column-width handle. Verified after the fix: 8 px wide, 4 px outside the header cell.
      test: no automated test — hit-target regression, cheaper in the manual pass (noted in EX-757)
- [x] 🟡 WARNING · fixed · impl-review + code-review · `kosztorys-editor-body.tsx` · the owner's dragged heights leaked into the client preview (same localStorage origin), against the plan's „klient zawsze dostaje czyste dopasowanie do treści". Both the row override and `headerRowHeight` are now gated on `preview`.
      test: test-driven-debugging · unit — `row-height.test.ts` pins the content-only branch
- [x] 🟡 WARNING · fixed · code-review · `src/lib/utils/text-wrap.ts` × `read-only-cell-text.tsx` · the measurer collapses whitespace runs but `whitespace-pre-wrap` preserves them, so a pasted double space under-counted lines and clipped the row. The cell is now `whitespace-pre-line`, which collapses runs and keeps newlines — layout and measurement agree.
      test: TDD · unit — the existing spec now states which CSS rule it is asserting against
- [x] 🟡 WARNING · fixed · code-review · `use-wrap-column-widths.ts` · widths could be measured in the fallback font's metrics and cached forever under an identical font key; `document.fonts.ready` now triggers a re-measure.
      test: no automated test — a listener, exercised by any cold load
- [x] 🟡 WARNING · fixed · code-review · `use-row-height-cache-reset.ts` · `resetRowHeights(0)` empties dsg's cache, and its `totalSize` then measures the grid as roughly one row — a visible collapse/re-expand on every commit. Now diffed per row (`firstChangedHeightIndex`): a drag invalidates from that row down, and only a preview-side width change still resets everything.
      test: TDD · unit — 5 cases in `row-key-diff.test.ts`
- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/test-plan.md` · the browser risk was never recorded and no E2E was filed while Phase 5 was ticked. Risk #9 added; E2E filed as EX-757 (`e2e-backlog`).
- [x] 🔵 OBSERVATION · fixed · code-review · `row-height.ts` · a corrupted localStorage value reached the grid as `NaN` and blanked it — now `Number.isFinite`, with a spec.
      test: TDD · unit
- [x] 🔵 OBSERVATION · fixed · code-review · `row-resize-handle.tsx` · a right-click or a second pointer started a drag — left button only, and a drag already in flight is not restarted.
      test: no automated test — pointer-button plumbing, no assertable state change
- [x] 🔵 OBSERVATION · fixed · code-review · `row-content-height.ts` · a double-click fitted a section band to 32 px, below its own chrome height — the handle now takes the row's resting height as a floor.
- [x] 🔵 OBSERVATION · fixed · impl-review · `use-kosztorys-editor.ts` · deleting a section left its band's and footer's heights behind; both ids are dropped now.
- [x] 🔵 OBSERVATION · fixed · code-review · `use-element-height.ts` · under React 19 the callback ref's cleanup replaces `ref(null)`, so the detached node stayed reachable and the rAF was never cancelled.
- [x] fixed · feature-first · `row-resize-handle.tsx` · imported a kosztorys constant into `components/ui/datasheet-grid/`, running the one-way seam backwards — it takes `minHeight` as a prop now, like its column twin takes `minWidth`.
- [x] fixed · module-cohesion · `text-measure.ts` · `canvasFontFromStyle` was dead AND reinvented inline in the hook — deleted.
- [x] fixed · impl-review · `row-height.ts` · `linesForHeight` was production-dead (the CSS margin does that clamp) and `ROW_VERTICAL_PADDING` was exported for nobody — both gone.
- [x] fixed · structure-scatter · `text-wrap.ts`, `text-measure.ts` · zero-domain helpers moved from `lib/kosztorys/` to `lib/utils/`, where the repo already keeps generic text mechanics.
- [x] fixed · module-cohesion · `kosztorys-editor-body.tsx` · the resize API was re-declared structurally instead of importing `RowResizeApiT`.
- [x] fixed · comment-noise · `row-height.ts:7` · the comment claimed a drag cannot move a section band, which stopped being true when the override was given precedence.
- [x] fixed · comment-noise · 5 more restatements trimmed or deleted (`text-measure`, `use-row-heights`, `use-kosztorys-editor`, `text-wrap`, `use-element-height`), and the two comments in `use-kosztorys-view-state.ts` that had drifted onto the wrong declaration — including the disclosure-lock rationale, which now sits on the line that does the pinning.
- [x] fixed · code-review · `use-wrap-column-widths.ts:30` · the comment named a re-measure trigger („the summary panel folding") that does not exist.
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
