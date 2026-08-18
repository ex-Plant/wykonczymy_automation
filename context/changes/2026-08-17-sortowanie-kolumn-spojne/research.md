---
date: 2026-08-18T08:40:30+02:00
researcher: Claude (Opus 5)
git_commit: 1ba173a7dc66b0bc3ce5b8dd8c8923edc50d1dc9
branch: staging
repository: wykonczymy
topic: 'Why column sorting in the kosztorys v2 grid is selective, and what it costs to make it universal'
tags: [research, codebase, kosztorys, grid, sorting, columns, EX-486, EX-487]
status: complete
last_updated: 2026-08-18
last_updated_by: Claude (Opus 5)
---

# Research: Consistent column sorting in the kosztorys v2 grid

**Date**: 2026-08-18T08:40:30+02:00
**Researcher**: Claude (Opus 5)
**Git Commit**: `1ba173a7dc66b0bc3ce5b8dd8c8923edc50d1dc9`
**Branch**: `staging`
**Repository**: wykonczymy

## Research Question

Sorting is offered in most kosztorys v2 column headers but not all. Which columns lack it, why,
was that ever a deliberate decision, and what does the change to "every data column sorts" actually
have to touch? Run after `plan.md` was written, so a second question rides along: **does anything
here contradict the plan?**

## Summary

Sorting is not a property of a column — it is a property of **which header helper the column happened
to be built with**. `title()` renders `SortHeader`; `StageHeader` and `stageValueHeader()` know
nothing about sorting; and three `title()` call sites opt out through a `sortable = false` flag. That
is the whole mechanism, and it explains the coverage exactly.

**Nothing about the current coverage was ever decided.** The only written justification in the repo
is commit `8f3f4ab1` (EX-486/EX-487), and it is a limitation note — "a caret over a sort nothing can
resolve" — not a product decision. „Komentarz" received its opt-out as an unremarked third argument
in an unrelated feature commit. Stage headers and stage-value headers were never discussed at all.
The change's premise holds.

**Four findings that change the plan:**

1. **Stage quantity columns need no sort key at all.** `stage_<id>` is a real, typed, always-numeric
   row field, so `columnSortValue`'s `default` branch already resolves it correctly. The comment
   claiming otherwise is simply wrong. Phase 1 shrinks to the stage **value** namespaces plus the
   per-plane pair; the stage-qty work is purely a header affordance.
2. **„Komentarz" needs an explicit empty-value decision the plan doesn't make.** `note` is
   `string | null`, and the `default` branch coerces `null → ''`. Ascending, every row without a
   comment clusters at the **top** — which is most of the grid, so the sort will read as "nothing
   happened". This is the same call the plan already made for „Mnożnik", and it must be made here too.
3. **A pre-existing latent defect sits next door.** The grid's float column writes `null` into a
   cleared cell while the type says `number`. One cleared „Przedmiar" makes that row's key `''`, and
   `sortRows` then degrades the **entire** comparison to `localeCompare` — „10" sorts before „9"
   across every row. Same shape on „Rabat wart.". Not caused by this change; adjacent to it.
4. **Per-stage sorts will start dying on „Problemy" engagement.** `reconcileSort` clears a sort whose
   column left the grid. That machinery is correct, but today it only fires on axis toggles the user
   performed deliberately. With per-stage keys it also fires when a stage-scoped problem filter
   narrows `shownStages` — a place where nobody expects their sort to disappear.

Two of the plan's stated risks are **verified non-issues**: the shared-denominator trap is structurally
safe as written (both call sites pass the unfiltered `stages`, and `rowTotalQtyDone` filters
internally), and the preview/client-share surface cannot grow a menu (`onSetSort` is `editorOnly`).

## Detailed Findings

### The mechanism: one helper owns sorting

`title()` in `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:130-153` is the only
place a `SortHeader` is constructed. It resolves the label from the field id, reads the active sort,
and renders the sort trigger when `opts.onSetSort` is present. A column reaches it or it doesn't:

- 22 columns go through `title(field, opts)` and sort.
- 3 go through `title(field, opts, false)` — `priceMode` (`:283`), `priceCoeff` (`:284`),
  `note` (`:517`).
