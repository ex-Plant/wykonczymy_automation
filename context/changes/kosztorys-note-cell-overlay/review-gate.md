# Review-gate ledger — EX-538 (kosztorys long-text cell overlay) · 2026-08-10

Scope: working-tree diff — `src/components/ui/datasheet-grid/long-text-cell.tsx` (new),
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx` (modified), plus the change docs.

Step 0.5 (browser verification) ran in the prior session: two bugs found and fixed (grid painting over
the overlay at `z-20`; a click on the overhanging part of the overlay ending the edit). Both are
recorded as Key Discoveries in `plan.md` and covered by the deferred E2E (EX-657).

Fan-out was scaled to the diff (2 files): `/10x-impl-review` + `/code-review high` in parallel, the
tailwind / comment-noise / file-organization checks done inline, then `/simplify` +
`primitive-reuse-scan`.

## Findings

- [x] 🔴 HIGH · fixed · `code-review` · `long-text-cell.tsx:102` · **Escape moved the cursor a row
      down.** dsg's `stopEditing` defaults to `{ nextRow: true }` (`DataSheetGrid.js:415`), so the
      bare call on the cancel path was identical to Enter's — a cancelled edit walked the selection
      onto the next row, often a section band. Now passes `{ nextRow: false }` explicitly.
      test: no automated test (unit/integration can't reach dsg's selection state) · covered by the
      EX-657 browser spec, case added to the issue, and by the manual-checks box.
- [x] 🟡 MEDIUM · fixed · `impl-review` + `code-review` · `long-text-cell.tsx:108` · **Tab escaped the
      grid mid-edit.** `disableKeys` makes dsg return out of its Tab branch _without_
      `preventDefault` (`DataSheetGrid.js:979`); the stock cell survived that on `tabIndex: -1`, a
      `<textarea>` does not — DOM focus left the grid while it still believed it was editing. Tab is
      now handled in the cell: end the edit, stay put.
      test: no automated test (focus movement is browser-level) · EX-657 case added + manual-checks box.
- [x] 🟡 MEDIUM · fixed · `impl-review` + `code-review` · `long-text-cell.tsx:65` · **commits were no
      longer normalized.** Spreading `textColumn` does _not_ inherit `parseUserInput`
      (`value.trim() || null`) — only the replaced component ever called it — so an emptied cell
      persisted `''` while the same column's `deleteValue` / `isCellEmpty` still spoke `null`, and
      whitespace was kept. The cell now owns that normalization.
      test: no automated test — `trim() || null` is too thin to carry signal on its own; the risk is
      the persisted value, pinned by the EX-657 case and the manual-checks box.
- [x] 🟡 MEDIUM · fixed · `code-review` · `long-text-cell.tsx:98` · **Escape couldn't restore `null`.**
      The cell received `rowData ?? ''`, so a `null` cell typed into and escaped committed `''` — a
      real diff, hence a save, a revalidation and an undo entry, exactly what the Escape guard exists
      to avoid. `value` is nullable end to end now and the guard compares normalized values.
      test: no automated test · EX-657 case added + manual-checks box.
- [x] 🔵 LOW · fixed · `code-review` · `kosztorys-v2-columns.tsx` · **`relative` on the adopting
      columns was inert, and its comment was wrong.** `.dsg-cell` is already `position: absolute`
      (`style.css:58`), and the library's stylesheet is imported unlayered so it outranks Tailwind's
      `@layer utilities` anyway. Class and comment removed; `plan.md` corrected.
- [x] 🔵 · fixed · `impl-review` · `long-text-cell.tsx:73` · focus+select ran from an inline ref
      callback, so its stability — and therefore not re-selecting the value on every keystroke —
      depended on the React Compiler memoizing it. Hoisted to a module-level function.
- [x] 🔵 · fixed · `impl-review` · `long-text-cell.tsx` · dead `className` prop dropped (neither
      consumer passed it; both style through `cellClassName`).
- [x] 🔵 · fixed · `impl-review` · `long-text-cell.tsx:126` · the `z-30` comment cited "under the
      sticky right column", a layer this grid doesn't have (no `stickyRightColumn` is passed).
- [x] fixed · `simplify` · `long-text-cell.tsx:47` · `longTextColumn` + its `CellProps` adapter moved
      out of the kosztorys file into the primitive's own, matching every other custom cell here
      (`cells/unit-column.tsx` exports `unitColumn` beside `UnitCell`). Neither carries domain
      knowledge; the kosztorys file now only names the columns.
- [x] fixed · `simplify` · `kosztorys-v2-columns.tsx` · the `memo()` added for the adapter removed —
      it could never bail out. dsg passes `stopEditing` through unmemoized, and its identity chain
      ends at the inline `onChange` in `kosztorys-editor-body.tsx`, so the shallow compare failed
      every render: pure overhead. (`lessons.md:358-379` already records this chain.)
- [x] fixed · `simplify` · `kosztorys-v2-columns.tsx:335` · the `capitalize` comment blamed Tailwind
      Preflight; the reset is the browser UA sheet. Classes kept, attribution corrected.
- [x] 🔵 · skipped · `impl-review` + `code-review` · `long-text-cell.tsx` · **Shift+Enter newlines
      corrupt the plain-text clipboard.** dsg builds `text/plain` as unquoted TSV, so a cell holding a
      newline copied _out of the app_ splits into two rows in Sheets/Excel; in-app paste survives via
      dsg's `text/html` payload. Not fixed: newlines are the feature, and every fix (escaping on copy,
      stripping on commit) is a behaviour change the owner should choose. Recorded as a known
      limitation in the manual checks and in EX-657.
      test: no automated test · pinned as an assertion in EX-657 so nobody "fixes" it by stripping newlines.
- [x] skipped · `simplify` · `src/lib/utils/enter-escape-keydown.ts` · its `stopPropagation` does not
      stop dsg's co-located `document` listener (this diff proves only `stopImmediatePropagation`
      does), so `EditableCellInput` carries the same latent leak. Behaviour-changing, in a third file
      outside this slice, harmless today (the keys it swallows dsg handles benignly). Recorded on
      EX-657 as a gate follow-up.
- [x] dismissed · `simplify`/`reuse-scan` · `long-text-cell.tsx` · three reuse candidates checked and
      rejected with reasons: `enter-escape-keydown.ts` (would break Shift+Enter, no Tab branch, wrong
      swallow), `use-inline-rename.ts` (controlled + blur-commit vs uncontrolled + per-keystroke), and
      the `disabled` early return (the convention every custom cell here follows).
- [x] dropped · `simplify` · `long-text-cell.tsx:130` · `overflow-auto` is redundant (the UA already
      gives a textarea `overflow: auto`) — one class in a documented string, not worth the churn.
- [x] dropped · `simplify` · `long-text-cell.tsx` · merging the Escape and Tab branches to share three
      lines would re-nest a key check and fuse two load-bearing comments. Net loss.
- [x] fixed · `post-gate` (owner, 2026-08-10) · `lib/kosztorys/header-tips.ts` · **the overlay was
      undiscoverable** — nothing said a bigger editor exists, and Shift+Enter as the newline is
      unguessable. Added a `note` entry to `HEADER_TIPS` (the column's header carried none), naming
      both: how to open the overlay and the four keys inside it. Existing mechanism, no new chrome.
      „opis pracy" has the same overlay and still no tip — deliberately left, owner asked for
      „Komentarz" only.
- [x] fixed · `gate` · `context/foundation/manual-checks.md` · the slice had no section in the QA
      registry, so none of its manual criteria were recorded. Added, including the four gate
      regressions and the bottom-edge clipping case.

## Simplify pass

Ran `/simplify` + `primitive-reuse-scan` — 3 applied, 4 dismissed, 2 dropped, 1 skipped, 0 open; every
finding folded into `## Findings` above (tagged `simplify` / `reuse-scan`).
Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.9oC3bePS4l.md`

## Tests & suite

No new automated tests: the slice's risk is overlay stacking, focus and key handling, none of which a
unit or integration spec can reach honestly. E2E deferred to **EX-657** (`e2e-backlog`, project
Wykonczymy), extended at this gate with the four regressions found here plus the clipboard limitation.

- `pnpm typecheck` — pass (0 errors)
- `pnpm lint` — pass (0 errors, 80 pre-existing warnings in `src/migrations/*`)
- `pnpm exec vitest run` — pass (119 files / 1928 tests, 86 skipped)
- `pnpm build` / `pnpm test:e2e` — not run (user's call at the gate; nothing in this slice touches
  either plane)
