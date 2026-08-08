# Scalable „Dodaj sekcję z szablonu" Picker — Plan Brief

> Full plan: `context/changes/2026-07-28-scalable-preset-section-picker/plan.md`
> Change brief: `context/changes/2026-07-28-scalable-preset-section-picker/change.md`

## What & Why

The picker renders every szablon's sekcje inline in one flat list. That reads fine at two or three
szablony and becomes unusable well before the library reaches the size the owner expects. This change
splits it into two panes — szablony on the left, the chosen szablon's sekcje on the right — so the list
you scroll is always the short one.

## Starting Point

One file does everything: `add-sections-from-preset-dialog.tsx` fetches on open, groups the flat
`PresetSectionMetaT[]` by preset, and renders one cmdk `CommandGroup` per szablon with a
„Zaznacz wszystkie" row on top of each. Selection is a `Set<"presetId:sectionId">`, cumulative across
szablony, confirmed once via `appendPresetSectionsAction`. The server side is already the right shape —
nothing below the component changes.

## Desired End State

Opening the picker shows szablony on the left with a name search, sekcja count, and a `3/10` figure once
some are ticked. Clicking one fills the right pane with its sekcje, each tickable, „Zaznacz wszystkie" on
top. Ticks accumulate across szablony and „Dodaj (N)" appends them in one call. On a narrow screen the
same two panes become szablon list → drill in → back.

## Key Decisions Made

| Decision          | Choice                                      | Why (1 sentence)                                                                                                                                        | Source |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Layout            | Two panes, cumulative selection             | A dozen-plus szablony can't be browsed as one flat list, folded or not.                                                                                 | Change |
| Partial selection | `3/10` readout, no tri-state control        | A half-selected szablon reads honestly as a number; no indeterminate checkbox needed.                                                                   | Change |
| Search scope      | Szablon **names only** — no sekcja search   | Sekcja names repeat across szablony (hits would be identical names), and a szablon's sekcje rarely change, so the name is enough to know what's inside. | Plan   |
| cmdk              | Dropped                                     | It earned its place on one flat list; with a name-only search and no right-pane search it is pure constraint.                                           | Plan   |
| Narrow screens    | CSS breakpoint + `pane` state, both mounted | Matches the repo's pure-Tailwind responsive style, no new hook, and Phase 3 adds classes rather than restructuring Phase 2's markup.                    | Plan   |
| Left-pane order   | Unchanged (`created_at DESC`)               | The just-saved szablon stays on top; reordering solves nothing a name search doesn't.                                                                   | Plan   |
| Tests             | Unit spec on the derivation only            | No React Testing Library in this repo; the server contract is already covered by `append-preset-sections.test.ts`.                                      | Plan   |

## Scope

**In scope:**

- Two-pane layout with szablon-name search, sekcja counts, and the `3/10` selection figure
- „Zaznacz wszystkie" moving into the right pane
- Wider dialog (`sm:max-w-3xl`)
- Narrow-screen drill-in with a back affordance
- Diacritic folding in `useSearchFilter` (benefits the six tables already using it)
- Unit spec for the grouping/counting derivation

**Out of scope:**

- Any search over sekcja names — this **drops** a capability the flat list has today (find a sekcja
  without knowing its szablon), accepted deliberately
- Tri-state checkboxes, list reordering, a shared `useMediaQuery` hook
- Any DB, query, or server-action change
- Component render tests

## Architecture / Approach

Pure derivation (`flat metas + selected set → szablon groups with counts`) moves into a sibling module so
it can be unit-tested without a renderer. The component keeps its existing fetch, reset, toggle, and
confirm logic untouched — only the rendering changes — and gains two pieces of state: which szablon is
active, and which pane is showing. Both panes always render; below `md`, Tailwind classes gated on the
pane state hide one of them.

## Phases at a Glance

| Phase                              | What it delivers                                              | Key risk                                                                              |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Extract derivation, fold search | Testable grouping/counting module; ASCII→Polish name matching | `useSearchFilter` is shared by six tables — the fold must only widen what matches     |
| 2. Two-pane picker (desktop)       | The actual layout change                                      | Cumulative cross-szablon selection silently regressing when filtering or switching    |
| 3. Narrow-screen drill-in          | One pane at a time below `md`, with back                      | The fiddly part per `change.md` — panes must stay mounted, footer must stay reachable |

**Prerequisites:** at least two saved szablony in the local DB to see the two-pane behavior at all.
**Estimated effort:** one session; Phase 2 is the bulk, Phases 1 and 3 are small.

## Open Risks & Assumptions

- **Assumption:** users know which szablon holds the sekcja they want. This is the owner's read
  ("these sections would almost never change", "the names would be repeated") and the whole reason the
  sekcja search could be cut. If it turns out wrong, the cheap fix is a szablon row that lights up when
  one of its sekcje matches the name query — right pane unchanged, no second search mode.
- Manual verification carries the layout and responsive work; there is no automated render coverage.

## Success Criteria (Summary)

- A library of 10+ szablony is navigable without scrolling past sekcje you don't care about.
- Ticking sekcje across two different szablony and confirming once still appends all of them.
- The picker is usable at 390px width.
