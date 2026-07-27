# Section Footer Row Implementation Plan

## Overview

Split the kosztorys grid's section band in two. The header keeps the section's identity — colour dot,
name, item count, fold chevron — and a new synthetic **footer row** closes each section, carrying its
subtotals under the columns they belong to. The footer folds away with the section's item rows.

This reverts the layout decision in `30a095de`, which folded the band's netto/brutto into the section
name because the money columns are hidden per money axis and the figure vanished. A footer row solves
the same problem without the ambiguity of a bare number sitting outside its column: when a column is
hidden, its footer cell is hidden with it, and the figures that remain are still under their headers.

## Current State Analysis

The band is not a spanning row — dsg has no colspan. `withSyntheticRows`
(`src/components/kosztorys/editor/grid/kosztorys-synthetic-rows.tsx:65`) wraps every column with one
stable module-level component, `SyntheticAwareCell` (`:49`), which branches on `rowData.id`:

- `SPACER_ROW_ID` (-2) → blank
- `TOTALS_ROW_ID` (-1) → `TotalsRowCell` with that column's baked total from the `totals` map
- `isSectionHeaderRow(id)` (`id <= -1000`) → `SectionHeaderCell` with a per-column _slot_
- otherwise → the wrapped column's own cell

Rows are assembled in `buildSectionHeaderRows` (`src/lib/kosztorys/section-header-rows.ts:24`): one
header emitted before the first surviving row of each section, disabled entirely under an active sort
(grouping presumes section-contiguous rows), collapse ignored while a search is active.
`kosztorys-editor-body.tsx:203` appends the spacer and „Razem" after that.

Two independent figure sources feed the two existing synthetic rows:

- **„Razem"** — `columnTotals` (`kosztorys-editor-body.tsx:113`), a `Map<columnId, number>` with full
  column coverage: `net`/`gross`, `plannedNet`/`plannedGross` (client view only), `remaining`/
  `remainingGross`, `discountAmount`/`discountAmountGross`, `plannedQty`, `stageQtySum`, and per-etap
  `stageKey`/`stageValueNetKey`/`stageValueGrossKey`.
- **Sections** — `sectionSubtotalsForView(rows, stages, view)` (`src/lib/kosztorys/settlement.ts:294`),
  computed over the **full dataset** so a search narrows visible rows without moving a section's total.
  Per section it yields `net`, `plannedNet`, `discount`, `share`, `completionRatio`, `itemCount`. The
  band is currently handed only `{ net, gross, itemCount }` (`kosztorys-editor-body.tsx:164`).

`SectionSubtotalT` carries **no per-etap figures, no `remaining`, no `plannedQty`** — those exist only
as grid-wide maps in the hook. That is the boundary of what the footer can fill without new math.

`remaining` is the near-miss worth naming: it is not `plannedNet − net`. It is a per-row loop
(`use-kosztorys-editor.ts:388`) that **skips rows with no przedmiar** — no offer to subtract from — and
grosses each row at its own `vatRate`. Section-scoping it means grouping that loop, which is new math
and therefore out.

## Desired End State

Each section in the grid reads as a block: a header naming it, its item rows, and a closing footer
whose figures sit directly under `Wartość netto`, `Wartość brutto`, the przedmiar pair, and the rabat
pair. Folding a section hides both its item rows and its footer, leaving just the header line. The
grand „Razem" at the bottom is unchanged, and Σ of the section footers still equals it.

Verify: open a kosztorys with ≥2 sections, confirm each footer's netto sits under the netto column and
matches what the band used to show in its label; confirm folding removes the footer; confirm switching
the money axis to netto-only hides the brutto footer cell along with its column.

### Key Discoveries

- The archived plan already frames the band as _"a totals row scoped to one section"_
  (`context/archive/2026-07-26-kosztorys-section-header-rows/plan-brief.md`). The footer is that
  framing taken literally — no new concept, a fourth branch in an existing chain.
