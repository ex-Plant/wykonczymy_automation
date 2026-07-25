# Subcontractor Views Become Settlement-Only — Plan Brief

> Full plan: `context/changes/2026-07-25-subcontractor-view-settlement-only/plan.md`

## What & Why

A subcontractor view (Z narzędziami / Bez narzędzi) currently shows the whole rozpiska repriced at one
crew's rate, so it counts the other crew's executed work and charges it to the wrong crew. It ends up
contradicting „Podsumowanie podwykonawców" on the same screen. This change turns those views into what
the owner actually needs them to be: one crew's bill.

## Starting Point

EX-565 added a `plane` to each etap and gated only the per-etap **wartość** columns behind it. The
quantity underneath — the sheet's „Pomiar z natury", which by EX-494 IS the sum of all ten etap
columns — stayed plane-blind, so every figure standing on it (row wartość, „Pozostało", „% wykonania",
section subtotals, „Razem") inherited the error. The other plane's value columns rendered „nie
dotyczy" while their quantity columns kept showing live numbers.

## Desired End State

In a subcontractor view the grid lists only that crew's etapy — quantity and value alike — with no
przedmiar in any form, and every total counts only that crew's work at that crew's price. The two
crews' „Razem netto" figures add up to the whole executed work, and each matches its row in
„Podsumowanie podwykonawców" exactly. An etap with no chosen tryb belongs to neither crew and is
reported by a badge, not silently assigned. Klient view is untouched.

## Key Decisions Made

| Decision                                                                    | Choice                                        | Why                                                                                                                                | Source                      |
| --------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Other plane's etapy in a subcontractor view                                 | Columns removed entirely                      | Blanking them („nie dotyczy") was built and rejected — a wall of dead cells, with the qty columns still reading as if they counted | Owner ruling (spike review) |
| Etap with no tryb                                                           | Belongs to no plane; counted for neither crew | A missing amount with a warning beats an amount charged to a crew nobody picked                                                    | Owner ruling (spike review) |
| Przedmiar-anchored columns (Przedmiar, its wartość, % wykonania, Pozostało) | Hidden in subcontractor views                 | Przedmiar has no plane — it is the whole offered scope, typed once per row; comparing it to a plane-filtered pomiar is meaningless | Plan                        |
| Przedmiar **quantity** column specifically                                  | Hidden too                                    | Owner: with the pomiar filtered by tryb, leaving the przedmiar next to it invites a false comparison                               | Plan                        |
| „Podsumowanie podwykonawców" top three rows                                 | Kept as-is                                    | Only place showing both crews side by side; the payout rows beneath it are unique to the panel anyway                              | Plan                        |
| „Razem Netto" column label                                                  | Disambiguated in subcontractor views          | Same label means post-rabat in Klient and pre-rabat on a crew's bill                                                               | Plan                        |
| Rows with 0 pomiar in the active view                                       | Stay visible                                  | Keeps row numbering and layout aligned across views                                                                                | Plan                        |
| Global-discount anchor                                                      | Fixed in this change                          | Latent today (client Podsumowanie is swapped out in subcontractor views), but Phase 1 sharpens the trap                            | Plan                        |
| Test coverage                                                               | Unit tests on the number layer only           | A wrong figure here is silent and monetary; column-set and Playwright coverage declined                                            | Plan                        |

## Scope

**In scope:** plane-scoped quantity and every figure derived from it; subcontractor column set;
deletion of the „nie dotyczy" apparatus; stage-header glyph for an unassigned etap; the
unconfirmed-plane hint text; anchoring the labour figure to the client plane.

**Out of scope:** the Klient view; row hiding; restructuring „Podsumowanie podwykonawców"; how a plane
is picked or stored (EX-565, shipped); whether the przedmiar carries the rabat (EX-495, open); E2E
coverage.

## Architecture / Approach

One cut at the bottom, then the UI follows. `rowTotalQtyDone` in `src/lib/kosztorys/settlement.ts` is
the quantity primitive the entire editor stands on; making it view-aware corrects row wartość, section
subtotals, per-etap footers and „Razem" without touching any of them. `stageAppliesToView` stops
defaulting a `null` plane, which removes the silent credit to the with-tools crew from both the grid
and the settlement panel. Only then does the column builder narrow the visible column set — a purely
presentational phase that deletes the placeholder machinery the old approach required.

## Phases at a Glance

| Phase                            | What it delivers                                                              | Key risk                                                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Plane-scoped quantity         | Every figure counts only the active view's etapy; undecided belongs to nobody | The quantity signature change must be threaded to all call sites in one commit or the build breaks — deliberate, since a default would silently restore the bug |
| 2. Subcontractor column set      | Other plane's etapy and all przedmiar columns gone; „nie dotyczy" deleted     | Hiding a column the owner still reads for context; caught by manual review, not tests                                                                           |
| 3. Global-discount anchor + hint | Labour figure pinned to the client plane; badge tooltip stops lying           | Low — both are small and independent of Phases 1–2                                                                                                              |

**Prerequisites:** EX-565 (`etap-tool-plane`) merged — `plane` exists on a stage. A kosztorys with
etapy on both planes and quantities against each, for manual verification.
**Estimated effort:** ~1–2 sessions across three phases.

## Open Risks & Assumptions

- **The two bills stop summing to the executed work while any etap is unassigned.** Deliberate, per the
  owner's ruling; the unconfirmed badge is the only signal. If it is missed in practice, the ruling —
  not the implementation — is what needs revisiting.
- Assumes quantities are entered in the Klient view. Narrowing the subcontractor column set removes no
  editing capability only as long as that holds.
- The wrench glyph in a subcontractor view now marks every visible etap identically, since they all
  share the view's plane. Possibly noise worth removing later; flagged, not decided.

## Success Criteria (Summary)

- Opening Z narzędziami shows a document the owner can hand to that crew: their etapy, their
  quantities, their price, one total.
- The two crews' totals reconcile against „Podsumowanie podwykonawców" and against each other without
  arithmetic on the owner's part.
- No figure on screen changes meaning depending on which view happened to be open.
