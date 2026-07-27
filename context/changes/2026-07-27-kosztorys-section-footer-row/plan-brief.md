# Section Footer Row — Plan Brief

> Full plan: `context/changes/2026-07-27-kosztorys-section-footer-row/plan.md`

## What & Why

The kosztorys grid currently prints a section's total inside the section's name row, right of the
label. The owner does not want it there — a figure outside its column is a bare number you have to
decode. Move each section's subtotals into a **footer row** that closes the section, with every figure
sitting under the column it belongs to.

## Starting Point

Sections are marked by a synthetic "band" row opening each block (colour dot, name, „N poz.", fold
chevron, and — since commit `30a095de` — the section's netto/brutto squeezed into the label). The band
is not a spanning row: dsg has no colspan, so every column renders its own piece of it via a branch in
`SyntheticAwareCell`. Per-section figures come from `sectionSubtotalsForView`, computed over the full
dataset so filtering never moves a section's total.

`30a095de` moved the money into the label for a real reason: the netto/brutto columns are hidden per
money axis, so the figure could vanish entirely. A footer row solves that better — a hidden column
simply hides its own footer cell, and every figure that remains is still under its header.

## Desired End State

Each section reads as a block: a header naming it, its item rows, a footer closing it. Footer figures
line up with `Wartość netto`, `Wartość brutto`, the przedmiar pair and the rabat pair. Folding a
section hides its rows and its footer, leaving only the header line. The grand „Razem" at the bottom
is untouched, and Σ of the section footers still equals it.

## Key Decisions Made

| Decision             | Choice                                                   | Why                                                                                                      |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Which columns fill   | Only those `SectionSubtotalT` already supplies           | Owner's explicit constraint — no new figure math; a column with no entry renders blank by construction   |
| Folded section       | Footer hides with the rows                               | The footer belongs to the rows it sums, so it goes when they go — one rule, no state-dependent placement |
| Footer caption       | `Razem sekcja` in the description column                 | Names the scope without repeating the section name, which is three rows up and on the colour rail        |
| Under an active sort | No footer, same as no header                             | Grouping presumes section-contiguous rows; a sort scatters a section into runs, so per-run footers lie   |
| Styling              | Section wash + top border, lighter than „Razem"          | Reads as the section's closing line; N footers styled as the grand total would dilute the real one       |
| Test layer           | Unit only; footer E2E filed to `e2e-backlog`             | Row assembly is where this silently breaks; the browser claim is owed but deferred                       |
| Id namespace         | Footer base `-1_000_000`, header predicate gains a bound | `isSectionHeaderRow` is an open floor today — an unbounded footer id would render as a header            |

## Scope

**In scope:**

- A footer synthetic row kind: id range, factory, predicate, emission, cell, paint
- Per-section figure maps for `net`/`gross`, `plannedNet`/`plannedGross`, `discountAmount`/`discountAmountGross`
- Header reverts to colour dot + name + „N poz." + chevron
- Unit specs on row assembly and id-namespace disjointness
- Pruning the E2E assertions this change makes false

**Out of scope:**

- Any change to `sectionSubtotalsForView` or other figure math
- Section-scoped `remaining`, `plannedQty`, `stageQtySum`, per-etap qty/wartość — these need new
  accumulators (`remaining` in particular is a per-row loop that skips rows with no przedmiar, not
  `plannedNet − net`)
- A footer E2E spec (filed, not written)
- The paste-across-section-boundary defect (EX-584) and the E2E's stale gutter-ordinal assertions

## Architecture / Approach

Mirror the header at every layer rather than inventing a parallel mechanism: sibling id base, sibling
factory, sibling predicate, sibling cell, a fourth branch in the same `SyntheticAwareCell`. The one
real difference is the figure lookup — the header reads an item count, the footer reads a
`Map<columnId, number>` per section, the same shape `TotalsRowCell` already consumes. That map shape is
what keeps the "only the columns we can" rule honest: no entry, no figure, no special-casing.

The load-bearing constraint throughout is dsg's cell-identity trap — `SyntheticAwareCell` must stay one
stable module-level component with all per-row data on `columnData`, or dsg remounts the focused input
mid-edit and drops keystrokes.

## Phases at a Glance

| Phase                            | What it delivers                                             | Key risk                                                          |
| -------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1. Footer row exists and renders | Footer visible under its columns, folds with the section     | Footer ids classified as headers if the predicate bound is missed |
| 2. Header reverts to identity    | Money out of the label; plumbing and dead assertions removed | Removing `moneyAxis` where another consumer still needs it        |

Phase 1 lands with money briefly in both places — deliberate, so the footer can be read against the
figure it replaces.

**Prerequisites:** none — no migration, no server change, no new dependency.
**Estimated effort:** one session across both phases.

## Open Risks & Assumptions

- Column alignment is the entire point of the change and nothing automated proves it — verification
  rests on the manual checks until the `e2e-backlog` issue is worked.
- Assumes rows arrive section-contiguous. They do today (`treeToRows` yields section→displayOrder), and
  the existing duplicate-band guard keeps a violation to a mis-grouped block rather than a corrupt
  render; the footer inherits that guard's protection.
- A rozpiska with many small sections gets visually stripier. Mitigated by the lighter paint, but only
  the browser check settles it.

## Success Criteria (Summary)

- Reading a section's total means looking down its column, not decoding a number beside its name
- Folding every section leaves a clean list of names and counts, with no orphan figures
- Σ of the section footers equals „Razem" — the footer cannot disagree with the grand total or with
  Podsumowanie, because all three read the same `subtotals`
