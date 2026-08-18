# Review-gate ledger — kosztorys-editor-hook-split (EX-521) · 2026-08-17

Base: `staging` · 27 files, +2663 / −774 · HEAD `069f2f44`

Fan-out: `/10x-impl-review`, `/code-review`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only).
Dropped: `tailwind-v4-audit` — the diff carries no JSX and no CSS.
Step 0.5 (browser verification) skipped: the user's standing rule forbids driving
Playwright unprompted, and the slice's manual checks are the human's to sign off.

**Trimmed at archive (2026-08-17).** The 23 `fixed` findings were removed. A fixed finding's durable
record is its commit — the code, the regression spec, and the diff say what changed and why better
than a restatement does. What survives is the negative space git cannot hold: what was looked at and
deliberately _not_ changed, and the reason. Pre-trim tally: **23 fixed, 3 closed-unfixed, 6 dropped,
2 skipped, 3 dismissed · 0 open**. Both bug-finding checks landed **0 CRITICAL**; the fixed set
converged on the ordering write path's transactionality (the `Zapisz kolejność` guard-and-bake became
one locked transaction) and on the reorder undo re-deriving its swap locally instead of replaying a
stale neighbour id.

## Findings

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
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/lib/actions/kosztorys.ts:359-390, 490-509` ·
      A swap against an already-deleted row returns `{ success: true }` — indistinguishable from the
      legitimate edge no-op. The client fires these un-awaited and discards the result either way, so
      splitting the two `null` cases buys nothing today.
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/lib/actions/kosztorys.ts:551-558` ·
      The bake numbers only the ids it was sent and never asserts the sequence covers every item of
      each touched section. Pre-existing (the client computed the same 0…n-1 before), and only
      reachable when the client's dataset is already behind the DB — which the transaction fix
      now narrows further. Left alone rather than bolted onto the same edit.
- [x] 🔵 OBSERVATION · dropped · `impl-review` · `src/lib/kosztorys/display-order.ts:37-40` ·
      The bake's id array has no `.max()`, so a large enough sheet would hit Postgres' 65535
      bind-parameter ceiling. The documented scale ceiling is ~1000 items; no reachable input.
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
      computes a next order at all, so the generalisation would have exactly one caller.
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
