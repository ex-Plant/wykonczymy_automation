# Review-gate ledger — kosztorys-editor-hook-split (EX-521) · 2026-08-17

Base: `staging` · 27 files, +2663 / −774 · HEAD `069f2f44`

Fan-out: `/10x-impl-review`, `/code-review`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only).
Dropped: `tailwind-v4-audit` — the diff carries no JSX and no CSS.
Step 0.5 (browser verification) skipped: the user's standing rule forbids driving
Playwright unprompted, and the slice's manual checks are the human's to sign off.

## Findings

Both bug-finding checks landed 0 CRITICAL. They converge on the same place — the ordering write
path's transactionality and cost — which is where most of the fix effort goes.

- [x] 🟡 WARNING · fixed · `code-review` + `impl-review` · `src/lib/actions/kosztorys.ts:535-559` ·
      „Zapisz kolejność" ran its ownership guard and the bake as two autocommit statements, so the
      comment's "All-or-nothing" was a check-then-write. A concurrent „Wstaw pozycję" between the two
      lands a second row on a display_order the bake also assigns — duplicates in one section, no
      unique constraint to catch it, non-deterministic reload order. Fixed by folding the lock into
      the guard SELECT: one `ORDER BY id FOR UPDATE` over the whole investment's items, inside the
      transaction that bakes.
      test: test-driven-debugging · integration — `display-order.test.ts` DO5, three specs asserting
      the persisted display_order set (per-section restart, stale-id refusal writes nothing,
      cross-investment id refused)
- [x] 🟡 WARNING · fixed · `impl-review` · `src/lib/kosztorys/display-order.ts:215` ·
      `renumberDisplayOrder` alone still took `payload` and opened its own `getDb`, unlike every
      sibling which takes `DbExecutorT`. That is what made the finding above unfixable without
      touching it — it could not join a caller's transaction. Signature moved to `DbExecutorT`.
- [x] 🟡 WARNING · fixed · `code-review` + `impl-review` · `src/lib/actions/kosztorys.ts:24`,
      `src/lib/kosztorys/display-order.ts:26-29` · `swapDisplayOrderSchema` and its import are dead
      since both call sites moved to `moveOrderSchema` — the only new lint warning in the diff.