- Stage quantity columns build `StageHeader` (`:413-422`), which has its own `HeaderMenu` for
  rename / plane / worker / delete and no sort items.
- Stage value columns build `stageValueHeader()` (`:163-170`), a plain tooltip-wrapped label.

The `sortable` parameter has no other caller and no other purpose.

### `columnSortValue` — what actually resolves today

`src/lib/kosztorys/sort-value.ts:24-65`. Thirteen explicit cases for computed figures, then a
`default` that reads `row[field]` and coerces: `typeof value === 'number' ? value : (value ?? '')`.

Auditing every `title()` column against it:

| Column id                            | How it resolves                                         |
| ------------------------------------ | ------------------------------------------------------- |
| `sectionName`, `description`, `unit` | `default` → real row field ✅ (null → `''`)             |
| `plannedQty`, `discountValue`        | `default` → real row field ✅ (see the null trap below) |
| `discountType`                       | `default` → real row field ✅ (null → `''`)             |
| `note`                               | `default` → real row field ✅ (null → `''`)             |
| `priceMode`, `priceCoeff`            | **not row fields** → `''` for every row                 |
| the other 13                         | explicit case ✅                                        |

So of the three `sortable = false` columns, **„Komentarz" already works** — its opt-out blocks a
functioning sort. Only the subcontractor pair is genuinely unresolvable, and the reason is the one
the recon found: the fields are per-plane (`OVERRIDE_FIELDS`), not per-column-id. There is no fourth
silently-broken column; the EX-487 class is fully cleaned up.

### Stage quantity columns already have their key

`treeToRows` writes `stage_<id>` onto every row for every stage, defaulting to `0`
(`src/lib/kosztorys/v2-rows.ts:36`), and `KosztorysV2RowT` carries the index signature
`{ [stageKey: StageKeyT]: number }` (`src/lib/kosztorys/types.ts:207-211`). `row['stage_7']` is
therefore always a number, never undefined, and the `default` branch returns it verbatim.

The comment at `kosztorys-v2-columns.tsx:157-159` — "these columns carry per-stage dynamic ids that
`columnSortValue` has no case for, so a sort trigger here would render an arrow that does nothing" —
is **half wrong**. It is true of the two value namespaces it was written about, and false of the qty
namespace it is read as covering. The plan's reverse parsers in `stage-keys.ts` are needed for the
value keys only.

### The two stage-value namespaces do need cases

`stageValueNet_<id>` / `stageValueGross_<id>` are computed at render
(`kosztorys-v2-columns.tsx:456-479`) and are not row fields, so they resolve to `''` today. The
composition to mirror:

```
stageValueForView(row, row[stageKey(id)] ?? 0, rowTotalQtyDone(row, stages, view), view)
```

with brutto through `toGross(…, row.vatRate)`.

**The denominator is safe as the plan writes it.** The column memoises
`rowTotalQtyDone(row, viewStages, view)` and warns loudly that `shownStages` must never feed it
(`:315-322`) — hiding a column would otherwise reprice the survivors. `columnSortValue` receives the
**unfiltered** `stages` at both call sites (`row-view.ts:111`, `use-kosztorys-editor.ts:798`), and
`rowTotalQtyDone` filters internally by `stageAppliesToView` (`settlement-rows.ts:19-22`), which is
exactly what `stagesForView` does. The two are equivalent by construction — so pass `stages` and do
**not** thread `viewStages` through as a "fix".

### The per-plane pair

`priceMode` / `priceCoeff` exist only outside the client view (`kosztorys-v2-columns.tsx:277-286`).
Their backing fields come from `OVERRIDE_FIELDS[view]` (`constants.ts:5-11`) and the rendered
coefficient from `effectiveCoeff(row, view)` (`calc.ts:58`) — both keyed by `ToolPlaneT`, not
`PriceViewT`. `columnSortValue`'s fourth argument is `PriceViewT`, so the `view === 'client' → null`
guard the plan specifies is not a nicety; without it the code does not type-check.

### Labels block the obvious shortcut

`COLUMN_LABELS` keys the three stage **groups** (`stages`, `stageValueNet`, `stageValueGross`), never
a concrete `stage_7`, and `columnLabelForView` falls back to the raw id
(`column-config.ts:55-56`). Routing a stage column through `title()` would print `stage_7` as its
header. Sorting therefore has to be folded into `StageHeader` and `stageValueHeader()` with the field
id resolved by the caller — which is what the plan already prescribes, for a reason it doesn't state.

