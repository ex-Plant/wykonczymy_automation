# Long-text cell overlay for the kosztorys grid — Implementation Plan

## Overview

Long free text in the grid is unreadable: `textColumn` renders a single-line `<input>` inside a 32px
row, so „opis pracy" and „komentarz" clip with no way to see the rest. Replace those two text cells
with one component that stays a truncated one-liner when inactive and, while editing, opens a
`<textarea>` positioned over the cell — the Google Sheets behaviour.

> **Re-verified 2026-08-10** against the tree, three weeks after the plan was written. Two facts had
> moved: every path below (post-EX-515 the grid lives under `editor/grid/`), and `SectionNameCell`
> picked up a second consumer. Phase 2 was dropped as a result — see "What We're NOT Doing".

## Current State Analysis

The grid is `DynamicDataSheetGrid`. `rowHeight` is a function of the row —
`SECTION_BAND_ROW_HEIGHT` (52) for a section band, `ITEM_ROW_HEIGHT` (32) for an item
(`src/components/kosztorys/editor/kosztorys-editor-body.tsx:36,186`). Height is per row and never
content-measured, so wrapping is impossible without an overlay.

Two item columns hold free text (`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`):

| Column                     | Current def                                   | Commit path              |
| -------------------------- | --------------------------------------------- | ------------------------ |
| `description` (opis pracy) | `keyCol('description', textColumn, …)` `:297` | `setRowData` → row patch |
| `note` (Komentarz)         | `keyCol('note', textColumn, …)` `:476`        | `setRowData` → row patch |

Both are already members of `ItemPatchT` (`src/lib/kosztorys/types.ts:40,51`), so persistence needs
no change — `setRowData` flows through the existing diff/autosave pipeline.

A third column, `sectionName`, holds text too, but it is out of scope (see below).

### Key Discoveries

- DSG passes `focus`, `active`, `disabled`, `setRowData`, `stopEditing` to a custom cell
  (`react-datasheet-grid/dist/types.d.ts:9-26`).
- `disableKeys: true` makes DSG's `document` keydown handler skip Enter/arrows/Tab **while editing**
  (`DataSheetGrid.js:980,1031`), which is what hands those keys to the textarea.
- Escape and Shift+Enter are **not** covered by `disableKeys` — DSG handles Escape unconditionally and
  treats Shift+Enter as insert-row. Both must be swallowed in the cell, the way
  `enter-escape-keydown.ts` already swallows keys for `EditableCellInput`.
- `.dsg-cell` sets no `overflow: hidden`, so an absolutely-positioned overlay is not clipped by its
  own cell — and it is **already `position: absolute`** (`style.css:58`), so it is the overlay's
  containing block for free. An added `relative` would be inert anyway: the library's stylesheet is
  imported unlayered (`kosztorys-editor-body.tsx:3`) and so outranks Tailwind's `@layer utilities`.
- `.dsg-row`s are absolutely positioned siblings with `z-index: auto`, so a later row paints over an
  earlier one and the overlay needs its own `z-index`. Clearing the rows is not enough: the grid paints
  the active-cell frame **and its drop shadow** at 20, the selection markers at 20, and the
  expand-rows handle at 25, all later in the DOM (`style.css:131,433,566`). `z-30` clears the lot and
  still sits under the sticky-right actions column (30, later in the DOM) and the header (40).
- The grid resolves a click to a cell **from its coordinates** (`getCursorIndex`), so a click on the
  part of the overlay hanging over other rows re-activates the row underneath and ends the edit. The
  overlay must swallow `mousedown`; `keepFocus` does not help, as it only guards clicks _outside_ the
  grid (`DataSheetGrid.js:645`).
- **Swallowing takes `stopImmediatePropagation`, not `stopPropagation`.** Next's App Router hydrates
  `document`, so React's delegated listeners and the grid's own document listeners sit on the same
  node, and `stopPropagation` never stops a co-located listener. It works only because React's
  listener was registered at hydration, before the grid's effect added its own. (This is why
  `enter-escape-keydown.ts`'s `stopPropagation` doesn't actually keep keys from the grid — it happens
  not to matter there, since the keys it swallows are ones the grid's handling of is harmless.)