- [x] 🟡 WARNING · closed unfixed (was EX-700) · `impl-review` + `code-review` ·
      `src/lib/kosztorys/display-order.ts:90-104` · The locked position read widens every ▲▼ and every
      insert from a tail-only lock to a whole-owner `FOR UPDATE`, blocking cell autosaves into the same
      section for the window. **Not fixed:** the lock is what makes the plain neighbour SELECTs safe, so
      narrowing it is a correctness-sensitive redesign. **Since measured** — the reviewers' "1000-item
      section" was wrong (the owner block is one section, 10 × 100 per `perf-seed-kosztorys.ts`), and the
      throwaway benchmark put autosave at p50 6.7 → 7.9 ms / p95 9.8 → 12.1 ms under
      a continuous ▲▼ burst. +1 ms is not worth re-deriving EX-632's lock discipline, so the issue was
      closed; the numbers now live on `display-order.ts:84` and in `lessons.md`.
      test: no automated test — a lock-contention budget needs a benchmark, not an assertion
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/kosztorys/display-order.ts:90-104` ·
      Both resolvers read the owner id _before_ taking the lock and never re-validated it after — if a
      row changed owner in between, the neighbour SELECT ran against an owner nobody locked.
      Unreachable today (nothing moves a row between sections). Closed structurally rather than with a
      post-lock comparison: `lockedPositionOf` resolves the owner _inside_ the lock's own predicate,
      so lock and read are one statement and the window does not exist (this superseded the
      two-line owner check first applied here).
- [x] 🔵 OBSERVATION · fixed · `code-review` + `impl-review` · `src/lib/actions/kosztorys.ts:441` ·
      `insertItemAction` called `sectionOwnerAndNextItemOrder` — a LEFT JOIN with a `MAX()` aggregate
      over the whole section — inside the transaction, while the section-wide lock is held, and
      discarded `nextDisplayOrder`. A bare `investment_id` read does the job and shortens the critical
      section. Same edit fixed the wrong error code below.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/actions/kosztorys.ts:453` ·
      A missing _section_ on the insert path reported `ITEM_MISSING` („Pozycja nie istnieje.") — the
      toast named the wrong entity.
- [x] 🔵 OBSERVATION · fixed · `code-review` + `impl-review` ·
      `src/components/kosztorys/editor/use-kosztorys-editor.ts:546-556` · The reorder undo replayed a
      neighbour id captured at push time while the server exchanged with whatever is rank-adjacent
      _now_ — insert a row between the pair, then Cmd+Z, and grid and DB disagree until reload.
      Fixed by re-deriving the swap locally with `swapItemInSection`, the same primitive the forward
      gesture uses, so both halves are the same operation by construction.
      test: test-driven-debugging · unit — `row-ops.test.ts` covers swap → insert between → reverse,
      asserting the reversal picks the CURRENT neighbour, not the captured id
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/kosztorys/row-ops.ts:102-112, 166-183` ·
      `applyKosztorysOrder` was rewritten to a different algorithm (permute occupied slots, rather
      than stamp-then-sort) and `applyInsertItem` lost its tail-bump branch — neither had a unit spec.
      `src/__tests__/lib/kosztorys/row-ops.test.ts` now covers both, table-driven.
      test: TDD · unit — full sequence, interleaved sequence, partial sequence, unknown ids, no-op
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/lib/actions/kosztorys.ts:359-390, 490-509` ·
      A swap against an already-deleted row returns `{ success: true }` — indistinguishable from the
      legitimate edge no-op. The client fires these un-awaited and discards the result either way, so
      splitting the two `null` cases buys nothing today.
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/lib/actions/kosztorys.ts:551-558` ·
      The bake numbers only the ids it was sent and never asserts the sequence covers every item of
      each touched section. Pre-existing (the client computed the same 0…n-1 before), and only
      reachable when the client's dataset is already behind the DB — which the transaction fix above
      now narrows further. Left alone rather than bolted onto the same edit.
- [x] 🔵 OBSERVATION · dropped · `impl-review` · `src/lib/kosztorys/display-order.ts:37-40` ·
      The bake's id array has no `.max()`, so a large enough sheet would hit Postgres' 65535
      bind-parameter ceiling. The documented scale ceiling is ~1000 items; no reachable input.
- [x] fixed · `impl-review` · `plan.md:170-173, :322` · The plan described a locking mechanism the
      code deliberately does not use (it demanded `FOR UPDATE` on the neighbour SELECT, which would
      acquire out of id order — the exact EX-632 cycle). Code is right, plan text was wrong.
- [x] fixed · `structure-audit` + `simplify` · `kosztorys-v2-column-opts.ts:14-15` ·
      `V2SortStateT`/`SortPickT` were a structural twin of the inline sort shape at
      `row-view.ts:76-83`. Alias shim deleted; both sites import the one exported type.
- [x] fixed · `structure-audit` · `AGENTS.md` · The rule this slice actually established — editor
      root is the composition entry, `editor/hooks/` holds the leaves — was unwritten, so the next
      hook would land wherever it felt right.
- [x] fixed · `comment-noise` · `use-kosztorys-editor.ts:172` · "Both disables…" went stale in phase
      5: the pair was split, its twin now lives at `use-kosztorys-stage-ops.ts:47`.
- [x] fixed · `comment-noise` · 6 sites (`grid-change-plan.ts:21`, `row-ops.ts:101`,
      `display-order.ts:116`, `actions/kosztorys.ts:522`, `display-order.test.ts:311`,
      `grid-change-plan.test.ts:6`) · vanished-state narration — describes what the code used to do.
- [x] fixed · `simplify` · `src/lib/kosztorys/display-order.ts:90-157` · Three separate helpers
      (`lockOwnerRows`, `lockInvestmentItems`, `ownerAndOrderOf`) spelled out the same read→lock→
      re-read dance. Collapsed into one private `lockedPositionOf` — one statement, one round trip,
      and the fail-closed property becomes structural instead of an explicit comparison.
- [x] fixed · `simplify` · `src/lib/kosztorys/display-order.ts:191-212`,
      `src/lib/actions/kosztorys.ts` · Both swap actions each spelled out the display_order crossing
      for themselves — the exact drift EX-578 was filed for. New `moveRowOneStep(db, scope, rowId,
  dir)` owns it; `resolveOrderSwap` and `swapDisplayOrder` are now private.
- [x] fixed · `simplify` · `src/lib/kosztorys/display-order.ts:69` · `moveDirectionSchema` was
      exported with no external consumer; only `MoveDirectionT` is used outside the module.
- [x] fixed · `simplify` · `src/lib/actions/kosztorys.ts` · `removeSectionAction` hand-rolled its own
      "which investment owns this section" lookup instead of `sectionInvestmentId`.
- [x] fixed · `simplify` · `src/lib/kosztorys/row-ops.ts:166-183` · `applyKosztorysOrder`'s inner loop
      built an index map it then discarded; a single `taken` cursor over the sorted block does it.
- [x] fixed · `simplify` · `src/lib/kosztorys/save-lanes.ts` · `itemFieldLane`/`stageLane` — the save
      lane keys were spelled inline at each call site, which is exactly how a forward autosave and its
      undo inverse silently stop serializing (EX-526 #1).
- [x] fixed · `simplify` · `src/lib/kosztorys/grid-change-plan.ts` · `seenRows` + `changedRows` +
      `PlannedFieldChangeT.value` were three representations of one answer. One `changedById: Map`
      replaces them; the spec moved with it.
- [x] fixed · `simplify` · `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts` ·
      A row added into a folded section was invisible. New `unfoldSection`, returning the same Set
      reference when the section is already open so an add elsewhere doesn't re-render the grid.
- [x] fixed · `simplify` · `src/components/kosztorys/editor/hooks/use-kosztorys-stage-ops.ts` ·
      `stagesRef` was returned but only ever read inside the hook; kept private.
- [x] fixed · `simplify` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      `runGridReversal` merged its patches with a hand-written map/spread over all rows instead of
      `patchRows`, the predicate-based primitive the file already owns.
- [x] closed unfixed (was EX-702) · `simplify` (altitude) · `use-kosztorys-editor.ts` ·
      `rows`/`setRows`/`rowsRef`/`prevById`/`patchRows`/`revertOne` called the most cohesive unit left
      in the hook. **Since counted and rejected** — 47 references across ~30 handlers, so the extraction
      relocates five declarations and leaves every call site reaching in. The claimed
      parent → child → parent's-internals "cycle" is plain parameter passing (`useKosztorysSettings`
      takes `rowsRef`/`patchRows` as args) and survives the extraction unchanged; the `:277-290`
      "hoisting caveat" is a correct three-line note that function declarations hoist. Rationale now
      pinned at `use-kosztorys-editor.ts:125`. Revisit only after EX-422 settles whether
      `rowsRef`/`prevById` are still load-bearing at all.
- [x] closed unfixed (was EX-701) · `simplify` (altitude) · `use-kosztorys-editor.ts`,
      `kosztorys-editor-v2.tsx:30` · The undo coalescing buffer lives outside `useUndoRedo`, so
      `undoRedo.revision` under-reports for up to 700ms and the snapshot dirty gate reads "clean"
      mid-burst. **Since verified and closed unfixed** — the snapshot interval is 10 min, a skipped tick
      doesn't poison `lastSnapshotRevision` so the next tick catches up, and the edit is already
      persisted by the independent autosave. Worst case is one snapshot delayed; nothing is lost.
      Rationale now pinned at `hooks/use-auto-snapshot.ts:20`.
- [x] skipped · `simplify` (efficiency) · `src/lib/kosztorys/display-order.ts:90-104` · The item-scope
      read could also carry `investment_id`, saving one round trip in `insertItemAction`. Not applied:
      it would introduce the module's first `scope === …` branch, and "zero scope-specific branches"
      is precisely what the altitude pass called out as the design's strength.
- [x] dropped · `simplify` · `src/lib/kosztorys/display-order.ts:36-45` · Generalising
      `nextSectionDisplayOrder` into `nextDisplayOrder(db, scope, ownerId)`. The item path no longer
      computes a next order at all (see the `insertItemAction` fix above), so the generalisation would
      have exactly one caller.
- [x] dropped · `simplify` · `src/lib/actions/kosztorys.ts` · A `captureSnapshotBefore(db, scope,
  rowId, userId)` wrapper over the three "which investment owns this row" + snapshot lookups.
      Pre-existing, and one of the three was already collapsed by the `sectionInvestmentId` fix; the
      remaining two differ enough that the wrapper's parameters would restate its body.
- [x] dropped · `simplify` · `use-kosztorys-editor.ts` · The two `applyX` wrappers around
      `saveSetting`/`pushReversible` look inlinable but ARE the `apply` callback contract those two
      take — there is nothing to inline them into.
- [x] dropped · `simplify` (reuse) · `src/__tests__/**` · Four specs hand-roll a
      `KosztorysV2RowT` builder. Each is three lines and each takes the fields its own subject reads;
      a shared fixture's parameters would restate the builders it replaced.
- [x] dismissed · `structure-audit` · `use-kosztorys-editor.ts` · Still 1040 lines against a 900-line
      target, and `display-order.ts` mixes schemas with executors while `actions/kosztorys.ts` sits at
      685 LOC. The first is owner-accepted and recorded at plan 6.3; the other two are pre-existing
      shapes this slice did not create.
- [x] dismissed · `structure-audit` + `module-cohesion` + `scatter-audit` · 13 new files, 13 correctly
      placed, 0 scatter, 0 catch-alls, 0 junk drawers.
- [x] dismissed · `comment-noise` · 6 sites incl. the `NOTE (EX-422)` marker · flagged, verified as
      carrying real rationale, kept.

## Simplify pass

Ran `/simplify` (4 agents: reuse / simplification / efficiency / altitude) —
13 applied, 0 left proposed, 2 filed, 4 dropped, 1 skipped; each finding folded into
`## Findings` above (tagged `simplify`). No separate report file: the gate's ledger is the record.

## Tests & suite

- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-ops.test.ts` → 11 passed (new spec)
- `display-order.test.ts` @ 5435 (`DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST`) → 15 passed (12 + 3 new DO5)
- `pnpm exec vitest run` (whole unit suite) → 161 files / 2324 passed, 37 files skipped (DB-gated)
- `pnpm typecheck` → clean
- `pnpm lint` → 0 errors, 80 warnings (all pre-existing, `src/migrations/*` unused args)
- `pnpm test:integration` @ 5435 → 35 files / 121 passed
- `pnpm build` → passed. Needed a workaround: the worktree's `node_modules` is a symlink into the
  main checkout and Turbopack refuses it ("Symlink node_modules is invalid, it points out of the
  filesystem root"). Built against a real copy, then the symlink was restored. Environment
  limitation of the worktree, not a property of the diff.
- `pnpm test:e2e` — not run (~1h, never runs unprompted). Browser coverage for this slice's paths is
  already owed by EX-525 (undo/redo) and EX-472 (⋯-menu ordering); no new E2E box is opened here.