### Sort state: owned in one place, persisted nowhere

`useState<SortStateT>(null)` in
`src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:53`, written only by
`setSortField` (`:90-92`). `field` is a bare `string`, so new ids need no type change.

Every persisted view preference — widths, column order, hidden columns, engaged conditions, price
view, money axis, layer, panels — goes to localStorage; **none of them carries the sort**. It is
absent from `client-view-settings.ts`, `serialize-kosztorys.ts`, `serialize-preset.ts`,
`snapshot-format.ts`, every URL param, and the DB. A stored stage id can therefore never outlive its
stage.

That matters, because `stage-keys.ts:7-10` records the opposite decision for hidden columns: stage
ids are deliberately kept out of that map because Postgres reissues a deleted stage's id and a new
stage would inherit the dead one's hidden state. **If anyone later proposes persisting the sort, that
question reopens for `stage_<id>` immediately.** Not part of this change; worth writing down.

Downstream, `sort != null` also disables row insert and both reorder actions
(`use-kosztorys-editor.ts:686, 822, 852`; `kosztorys-v2-columns.tsx:236`), and `sort.scope ===
'global'` drops the section bands (`kosztorys-editor-body.tsx:164-170`). Both key off scope and
presence, never off `sort.field`, so new field ids change nothing there.

### „Zapisz kolejność" is field-agnostic

`display-order-plan.ts:16-27` takes an accessor, not a field name, and delegates to `sortRows`. Every
new key is persistable on arrival, and it operates on the full row set, never the filtered view.

Two sharper edges once sparse keys become sortable: null-keyed rows sink and get baked to the **end**
of each section as real `display_order` (reversible only through the pushed undo command), and a sort
whose key is `''` for every row bakes a no-op that still costs a server round trip and an undo entry.

### The null-key trap on already-sortable numeric columns

