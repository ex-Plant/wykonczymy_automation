# EX-672 — Remove transfer print + CSV export — Plan Brief

> Full plan: `context/changes/2026-08-12-ex-672-remove-print-csv-export/plan.md`
> Research: `context/changes/2026-08-12-ex-672-remove-print-csv-export/research.md`

## What & Why

Delete the transfer print and CSV-export features and the `headerFields` layer they share. The owner
ruled both unnecessary (2026-08-12). They ship together because print is not a screenshot — it is a
second independent reader that computes its own balance and filters fields through a global store fed
by the v1 stat tiles. ~530 lines of module go outright, plus wiring in six files.

## Starting Point

Three buttons live in one component (`transfer-export-toolbar.tsx`): print, CSV and **invoice
download**. The whole toolbar is gated on `headerFields` — print's data — so invoice download's
visibility is an artifact rather than a decision, and that is why the manager dashboard lacks it.
The `useHeaderFieldsStore` is a mirror only: `ToggleStatButtons` owns the visible toggle, the dimming
and the on-screen bilans in local state, and under the default `?widok=v2` the store→print linkage has
been inert since 2026-07-26.

## Desired End State

No print or CSV anywhere: no buttons, no modules, no store, no config field, no producers. Invoice
download renders on exactly the four pages that have it today and still not on the dashboard — but
behind an explicit `invoiceDownload?: boolean`. The v1 tiles are unchanged on screen.

## Key Decisions Made

| Decision                    | Choice                                                                         | Why                                                                                                         | Source   |
| --------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------- |
| Invoice download            | Lift out of the toolbar into `transfer-data-table.tsx` behind an explicit flag | The toolbar is its only mount point — deleting it as the ticket describes drops the feature from four pages | Research |
| Dashboard button            | Deliberately stays absent                                                      | Its `where` has no anchor and the fetch is unpaginated — the ZIP would contain every invoice in the system  | Owner    |
| PDF replacement             | None owed                                                                      | The 2026-08-12 ruling ("both unnecessary") supersedes the July "phased out in favour of a PDF" framing      | Owner    |
| Adjacent dead config fields | Delete with the change                                                         | `totalPayouts`, `context`/`contextId` have zero readers and live in the same type and call sites            | Owner    |
| Parity spec's borrowed sum  | Inline into the spec; delete `header-fields.ts`                                | Don't keep a file alive for a test — record that parity narrows from three surfaces to two                  | Owner    |
| Store removal cost          | Zero on screen                                                                 | The toggle, dimming and bilans are `ToggleStatButtons`' own `useState`                                      | Research |
| E2E                         | None owed                                                                      | Print/CSV never had any browser coverage — nothing to update, no regression window to close                 | Research |

## Scope

**In scope:** print + CSV buttons and their whole module subtree; `useHeaderFieldsStore`;
`lib/export/header-fields.ts`; the `headerFields` config field and its four producers; three
already-dead config fields; the invoice-download lift; one deleted spec, one reworked spec; three doc
reconciliations.

**Out of scope:** invoice download's behavior/auth/pagination; adding it to the dashboard; PDF work;
`HeaderFieldT`/`FinancialFieldT` (still feed `FinancialStats`, which `/raporty` renders ungated);
`ToggleStatButtons`; the `?widok` axis and the `statsWhere` perf win (both EX-673).

## Architecture / Approach

Four phases ordered so the tree never passes through a state where invoice download is missing:
**lift the survivor → delete → strip dead producers → reconcile docs**. The compiler cannot police
phase 3 — every removed field is optional, so a stranded producer type-checks and computes into the
void — so that phase is gated on grep + `dead-code-scanner`.

## Phases at a Glance

| Phase                    | What it delivers                                                       | Key risk                                                                                           |
| ------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1. Lift invoice download | Explicit `invoiceDownload?: boolean`, button mounted in the data table | Missing one of the four pages silently removes the button there                                    |
| 2. Delete the pair       | 11 files gone, store unwired, parity spec's sum inlined                | Deleting `download.ts` or `lib/actions/export.ts` by association — both are invoice-path survivors |
| 3. Strip producers       | Four `headerFields` blocks + three dead config fields removed          | `tsc` stays silent on stranded producers; two orphaned `formatPLN` imports                         |
| 4. Docs                  | `lessons.md`, `manual-checks.md`, `roadmap.md` reconciled              | Retiring the lesson's transferable rule along with its dead subject                                |

**Prerequisites:** none — no migration, no schema, no persisted state.
**Estimated effort:** ~1 session; phase 2 is the bulk.

## Open Risks & Assumptions

- Phase 1 before Phase 2 is load-bearing; reversing them drops invoice download from four pages.
- Phase 3's correctness rests on grep + `dead-code-scanner`, not the type checker.
- The parity test's inlined sum must reproduce `calculateBalance` exactly — the golden master is the
  proof.

## Success Criteria (Summary)

- No „Drukuj" / „CSV" button anywhere; no print/CSV module, store or config field left in the tree.
- „Pobierz faktury" works on the same four pages as before and is still absent from the dashboard.
- v1 stat tiles still toggle, dim and recompute the bilans; parity golden master passes unchanged.