- `isSectionHeaderRow` is `id <= SECTION_HEADER_ROW_BASE` with **no lower bound**
  (`src/lib/kosztorys/synthetic-rows.ts:16`). A footer id placed below it is classified as a header —
  it would render `SectionHeaderCell`, take the 52px band height, and get the band's cell wash. This
  predicate must gain an upper-bounded range before any footer id exists.
- `id < 0` is the single predicate the grid's `onChange` filters on
  (`kosztorys-editor-body.tsx:258`), and it is documented as such in `synthetic-rows.ts`. A footer in
  the negative namespace needs no new filter site.
- `viewRows` deliberately does not filter collapsed sections (`use-kosztorys-editor.ts:356`); the fold
  happens entirely in `buildSectionHeaderRows`. The footer's fold is one `continue` in the same loop.
- `ordinalByRowId` (`section-header-rows.ts:27`) is **dead in production** —
  `kosztorys-editor-body.tsx:191` destructures only `{ rows }` — but is still asserted by the unit
  spec. Not this change's business; do not extend it to footers, and do not delete it here.
- Prior art for the exact shape being restored: `30a095de` shows the pre-existing `'net' | 'gross'`
  slots that painted `formatNet(...)` under their own columns. The footer's slot map is that mapping
  generalised.

## What We're NOT Doing

- **No new figure math.** `sectionSubtotalsForView` is not touched. Columns it cannot supply render
  blank: `remaining`, `remainingGross`, `plannedQty`, `stageQtySum`, and every per-etap qty and
  wartość column.
- **No footer under an active sort.** Bands vanish there already; the footer follows the same switch.
- **No footer when the section is folded.** The owner's explicit call — the footer belongs to the rows
  it sums, so it goes when they go.
- **No E2E for the footer in this change.** Deferred to the `e2e-backlog` (see Phase 2).
- **No paste-path work.** EX-584 (a multi-row paste spanning a section boundary loses a line) is a
  pre-existing band defect; the footer inherits it and does not worsen it.
- **No cleanup of the stale ordinal assertions** in the E2E, beyond removing the band-money ones that
  this change actually breaks.

## Implementation Approach

Mirror the header mechanism at every layer rather than inventing a parallel one: a sibling id base, a
sibling row factory, a sibling predicate, a sibling slot mapper, a sibling cell component, a fourth
branch in the same `SyntheticAwareCell`. The one place the two genuinely differ is the figure lookup —
the header reads `itemCount`, the footer reads a `Map<columnId, number>` built per section, exactly
the shape `TotalsRowCell` already consumes.

Building the footer's figures as a per-section `Map<columnId, number>` (rather than a struct of named
fields) is what keeps the "only the columns we can" rule honest: a column with no entry renders blank
by construction, so adding a section-scoped figure later is a one-line addition to the map and needs
no change to the cell.

## Critical Implementation Details

**The dsg cell-identity trap.** `SyntheticAwareCell` must stay a single module-level component and the
footer's data must ride on `columnData`, never in a fresh closure per `withSyntheticRows` call.
`columns` is rebuilt every render; a per-call closure gives every cell a new `component` identity, and
dsg remounts a cell whose component type changed — tearing down the focused `<input>` mid-edit and
dropping all but the last character typed. This is documented at
`kosztorys-synthetic-rows.tsx:42-48` and is the reason that file's shape looks indirect.

**Ordering.** The footer id range and the bounded `isSectionHeaderRow` must land in the same edit. A
footer row emitted while the predicate is still an open floor renders as a header.

---

## Phase 1: Footer row exists and renders

### Overview

The footer becomes a real synthetic row kind: it has an id range, a factory, a predicate, an emission
point, a cell, and a paint. At the end of this phase the money appears in both the header and the
footer — deliberate, so the footer can be verified in the browser against the figure it is replacing.

### Changes Required

#### 1. Id namespace

**File**: `src/lib/kosztorys/synthetic-rows.ts`

**Intent**: Give the footer its own id range and close the open floor under the header's, so the two
kinds cannot be confused. Add the factory that stamps a footer row with the section identity its
cells read out.