`sortRows` (`row-view.ts:38-56`) sinks `null` under both directions, but the moment **either** key is
a string it compares both with `localeCompare(…, 'pl')`. The `default` branch turns any non-number
into `''`. `KosztorysItemT` types `plannedQty` and `discountValue` as `number`, but the grid's float
column is `Column<number|null>` and a cleared cell writes `null` — stated in the code itself at
`calc.ts` (`rowDoneFraction`'s guard rationale) and at `kosztorys-v2-columns.tsx:92-98` ("the cells
are null-safe at runtime").

So one cleared „Przedmiar" flips the whole „Przedmiar" sort to lexicographic ordering of numbers.
This predates the change and is reachable today. It is the same defect shape as the `note` decision
below — the `default` branch's `?? ''` is doing two incompatible jobs.

### Empty strings do not sink

For `note`, `discountType` and (after the change) `priceMode`, the empty state resolves to `''`,
which sorts **first** ascending — the opposite of the `null`-sink contract documented at
`row-view.ts:34-37` and of the „—" the cells render. On „Komentarz" specifically this is the
difference between a useful sort and one that appears broken: most rows have no comment, so
ascending shows a wall of empties before the first real one.

The plan already ruled `null` for „Mnożnik" under „kwota stała" on exactly this reasoning. The same
ruling is owed to „Komentarz", and should be considered for „Źródło ceny" — where `null` means
"dziedziczony", a legitimate third state rather than an absence.

### The sibling branch collides only through the column set

`row-conditions.ts`, `problem-conditions.ts`, `use-condition-row-latch.ts` and `problems-menu-model.ts`
contain zero references to sort. But `shownStages = stagesMatchingEngaged(viewStages, …)`
(`kosztorys-v2-columns.tsx:322`) means engaging a stage-scoped problem removes stage columns, which
removes their ids from `renderedFieldIds`, which makes `reconcileSort` clear the sort
(`use-kosztorys-editor.ts:440-443`). Correct by EX-486's rule; new in that it fires on a filter click
rather than on an axis toggle.

`revealedColumnIds` can bring a column back but deliberately does **not** resurrect the sort (owner
ruling, 2026-07-17, recorded at `use-kosztorys-editor.ts:435-436`). With problem-driven reveals that
round-trip becomes one click, so the ruling is worth re-confirming rather than assumed.

### Surfaces that do not participate

The client preview and share routes run the same hook with `preview: true`, where `editorOnly` nulls
`onSetSort` (`use-kosztorys-editor.ts:328, 404`) — the preview has no sort UI and its `sort` stays
`null`. New sortable columns inherit that for free, and `StageHeader`'s read-only branch is guarded by
the same all-or-nothing `editorOnly` group. No export, PDF, print, or Sheets path reads the sort;
`buildViewRows` has exactly one production caller. Podsumowanie's sortable tables use the `data-table`
primitive and share no code with `columnSortValue` or `SortHeader`.

Non-item rows never enter the sort at all: bands, spacer and totals rows are appended downstream in
`kosztorys-editor-body.tsx:161-172`.

## Code References

- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:124-153` — `title()`, the `sortable`
  flag, and the (incorrect) rationale comment
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:155-170` — `stageValueHeader()` and
  the comment that must be deleted
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:283-284, 517` — the three
  `sortable = false` call sites
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:315-322` — `viewStages` vs
  `shownStages`, and why the denominator must not narrow
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:412-479` — the three stage axes
- `src/lib/kosztorys/sort-value.ts:24-65` — `columnSortValue`, the thirteen cases and the `default`
- `src/lib/kosztorys/sort-value.ts:67-75` — `reconcileSort` (EX-486)
- `src/lib/kosztorys/row-view.ts:34-56` — `sortRows`, null-sinking, the string/number branch
- `src/lib/kosztorys/row-view.ts:82-115` — `buildViewRows`, the search → conditions → sort contract
- `src/lib/kosztorys/stage-keys.ts` — the three namespaces, builders only, no reverse parsers
- `src/lib/kosztorys/types.ts:204-211` — `StageKeyT` and the `KosztorysV2RowT` index signature
- `src/lib/kosztorys/v2-rows.ts:36` — every stage key written onto every row, defaulting to `0`
- `src/lib/kosztorys/constants.ts:5-11` — `OVERRIDE_FIELDS`
- `src/lib/kosztorys/calc.ts:58, 140-152` — `effectiveCoeff`, `stageValueForView`
- `src/lib/kosztorys/settlement-rows.ts:14-22` — `rowTotalQtyDone` and its internal view filter
- `src/lib/kosztorys/settlement-view.ts:15-29` — `stageAppliesToView`, `stagesForView`
- `src/lib/kosztorys/column-config.ts:55-56` — the label fallback that prints `stage_7`
- `src/lib/kosztorys/display-order-plan.ts:16-27` — accessor-based renumbering
- `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:53, 90-92, 121-123` — the sort
  state's only home
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:328, 404` — `editorOnly` gating the preview
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:440-443` — `renderedFieldIds` +
  `reconcileSort`
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:792-806` — „Zapisz kolejność"
- `src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts` — the EX-487 harness (note: its single
  stage has `plane: null`, so subcontractor-view cases need planed stages added)

## Architecture Insights

**Sorting is layered exactly right and covered exactly wrong.** The engine (`sortRows`,
`sortRowsWithinSections`) is generic, the key resolver is one central function, the persistence path
is accessor-based, and the reconciliation is id-based. Every one of those layers accepts a new column
for free. The only thing that does not generalise is the header, which is where coverage is decided
by accident.

**`columnSortValue`'s `default` branch is two functions wearing one signature.** For a genuine string
field it means "sort by the text". For a numeric field with a cleared cell, and for a column id that
isn't a field at all, it means "give up quietly" — and `?? ''` makes giving up indistinguishable from
an answer. Both defects in this document (the lexicographic „Przedmiar", the top-clustered empty
comments) come from that single coercion. The EX-487 fix added cases around the default rather than
changing what the default means.

**`stage_<id>` sits on both sides of a fence on purpose.** It is a row field (so `diffRow` saves it,
so the default sort branch resolves it) while the two value namespaces are deliberately not
(`stage-keys.ts:26-29`: a value column under the qty prefix would reach `diffRow` and save
`Number('ValueNet_7')` → `NaN`). That asymmetry is why the qty axis needs no key work and the value
axes do — and why the shared comment covering all three reads as wrong about one of them.

**`reconcileSort` is a cheap answer to a hard problem, and its blast radius is about to widen.**
Deriving validity from the rendered column ids means no column ever has to register or deregister a
sort. The cost is that any mechanism which removes a column silently cancels the user's sort. With
axis toggles that reads as obvious; with problem filters it will not.

## Historical Context (from prior changes)

- **`8f3f4ab1`** — `fix(kosztorys): sort computed money columns + drop orphaned sort (EX-486, EX-487)`,
  2026-07-17. The origin of both `sort-value.ts` and the `sortable` flag. Its message: "Make the
  subcontractor priceMode/priceCoeff headers non-sortable rather than render a caret over a sort
  nothing can resolve." Limitation-framed, and its stated mechanism ("categorical or dash-laden") is
  not the real one.
- **`48847a6f`** — `feat(kosztorys-bridge): komentarz grid column (p3)`, Refs EX-530. Shipped
  „Komentarz" with `sortable = false` as an unmentioned third argument. No rationale in the message,
  the diff, or any doc. Carried through the `3ecda961` label-resolver refactor untouched.
- **`a9945cb7`** — gave `StageHeader` its `HeaderMenu` (rename/delete). Sort items were never
  considered.
- `context/archive/2026-08-13-kosztorys-sort-scope-and-bake/change.md:27-31, 49-56` — the sort is a
  lens, never persisted; „Zapisz kolejność" saves the **result** (`display_order`), not the rule, and
  renumbers each section by the same key regardless of scope.
- `context/archive/2026-08-13-kosztorys-sort-within-sections/change.md`,
  `context/archive/2026-08-15-kosztorys-column-order/` — both about sort **scope** and column order,
  never about which columns sort.
- `context/archive/reviews/2026-07-17-staging-batch.md:28-29, 44` — reviewed EX-486/487 and confirmed
  "all 13 computed cases match their renderers". It audited the correctness of the keys that exist;
  it never asked which columns had no header affordance.
- `context/archive/kosztorys-poc-in-app/kosztorys-poc-in-app-change.md:118` — the original POC ruled
  "**[PEWNE]** sort per kolumna" with no carve-outs. The universal rule is a restoration, not a new
  ambition.
- `context/foundation/lessons.md:1256-1281` — "A deferral rationale written into an issue ages into a
  dependency — re-verify the blocker before planning around it." This change is that lesson's second
  instance: "columnSortValue has no case for it" was a reason not to start that day, written in the
  grammar of a fact about the columns, and later readers took it as one. The stage-qty finding above
  is the proof — the blocker was never true there at all.
- `context/foundation/lessons.md:287-291` — dsg keys header cells by column **index**, so an
  uncontrolled header input renames the wrong entity after a delete. Relevant to phases 2–3: the
  stage headers being extended are exactly the ones that incident touched.

## Related Research

None — this change has no prior research artifact, and no archived research covers grid sorting.
The nearest prior art is the review gate at `context/archive/reviews/2026-07-17-staging-batch.md`.

## Open Questions

1. **„Komentarz" empty state** — `null`/`''` → `null` (sinks, matches the „—" rule and the „Mnożnik"
   ruling) or keep `''` (empties first ascending)? The plan needs this decision before phase 1.
2. **„Źródło ceny" — is `null` an absence or a value?** The plan ranks it `auto 0 < coeff 1 <
amount 2`, i.e. auto is a legitimate low value rather than a missing one. That is defensible for a
   column whose whole question is "how hand-overridden is this row", but it is the opposite treatment
   from „Mnożnik" in the same pair. Worth stating out loud in the plan rather than left implicit.
3. **Does a sort dying on a „Problemy" click need to say so?** Today the sort just vanishes. With
   per-stage keys this becomes reachable from a filter button. Toast, or accept silence?
4. **The lexicographic-numeric defect** (`plannedQty` / `discountValue` with a cleared cell) — fix it
   inside this change while `sort-value.ts` is open, or file it separately? It is pre-existing and
   out of the stated scope, but the fix is one line in the `default` branch and the change already
   owns that function.
5. **Header noise at many etapy** — adding a trigger to 2×N stage-value headers changes a wide part of
   the header row. The plan flags this as a call to make on sight; it stays open until seen.
