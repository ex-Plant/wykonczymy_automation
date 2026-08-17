# „Problemy" group in the Filtry menu — Plan Brief

> Full plan: `context/changes/2026-08-17-filtry-problemy/plan.md`
> Decisions & rationale: `context/changes/2026-08-17-filtry-problemy/change.md`

## What & Why

The kosztorys editor surfaces its two defect counts as loose toolbar buttons, while four other real
defects — an overpriced subcontractor on either plane, a stage with no settlement plane, a stage with
no worker — are not surfaced at all. This change collects all six under one „Problemy" heading inside
the „Filtry" dropdown and puts a single warning triangle on that dropdown's trigger, so „is anything
wrong in this kosztorys" has one answer in one place.

## Starting Point

One row-shaped condition registry drives everything: filters (ticked by default, unticking hides) and
diagnostics (off by default, engaging keeps only matches). Counts are already computed for every
condition over the full dataset and already zeroed in the client share view. The subcontractor-price
rule exists and already reddens cells, but nothing filters by it. Stages carry a plane and a worker,
but nothing anywhere counts the ones missing either, and no mechanism has ever hidden an individual
stage column.

## Desired End State

„Filtry" opens onto **Prace** (unchanged) and **Problemy** (six imperative rows, each present only
when its count is above zero, the whole group gone when the kosztorys is clean). The trigger carries a
red triangle whenever a problem exists in the data — before anyone clicks anything — and its count now
includes engaged problems. Engaging a stage problem leaves only the offending stage columns standing;
engaging a row problem keeps only the offending rows. The toolbar has no diagnostic buttons left.

## Key Decisions Made

| Decision                   | Choice                                                                            | Why                                                                                                                        | Source |
| -------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| Stage filters' effect      | Actually narrow the stage columns                                                 | „Pokaż etapy" should show etapy; the ban on per-stage visibility covers _persisted_ state only, and a filter is transient  | Plan   |
| Subcontractor price scope  | Two rows, one per plane, counted regardless of active view                        | The defect must be visible from whichever view you happen to be in                                                         | Owner  |
| Price rule                 | The existing guard verbatim (over 80% of the pre-rabat client price, or negative) | One rule behind both the red cell and the filter, so they cannot disagree                                                  | Plan   |
| Triangle trigger           | Any of the six, „praca do rozpisania" included                                    | Owner's explicit call                                                                                                      | Owner  |
| Trigger count              | Now includes engaged problems                                                     | After the move, nothing else signals a problem filter is on                                                                | Owner  |
| Overlap counting           | Count independently; a bare stage lands in both rows                              | Each row should read literally, even at the cost of double counting                                                        | Owner  |
| „Pozostało do rozliczenia" | Unchanged — arrives with its filter, stays out of the picker                      | Two switches on one column is what was untangled earlier                                                                   | Owner  |
| Registry shape             | A second, stage-shaped registry                                                   | Rows and stages are different subjects; one signature for both means every stage predicate ignoring its row argument       | Plan   |
| Stage count scope          | Over the stages the active view shows                                             | A subcontractor view already drops plane-less stages, so counting them there offers a filter that can only empty the block | Plan   |

## Scope

**In scope:** two price diagnostics; a stage-condition registry with two entries; transient stage-column
narrowing across all three stage axes; a second toggle group in the shared filter component; the
conditional „Problemy" rows, the triangle and the recomputed trigger count; removal of the toolbar
diagnostics; unit specs for each new pure module.

**Out of scope:** per-stage entries in the column picker or in persisted visibility; a second toggle for
„Pozostało do rozliczenia"; any change to how „Prace" filters read or combine; a softer second warning
tier on the subcontractor price; migrations; the other two consumers of the shared filter component
beyond a mechanical prop rename.

## Architecture / Approach

Bottom-up in three layers. The pure predicate layer comes first — two registry entries plus a new
stage registry, both testable with no renderer, which is the split the rest of the editor already
uses. The grid then narrows its stage list at the single point where the view filter already runs, so
all three stage axes inherit the narrowing and none can drift. Finally the menu: its arithmetic moves
into a pure model module (which rows to show, what to count, whether to warn), the shared filter
component grows headed toggle groups, and the toolbar loses its buttons.

## Phases at a Glance

| Phase              | What it delivers                                               | Key risk                                                                |
| ------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Predicate layer | Price diagnostics + stage registry + counts                    | Id collision across two registries sharing one engaged set              |
| 2. Stage narrowing | Engaged stage problem narrows the grid's stage columns         | The three stage axes drifting apart; leaking into the client share view |
| 3. Menu & toolbar  | „Problemy" group, triangle, new trigger count, buttons removed | The trigger count conflating „hid things" with „narrowed to"            |

**Prerequisites:** none — no migration, no new credentials, no upstream slice.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- A stage with no plane also has no worker (choosing one is disabled until the plane is set), so it is
  counted twice by design. If the totals ever feed a headline figure, that double count has to be
  revisited.
- The shared filter component is touched, and its two other consumers (transfers, cash registers) use
  only its base props — verified, but the rename still crosses a shared file.
- Narrowing stage columns to zero is reachable (engage a stage filter in a view that shows no matching
  stage). The grid should degrade to „no stage columns", not to an error; worth a manual look.
- The menu, the shared component and the toolbar have no existing tests, so phase 3 writes the first
  ones against behaviour that is changing in the same commit.

## Success Criteria (Summary)

- A clean kosztorys shows no „Problemy" heading and no triangle; a dirty one warns before any click.
- Each of the six rows narrows the grid exactly as its wording promises, and „Zresetuj filtry" clears
  all of it including the stage narrowing.
- The client share view shows no problem surface at all.