**Contract**: `SECTION_FOOTER_ROW_BASE`, `sectionFooterRowId(sectionId)`, `isSectionFooterRow(id)`,
`makeSectionFooterRow(row)` — mirroring the header quartet. `isSectionHeaderRow` becomes a bounded
range rather than `id <= SECTION_HEADER_ROW_BASE`; the file's header comment (which declares the whole
namespace so the `id < 0` predicate can be checked against it) gains the footer.

The bases must be far enough apart that no real `sectionId` can bridge them — section ids are DB
serials, so a decimal-order gap is sufficient and should be stated in the comment rather than left
implicit:

```ts
export const SECTION_HEADER_ROW_BASE = -1_000
export const SECTION_FOOTER_ROW_BASE = -1_000_000
```

#### 2. Row assembly

**File**: `src/lib/kosztorys/section-header-rows.ts`

**Intent**: Emit a footer after the last row of each section block, skipped when that section is
collapsed. Same `enabled` switch as the header — under an active sort no footer is emitted at all.

**Contract**: `buildSectionHeaderRows` gains footer emission at each section boundary. Two shapes must
hold: a section whose rows were all filtered away contributes neither header nor footer (the header is
already emitted from the first surviving row — the footer must key off the same fact), and the last
section's footer is emitted after the loop ends, not only on a boundary transition. Footers carry no
ordinal, exactly as headers do not.

The function name now undersells what it returns; renaming it is a Phase 2 concern at most, not a
blocker here.

#### 3. Footer cell

**File**: `src/components/kosztorys/editor/grid/cells/section-footer-cell.tsx` (new)

**Intent**: Render one column's piece of the footer — the caption in the identity column, a formatted
figure where the section has one, blank everywhere else.

**Contract**: `SectionFooterCell({ rowData, columnId, context })` plus
`SectionFooterContextT = { figures: Map<number, Map<string, number>> }` — outer key section id, inner
key column id. Caption column is `description`, text `Razem sekcja`. Figures format with `formatNet`
and use the same left-aligned `px-2 tabular-nums` treatment as `TotalsRowCell`, so a footer figure
lines up with the column's own values and with „Razem" below.

Unlike the header, the footer needs no slot enum: the column id _is_ the lookup key. Introducing a
parallel `SectionFooterSlotT` would be a second mapping to keep in sync with the columns for no gain.

#### 4. Wrapper branch

**File**: `src/components/kosztorys/editor/grid/kosztorys-synthetic-rows.tsx`

**Intent**: Route footer rows to the new cell, keeping the single-stable-component rule intact.

**Contract**: `SyntheticAwareCell` gains an `isSectionFooterRow` branch after the header branch;
`SyntheticColumnDataT` gains `sectionFooter: SectionFooterContextT` and `withSyntheticRows` threads it
alongside `sectionHeader`. The column id is already available on the wrapped column — pass it through
`columnData` rather than reading it off props.

#### 5. Body wiring

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Build the per-section figure maps from the same `subtotals` the header and Podsumowanie
read, so a footer, „Razem" and the panel cannot disagree. Give the footer row its height and its
paint.

**Contract**: A `sectionFooter` memo over `subtotals`, keyed by section id, each inner map holding
only the columns the subtotal supports:

| column id             | source                                      |
| --------------------- | ------------------------------------------- |
| `net`                 | `section.net`                               |
| `gross`               | `toGross(section.net, tree.vatRate)`        |
| `plannedNet`          | `section.plannedNet` — omitted when `null`  |
| `plannedGross`        | `toGross(section.plannedNet, tree.vatRate)` |
| `discountAmount`      | `section.discount`                          |
| `discountAmountGross` | `toGross(section.discount, tree.vatRate)`   |

`plannedNet` is `null` outside the client view and the entry is then **absent**, not zero — the same
withholding `SectionSubtotalT` documents, and the columns it would fill are hidden there anyway.
`section.discount` is legitimately `0` under a global discount (which overrides per-item rabat); that
zero is a real figure and is shown.

`rowHeight` keeps `ITEM_ROW_HEIGHT` for footers — it is a one-line total, not a 52px band.
`rowClassName` adds a `kosztorys-section-footer` class alongside the existing `sectionColorRail`, so
the footer inherits the section's rail colour and can be styled independently of the header.