- `floatColumnLeft` (`kosztorys-v2-columns.tsx:67`) establishes the spread-and-override idiom.
  Spreading `textColumn` inherits `copyValue` / `pasteValue` / `deleteValue` / `isCellEmpty`, so
  copy-paste keeps working for free.
- **The spread does _not_ inherit `parseUserInput`** (`textColumn.js:127`, `value.trim() || null`) —
  only the component it replaces ever called it. So the overlay owns that normalization itself, or an
  emptied cell persists `''` while the same column's `deleteValue` / `isCellEmpty` still speak `null`.
- `stopEditing`'s own default is `{ nextRow: true }` (`DataSheetGrid.js:415`), so a bare
  `stopEditing()` on the Escape path moves the cursor down a row — the cancel path has to pass
  `{ nextRow: false }` explicitly.
- `disableKeys` makes the grid **return out of its Tab handling without preventing the default**
  (`DataSheetGrid.js:979`). Stock `textColumn` survives that because its `<input>` carries
  `tabIndex: -1`; a natively-tabbable `<textarea>` does not, so Tab must be handled in the cell or
  DOM focus leaves the grid while the grid still believes it is editing.

## Desired End State

Editing either text cell (Enter, double-click, or just typing) opens a textarea large enough to read
and edit the whole value. The grid's resting appearance, row height, and copy-paste behaviour are
unchanged.

## What We're NOT Doing

- **No `sectionName` migration.** The original Phase 2 planned to replace `SectionNameCell` and delete
  it. Since then `section-header-cell.tsx:5` imports it: the section name renders in the 52px section
  **band row** as well as the identity column, so the file has two consumers and cannot simply be
  deleted. An overlay buys nothing there either — a section name is short and the band row is taller
  already. `SectionNameCell` stays as-is.
- **No hover-to-read on inactive cells.** Deferred by the owner pending an eyeball test of the overlay
  alone; revisit only if scanning still hurts.
- No per-row height expansion — rejected during shaping; it breaks the uniform-row look and grows
  every column in the row for nothing.
- No Radix Popover / portal — rejected during shaping; its focus trap fights DSG's keyboard model.
- No change to the autosave, diff, or persistence layer.
- No new E2E fixture (see Testing Strategy).

## Implementation Approach

One presentational cell, dumb about domain: it receives `value` and `onCommit(next)` and knows
nothing about rows, sections, or patches. It lives beside the other DSG primitives in
`src/components/ui/datasheet-grid/` (`read-only-cell-text.tsx`, `editable-cell-input.tsx`) rather than
in the kosztorys tree, because nothing in it is kosztorys-specific.

## Critical Implementation Details

**Commit model — per keystroke, not on blur.** The overlay only exists while the cell is editing, so
it unmounts the instant DSG drops focus, and a removed node fires no blur in Chrome — there is no
end-of-edit moment to write in. So `onChange` commits, exactly like the stock `textColumn`
(`continuousUpdates: true`) it replaces. Escape then restores the value captured at mount, which is by
construction the pre-edit one.

**Focus and select on mount.** DSG starts editing on a printable key **without** preventing its
default, so the textarea must be focused synchronously in the same event or the keystroke is lost, and
selected so that key replaces the value instead of inserting at the caret. A ref callback does both;
mount coincides with focus gain, so no effect is needed.

**`capitalize` on `description`.** The column carried `[&_input]:capitalize` — Preflight resets
`text-transform` on the form control, so it had to target the input. With a `<textarea>` that selector
silently stops matching: the class becomes `relative capitalize [&_textarea]:capitalize`, covering the
resting text and the editor.

---

## Phase 1: Generic long-text cell, adopted by `description` and `note`

### Changes Required

#### 1. The cell component

**File**: `src/components/ui/datasheet-grid/long-text-cell.tsx` (new)

**Intent**: Render a truncated single line at rest and an overlay textarea while editing, so long
values are readable and editable without changing row height.

**Contract**: `{ value: string | null; focus: boolean; disabled?: boolean; onCommit: (next: string | null) => void; stopEditing: (opts?: { nextRow?: boolean }) => void }`.
At rest (and always when `disabled`) it is a `ReadOnlyCellText`. While editing: commit on change,
normalized `trim() || null` the way the stock column's `parseUserInput` did; `Escape` restores the
pre-edit value and stops editing **without moving the cursor**; `Tab` stops editing and keeps focus
in the grid; `Enter` stops editing and moves to the next row; `Shift+Enter` inserts a newline.
The overlay sits at the cell's top-left with an elevated
`z-index`, never narrower than the cell, and sized so a realistic opis is fully visible — a real one
runs ~130 characters, so 26rem wide × 7rem tall is the floor, growing with content
(`field-sizing-content`) up to 16rem. It renders the shadcn `Textarea` primitive rather than a bare
`<textarea>`, so border/background/focus-ring styling stays the app's.

