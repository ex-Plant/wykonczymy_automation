# Kosztorys editor — server-owned display order + hook decomposition — Plan Brief

> Full plan: `context/changes/2026-08-15-kosztorys-editor-hook-split/plan.md`
> Research: `context/changes/2026-08-15-kosztorys-editor-hook-split/research.md`

## What & Why

Two jobs in one change. **First**, the rule for how `display_order` shifts when you insert a row lives
in three places — once as SQL on the server, twice as hand-written loops in the editor hook — and only
agrees because someone transcribed it carefully. **Second**, `use-kosztorys-editor.ts` has grown to
1485 lines, and the logic that decides what a keystroke writes to the database has no test at all,
because it is only reachable by typing in a browser.

## Starting Point

The editor caches absolute position integers on the client (`sectionOrderRef`, plus `displayOrder` on
each row) so it can tell the server which two numbers to exchange on ▲▼. After an insert it replays
the server's shift by hand to keep those integers accurate. This is **not currently a visible bug** —
every path that changes stored order either goes through the client or remounts the editor — but it is
the same rule maintained in three copies.

Meanwhile ~14 pure functions are trapped in the hook body with zero coverage, including the keystroke
change-planner and the undo-reversal planners. The repo has no hook renderer and is not getting one:
the established pattern is a React-free core plus a thin hook wrapper.

## Desired End State

No position integer is computed anywhere on the client — reordering is expressed as intent ("move this
up", "store this sequence") and the server resolves it inside the transaction that writes it. The
editor's core decision logic lives in plain files with real tests. The hook is roughly half its size,
composing three sub-hooks, and its **return object is unchanged** — so none of its 10 consumers are
touched, and typing in a 1000-row kosztorys feels exactly as it does today.

## Key Decisions Made

| Decision                                       | Choice                                                          | Why                                                                                                                                         | Source   |
| ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| The `renderHook` harness EX-521 was blocked on | Not needed — declined                                           | Two `lessons.md` entries and three in-tree implementations already establish extract-the-core; a `.ts` spec already imports a `.tsx` module | Research |
| Ordering fix — is it in scope?                 | Yes                                                             | Owner: the duplicated rule gets fixed even without a current victim                                                                         | Plan     |
| Ordering fix — how far                         | Sections **and** items, in full                                 | The half-fix costs the same ceremony and still leaves a transcribed copy of the rule                                                        | Plan     |
| The bake („Zapisz kolejność")                  | Client sends an id **sequence**; server assigns the numbers     | The only reason items still needed client-side integers; `planKosztorysRenumber` already produces a sequence                                | Plan     |
| Sequencing                                     | Ordering first, then the split                                  | The ordering fix deletes code the split would otherwise relocate and then remove                                                            | Plan     |
| What the split is for                          | Testability **and** readability                                 | Owner: "we need to be able to test it, but better readability would be good"                                                                | Plan     |
| Performance                                    | **Hard constraint** — nothing into context, return shape frozen | EX-496's restructuring regressed the grid on 1000+ rows and was reverted; this rules out that exact move                                    | Plan     |
| Perf verification                              | Manual A/B at the end                                           | No automated perf guard exists; building a render-counting harness costs more than the refactor it guards                                   | Plan     |
| How deep the split goes                        | Groups 1-4; **not** row/section ops                             | Splitting two intertwined clusters relocates the tangle rather than resolving it                                                            | Plan     |
| Section-field bundle (finding 2)               | Dropped                                                         | Speculative — pays off only if a third denormalized section field is ever added                                                             | Plan     |
| Undo command-as-data (finding 3)               | Dropped                                                         | The "50 copies of the dataset" premise was wrong; rows are structurally shared, so real retention is low single-digit MB                    | Research |

## Scope

**In scope:** direction-based section + item reordering; anchor-relative inserts; sequence-based order
bake; deletion of `sectionOrderRef` and both mirror loops; extraction + tests for the keystroke change
planner, undo-reversal planners, money-axis and view-row pipeline; three sub-hooks (settlement
settings, stage ops, view state).

**Out of scope:** any hook-test harness; row/section operations split; section-field bundle; undo
command-as-data; React Compiler memoization; multi-tab live sync; schema or data migration.

## Architecture / Approach

**Ordering.** Today the client reads position numbers from a cache and the server writes them — that
split is what permits drift. Afterwards the server does both reads and write in one transaction, so
there is nothing to drift from. `swapDisplayOrder` moves onto a caller-owned transaction handle, and
every statement keeps `ORDER BY id FOR UPDATE` so EX-632's deadlock guard survives.

**Decomposition.** Two moves only: _pure extraction_ (lift a closure-free function into
`src/lib/kosztorys/`, pass inputs explicitly, test it — render-neutral by construction) and _sub-hook_
(move a state cluster into `hooks/use-*.ts`, call it above the column build, spread its result flat
into the same return object). Nothing is regrouped and nothing moves into React context.

## Phases at a Glance

| Phase                  | What it delivers                                                             | Key risk                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Sections            | Direction-based section swap/insert; `sectionOrderRef` deleted               | Moving the swap into a transaction without losing the lock ordering             |
| 2. Items               | Direction-based item swap/insert; sequence-based bake; second mirror deleted | The bake's all-or-nothing refusal and its undo must survive the contract change |
| 3. Pure extraction     | Keystroke planner, undo-reversal, money-axis, view rows — with tests         | Undo lane keys must come out identical (EX-526 ordering guarantee)              |
| 4. Settlement settings | ~220-line cluster into its own hook                                          | Must be called above the column build; `patchRows` stays shared                 |
| 5. Stage ops           | ~85-line cluster into its own hook                                           | `stagesRef` must stay a render-written ref                                      |
| 6. View state          | Search/sort/collapse/guide into its own hook                                 | Preview pinning is disclosure-security — must move verbatim                     |

**Prerequisites:** local Postgres on 5433 and the test DB on 5435 seeded (`pnpm db:import:test` +
`pnpm seed:kosztorys:test`); a kosztorys with 1000+ rows for the final A/B (`perf-seed-kosztorys.ts`).

**Estimated effort:** ~3 sessions. Phases 1-2 are roughly as much work as 3-6 combined.

## Open Risks & Assumptions

- The performance constraint is enforced by review discipline plus one manual A/B, not by a test. If
  the A/B fails at phase 6, the offending phase has to be found by bisecting six commits.
- `displayOrder` on the row type may become dead after phase 2. Confirm with `tsc`, not grep, before
  removing it.
- Converting sections and items together keeps `display-order.ts` symmetric, but it doubles the
  surface of the behavior change relative to sections alone.
- Browser-level undo (EX-525) and ⋯-menu ordering (EX-472) stay uncovered; phases 1-2 make EX-472
  more valuable, so the new action signatures should be noted on it.

## Success Criteria (Summary)

- Reordering and inserting sections and pozycje behaves exactly as before, and survives a reload —
  including insert-then-move, the scenario the deleted client mirror existed to protect.
- The editor's keystroke and undo logic is covered by unit tests that run without a browser.
- Typing in a 1000-row kosztorys is indistinguishable from `staging`.
