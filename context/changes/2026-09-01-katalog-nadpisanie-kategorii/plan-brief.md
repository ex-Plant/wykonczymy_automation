# Kategoria kontrolowalna przy nadpisaniu — Plan Brief

> Full plan: `context/changes/2026-09-01-katalog-nadpisanie-kategorii/plan.md`

## What & Why

„Zapisz do katalogu…" → „Nadpisz" writes the whole candidate row, so the kategoria derived from THIS
kosztorys' sekcja silently reclassifies a praca in the shared cennik — and nothing in the dialog says
so. This makes the kategoria a visible, decidable part of the overwrite, defaulting to keeping the
katalog's own classification.

## Starting Point

The action takes two arguments and hands the candidate to `payload.update` whole. The preview already
holds both kategorie (`candidate` / `existing`) and shows neither as a change — the grey header line
displays the candidate's value as if it were current state. The confirm sentence enumerates the three
money figures and stops there.

## Desired End State

An overwrite onto a differently-filed cennik row shows a fourth „Kategoria" row in both preview
blocks and a ticked „Zostaw kategorię z katalogu". Ticked: money changes, kategoria survives.
Unticked: „Po zapisie" flips to the sekcja's kategoria and the confirm sentence names the move.
Kategorie identical → neither row nor toggle appears.

## Key Decisions Made

| Decision                       | Choice                                    | Why                                                                                                | Source                           |
| ------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------- |
| Default on overwrite           | Keep the katalog's kategoria              | The cennik owns its classification; a sekcja is one investment's local context                     | Change notes (owner, 2026-09-01) |
| Forking a pozycja by kategoria | Not doing it                              | Identity is opis + j.m.; two rows on one klucz break inserting from the katalog                    | Change notes                     |
| Toggle placement               | In „Zapisz do katalogu…", not the confirm | The decision belongs where the figures are; the confirm stays a plain warning like every other one | Plan                             |
| Preview shape                  | Fourth row in both blocks                 | Kategoria reads like any other value that changes; no second idiom in one window                   | Plan                             |
| Empty kategoria                | „bez kategorii" is a real value           | Letting the rozpiska fill a gap is the same silent overwrite, one case narrower                    | Plan                             |
| Wire contract                  | Third argument, defaults to `true`        | The protective behaviour is what a caller gets by forgetting; existing „nowa" call sites untouched | Plan                             |

## Scope

**In scope:** the third argument on `saveItemToCatalogueAction`; the kategoria row, toggle and
confirm clause in `SaveItemToCatalogueDialog`; two DB-backed regression cases; closing the open box
in the `work-item-catalog` review-gate ledger.

**Out of scope:** forking a pozycja by kategoria; the „nowa" path; typing a third kategoria value
here; any schema, migration or backfill.

## Architecture / Approach

The decision is local state in the dialog, travels as one boolean, and is applied in exactly one
place — the `existing` branch of `'overwrite'`, overriding `candidate.category` with
`existing.category`. Everything else the dialog shows is derived from
`existing.category !== candidate.category`; no new type, query or preview field.

## Phases at a Glance

| Phase     | What it delivers                                                   | Key risk                                                                                                       |
| --------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 1. Serwer | Red spec on the persisted kategoria, then the third argument       | The spec is DB-gated — needs the 5435 container up                                                             |
| 2. Dialog | Fourth row, toggle, confirm clause; closes the originating finding | Derived-state cases (empty kategoria, identical kategorie) have no render harness — they ride on manual checks |

**Prerequisites:** `db-test` on 5435 reachable for the integration leg.
**Estimated effort:** one session, two phases.

## Open Risks & Assumptions

- The dialog's derived state is not covered by an automated test — the repo has no component-render
  harness, so row visibility and the confirm clause are verified by hand.
- Assumes nobody wants a per-investment kategoria in the cennik; that would be a different change and
  is explicitly refused here.

## Success Criteria (Summary)

- An overwrite no longer moves a praca between kategorie unless the owner says so.
- What the dialog shows before confirming is what lands in /katalog-prac.
- The persisted kategoria is pinned by a DB-backed test in both modes.