#### 2. Column wiring

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Point `description` (`:297`) and `note` (`:476`) at the new cell while keeping everything
`textColumn` gave them.

**Contract**: A shared `longTextColumn` spreading `textColumn` with `component` and
`disableKeys: true`, passed through the existing `keyCol` helper so key mapping and
copy/paste/delete inheritance are unchanged. It is exported from the cell's own file, the idiom every
other custom cell here follows (`cells/unit-column.tsx` exports `unitColumn` beside `UnitCell`), so
the kosztorys file only names the columns. Each column keeps its `id`, `title`, `minWidth`, `grow`,
and classNames — including the `note` column's `border-l` block divider.

`keepFocus` is deliberately **not** set: the overlay is a child of the cell, not a portal, so DSG's
own click handling already leaves it alone, and `keepFocus` would only trap the user in edit mode
after a click outside the grid.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Existing test suite passes: `pnpm exec vitest run`

#### Manual Verification:

- Editing an „opis pracy" cell with long text opens an overlay showing the full value
- Enter commits and moves to the next row; Shift+Enter inserts a newline; Escape reverts
- The overlay renders above the rows beneath it, not behind them
- Nothing the grid draws shows through the overlay — in particular the active-cell frame and its drop
  shadow (first browser pass, 2026-08-10: it painted over the overlay at `z-20`)
- Clicking inside the overlay keeps editing and only moves the caret (first browser pass: a click on
  the part hanging over another row ended the edit)
- Copy/paste of a text cell still works (Cmd+C on the cell, Cmd+V into another)
- Resting row height and grid appearance are unchanged, and „opis pracy" is still capitalized
- Shift+Enter inside the overlay does not insert a grid row

---

## Testing Strategy

### Unit Tests

None. The change is overlay positioning, focus, and key handling — there is no pure function here
whose test would carry honest signal, and asserting on the component's internal draft state would be
testing the implementation rather than observable behaviour.

### Browser E2E

This is browser-level behaviour, so per `AGENTS.md` the slice owes an E2E. `e2e/` currently has no
kosztorys editor spec at all, so authoring one means building the editor fixture from scratch —
disproportionate to this change. Discharged by **EX-657** (project "Wykonczymy", labelled
`e2e-backlog`), covering: overlay opens on edit, Enter / Shift+Enter / Escape semantics, the
click-inside-the-overlay case, and the stacking case. The manual checks above cover it in the interim.

### Manual Testing Steps

1. Seed a kosztorys with long text: `INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`
2. Open the editor, edit an „opis pracy" cell holding a realistic value — use „szpachlowanie
   połaczeń ścian z gk i wklejanie taśmy wzmacniającej ( (łączenia pęknięć płyt, łączenia płyt gk
   etc.)" — and confirm the overlay shows the whole string without an inner scrollbar
3. Type a multi-line note with Shift+Enter, commit with Enter, reopen — confirm newlines survived
4. Scroll so the edited row is near the bottom edge, open the overlay — confirm it isn't clipped
5. Start editing by typing a letter on a selected cell — confirm it replaces the value rather than
   prepending, and that the letter isn't swallowed

## Performance Considerations

None. One extra element renders per editing cell; there is exactly one at a time.

## Migration Notes

None — no schema, data, or persisted-shape change.

## References

- Shaping notes and rejected alternatives: `context/changes/kosztorys-note-cell-overlay/change.md`
- Sibling DSG primitives: `src/components/ui/datasheet-grid/`
- Key-swallowing precedent: `src/lib/utils/enter-escape-keydown.ts`
- Column customization idiom: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:67`
- DSG cell contract: `node_modules/react-datasheet-grid/dist/types.d.ts:9-26`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Generic long-text cell, adopted by `description` and `note`

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Linting passes: `pnpm lint`
- [x] 1.3 Existing test suite passes: `pnpm exec vitest run`