#### 6. Paint

**File**: `src/styles/globals.css`

**Intent**: Give the footer the section's cell wash plus a rule above it, so it reads as the section's
closing line rather than as a second grand total.

**Contract**: A `.kosztorys-section-footer` rule beside the existing `.kosztorys-section-header` block
(unlayered, ~`:366-382`), reusing the same wash and adding a top border. It must be visually lighter
than „Razem"'s `border-t-2` + `bg-muted` — N section footers styled as the grand total would dilute
the real one.

#### 7. Unit specs

**File**: `src/__tests__/lib/kosztorys/section-header-rows.test.ts`

**Intent**: Cover the row-assembly rules and the id-namespace separation, which is where this change
can silently go wrong.

**Contract**: New cases — footer emitted after the last row of each section; the last section's footer
is emitted (loop-tail case); a collapsed section keeps its header and drops its footer; an all-filtered
section contributes neither; no footer under `enabled: false`; `isSectionHeaderRow` and
`isSectionFooterRow` are mutually exclusive across both bases and both reject `-1` and `-2`;
`isSyntheticRow` accepts a footer id.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Section row-assembly specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-header-rows.test.ts`
- Full unit suite passes: `pnpm test`

#### Manual Verification:

- Each section's footer figures sit under `Wartość netto` / `Wartość brutto` and match the figure the
  header's label currently shows for that section
- Σ of the section footers' netto equals the „Razem" netto row
- Folding a section removes its footer along with its item rows; unfolding restores it
- Switching the money axis to netto-only hides each footer's brutto cell along with the brutto column
- In the client view the przedmiar pair is filled; in a subcontractor view those columns (and their
  footer cells) are absent rather than showing zero
- Applying a column sort removes all headers and footers; clearing it restores both
- Typing into an item cell directly above a footer does not drop keystrokes (the dsg remount trap)
- A section with a rabat shows its rabat figure under the rabat columns; a kosztorys with the global
  discount active shows `0,00` there

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 2: Header reverts to identity

### Overview

With the footer proven, the header sheds the money it was carrying and the plumbing that fed it.

### Changes Required

#### 1. Header cell

**File**: `src/components/kosztorys/editor/grid/cells/section-header-cell.tsx`

**Intent**: Return the header to colour dot + name + item count + fold chevron.

**Contract**: `bandMoney` is deleted, along with the `moneyAxis` field on `SectionHeaderContextT` and
the `formatNet` / `MoneyAxisT` imports it needed. `SectionHeaderFigureT` collapses to `{ itemCount }`
— or is dropped in favour of a plain count map, whichever leaves less indirection. The comment on
`SectionHeaderSlotT` explaining why the money lives in the label is now false and must go with it.

#### 2. Body wiring

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Stop feeding the header figures it no longer renders.

**Contract**: The `sectionHeader` memo drops `moneyAxis` and the `net`/`gross` fields (and
`tree.vatRate` from its dep array if nothing else in it needs it). `moneyAxis` stays destructured from
the editor only if another consumer in this file still uses it — gate the removal on `tsc`, not on
grep.

#### 3. E2E spec

**File**: `e2e/kosztorys-section-headers.spec.ts`

**Intent**: Remove the assertions this change makes false, without adopting the spec's unrelated rot.

**Contract**: The band assertions on `formatNet(net)` (~`:55`) are removed; the name and „N poz."
assertions stay, as does the collapse test's „Razem"-unchanged check. The three ordinal assertions
that read the removed numbering gutter (`:72`, `:84`, `:90`) are **left alone** — they are already
broken and are not this change's scope.

#### 4. E2E backlog issue — filed as **EX-610**

**File**: Linear, project "Wykonczymy", label `e2e-backlog`

**Intent**: The footer's whole point is column alignment, and only a browser can prove it. That claim
goes unverified by automation in this change, so it is owed as a filed issue rather than dropped.

**Contract**: An issue covering: footer renders under `net`/`gross`/przedmiar/rabat columns with the
expected values; Σ footers = „Razem"; fold removes the footer; money-axis switch hides the matching
footer cell. Note the EX-582 precedent — `pnpm test:e2e` cannot build inside a git worktree
(symlinked `node_modules`), so the run needs the main tree.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- No stale references remain: `grep -rn "bandMoney\|moneyAxis" src/components/kosztorys/editor/grid/cells/section-header-cell.tsx` returns nothing

#### Manual Verification:

- Each section header shows only the colour dot, name, „N poz." and the chevron — no money
- Renaming a section still works from the header, and the click does not fold the section
- The whole header band is still the fold target
- The client view's read-only header shows the name as plain text (no rename input) and no money
- Filed `e2e-backlog` issue id recorded on the plan

**Implementation Note**: This is the final phase — aggregate both phases' manual verification bullets
into `context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests

Extend `src/__tests__/lib/kosztorys/section-header-rows.test.ts` — it already owns
`buildSectionHeaderRows` and the id-namespace assertions, and the footer is a pure extension of both.
The risk this covers is row assembly: emission points (last section, all-filtered section, collapsed
section) and predicate disjointness, where a mistake silently renders a footer as a header.

No unit spec is added for the figure maps. They are a straight projection of `SectionSubtotalT`, whose
arithmetic is already covered by four specs (`kosztorys-v2-rows.test.ts:329`,
`kosztorys-settlement.test.ts:125`/`:152`, `subcontractor-due-by-plane.test.ts:85`); a spec asserting
that `net` is copied into a map keyed `'net'` would assert the implementation, not a behaviour.

### Integration Tests

None. Nothing crosses the DB or a server boundary — this is grid rendering over figures already
computed client-side.

### Browser E2E

Deferred to the `e2e-backlog` per the decision above. Existing band assertions are pruned in Phase 2
rather than repointed.

### Manual Testing Steps

1. Open a kosztorys with ≥2 non-empty sections in the owner view
2. Read each section's footer netto and compare against the header's current label figure
3. Sum the footers and compare against „Razem"
4. Fold a section; confirm header remains, footer and rows go
5. Switch the money axis to netto-only; confirm brutto column and its footer cells disappear together
6. Apply a column sort; confirm all headers and footers vanish; clear it and confirm both return
7. Open the client share view; confirm przedmiar footer cells are filled and the header carries no
   rename input
8. Click into an item cell directly above a footer and type a multi-character value; confirm no
   keystrokes are dropped

## Performance Considerations

One additional row per section in a grid that already virtualizes. A 1000-item kosztorys with ~40
sections gains ~40 rows — noise against the item count. The figure maps are built in a memo over
`subtotals`, which is already recomputed on every row edit, so the footer adds one pass over sections,
not over rows.

## Migration Notes

None. Synthetic rows are display-only and never persist — `onChange` strips everything with `id < 0`
before the editor's diff sees it, and the footer lands inside that namespace.

## References

- Prior change (the band itself): `context/archive/2026-07-26-kosztorys-section-header-rows/`
- The commit being reverted in spirit: `30a095de` — _style(kosztorys): move the section band's total
  into its label cell_
- Synthetic-row mechanism and the dsg remount trap:
  `src/components/kosztorys/editor/grid/kosztorys-synthetic-rows.tsx:14-48`
- Figure source: `src/lib/kosztorys/settlement.ts:294` (`sectionSubtotalsForView`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Footer row exists and renders

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — addaabb5
- [x] 1.2 Linting passes: `pnpm lint` — addaabb5
- [x] 1.3 Section row-assembly specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-header-rows.test.ts` — addaabb5
- [x] 1.4 Full unit suite passes: `pnpm test` — addaabb5

### Phase 2: Header reverts to identity

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck`
- [x] 2.2 Linting passes: `pnpm lint`
- [x] 2.3 Full unit suite passes: `pnpm test`
- [x] 2.4 No stale references remain: `grep -rn "bandMoney\|moneyAxis" src/components/kosztorys/editor/grid/cells/section-header-cell.tsx` returns nothing
