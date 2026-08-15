# Review-gate ledger — kosztorys-column-order (EX-692) · 2026-08-15

Scope: `39a3856d..HEAD` + uncommitted working tree, minus `src/components/tables/transfers.tsx`
(another agent's commit that rode this branch).

- `src/lib/kosztorys/column-order.ts`
- `src/components/kosztorys/editor/hooks/use-column-order.ts`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`
- `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`
- `src/components/kosztorys/editor/use-kosztorys-editor.ts`
- `src/components/kosztorys/editor/dialogs/column-order-dialog.tsx`
- `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx`
- `src/lib/utils/group-in-order.ts` (added at the gate)
- `src/lib/kosztorys/row-ops.ts`, `src/hooks/create-json-map-store.ts`, `src/components/kosztorys/editor/hooks/use-column-widths.ts` (pulled in by gate dedups)
- `src/__tests__/lib/kosztorys/column-order.test.ts`
- `src/__tests__/components/kosztorys/editor/grid/v2-columns-order.test.ts`

Step 0.5 (verification pass): no `verify-manual-checks` skill installed; the user verified the
slice by hand and reported it working.

## Findings

- [x] 🟡 WARNING · fixed · impl-review+code-review · `dialogs/column-order-dialog.tsx:66` · anchors hoisted to a top block, so the window draws an order the grid does not have (real head is `actions → divergence → sectionName → description`); a drop one row down silently jumps a fixed slot — render one list in true order, anchors inline and non-draggable
      test: TDD · unit — covered by the extracted commit helper's specs below
- [x] 🟡 WARNING · fixed · impl-review+code-review · `dialogs/column-order-dialog.tsx:91` · Reorder sits in a scroller it doesn't own: no `min-h-0` (DialogContent scrolls, footer scrolls away at ~24 groups) and no `layoutScroll` (drags mis-measure after a scroll)
      test: no automated test · e2e — drag projection under scroll is invisible to jsdom; belongs to the owed E2E
- [x] 🟡 WARNING · fixed · impl-review+code-review · `lib/kosztorys/column-order.ts:112,132` · the whole commit path (`movedKey`, the render-phase sync, drop→rank hand-off) is the only untested logic in the slice, and the one heuristic in it
      test: TDD · unit — export the commit arithmetic and spec long move / adjacent swap / no-op / unknown key
- [x] 🟡 WARNING · fixed · impl-review · `plan.md:149,277` · plan stale in three places vs what shipped (menu entry is a `DropdownMenuItem` outside `Command`; edges take global min−1/max+1; `baseRanksFromKeys` / `columnBaseRanks` / the 7th dialog prop are undocumented)
- [x] 🔵 skipped · code-review · `lib/kosztorys/column-order.ts:10` · the anchor holds a GROUP slot, not a column position — dragging the 10-column stage block to slot 0 pushes `description` (and the section band's label) ~1500px right. Deliberate owner action with an immediate, undoable result; restricting it changes what the user may do, so it is surfaced, not auto-applied
      test: no automated test — no fix landed; decision owed to the owner
- [x] fixed · structure/module-cohesion · `lib/kosztorys/column-order.ts:77` · `assembleBaseRanks` re-implemented the group-collapse loop `orderColumns` owns — and `row-ops.ts` held a third copy; extracted `groupInOrder` / `regroupByKeys` into `lib/utils/group-in-order.ts`, all three call it
- [x] 🔵 fixed · code-review · `hooks/use-column-order.ts:20` · nothing guards a persisted rank against a non-finite value; localStorage is client-writable and these values feed `-`/`<`
- [x] 🔵 fixed · impl-review · `lib/kosztorys/column-order.ts:40` · the "pairwise distinct" comment overstates the invariant — the assemble-index space is per-view, so a rank from „Z narzędziami" can tie an unranked key in „Klient" (ties resolve deterministically; only the claim is wrong)
- [x] 🔵 fixed · impl-review · `dialogs/column-order-dialog.tsx:101` · anchored rows draw a faint grip the plan says they must not have
- [x] 🔵 fixed · impl-review · `grid/kosztorys-v2-columns.tsx:716`, `column-order.ts:49`, `column-order-dialog.tsx:70` · three nits: redundant `(id) => toggleKey(id)` wrapper, `ColumnRanksT` beside a raw `Record<string, number>` for the same shape, `.join()` comparison assuming no id contains a comma
- [x] 🔵 fixed · code-review · `toolbar/kosztorys-view-menu.tsx:43` · `framer-motion` now ships in the editor chunk although the dialog is opened rarely — gate the mount so the chunk loads on first open. **Later reverted** at the simplify pass — the premise was false (see the altitude finding below)
- [x] fixed · comment-noise · `__tests__/lib/kosztorys/column-order.test.ts:11` · comment narrates the two-line body beneath it
- [x] fixed · comment-noise · `column-order.ts:20`, `column-order.test.ts:28`, `v2-columns-order.test.ts:7` · three comments carry a why plus a restatement of the code/test names — trim to the why
- [x] dropped · impl-review+code-review · `e2e/` · browser-level drag slice would normally owe a Playwright spec — **owner ruled it out for this change (2026-08-15)**: no spec, no `e2e-backlog` entry. (Filing had failed anyway: the workspace is over its free issue limit.) The browser risk is covered by the manual-check list; the EX-692 comment listing the six risks stays as the record of what was dropped
      test: no automated test — dropped by owner decision
- [x] 🔵 dismissed · code-review+impl-review · `column-order.ts:56` · fractional-rank precision — measured: ~52–60 successive drops into one gap before ties, and „Przywróć domyślną kolejność" is the escape hatch
- [x] 🔵 dismissed · impl-review · `column-order.ts:41` · a midpoint between two dialog-adjacent keys can straddle groups the picker filters out (rabat columns under a global discount) — invisible while excluded, and the qualified comment above records it
- [x] 🔵 dropped · impl-review · `v2-columns-order.test.ts:72` · `columnBaseRanks` spec is near-tautological — rewriting it buys nothing
- [x] 🔵 dropped · code-review · `grid/cells/section-footer-cell.tsx:18` · footer label falls back to `sectionName`, so hiding „Opis prac" AND dragging „Sekcja" right strands the „Razem" label — pre-existing shape, two deliberate actions deep
- [x] 🔵 dropped · code-review · `column-order-dialog.tsx:134` · reset button counts stale keys for columns that no longer assemble — cosmetic, the intersect costs more than it buys
- [x] dismissed · tailwind-v4-audit · `column-order-dialog.tsx:85` · `max-w-[min(90vw,420px)]` is the repo's dialog-width idiom (`ui/dialog.tsx:55`, `expense-dialog.tsx:17`), not a stray arbitrary value
- [x] dismissed · feature-first/scatter · — · all three new files landed in the dominant existing home for their kind; no new home, no scattered kind, primitives reused rather than re-rolled

- [x] fixed · simplify/altitude+reuse · `dialogs/column-order-dialog.tsx:76`, `column-order.ts:97` · the dragged key was reconstructed by a furthest-travel diff (`movedKey`/`rankForDrop`) although `Reorder.Item`'s `onDragEnd` fires inside the closure that owns it — commit takes the key directly; the heuristic, its `indexOf === -1` guard and its specs are gone
- [x] fixed · simplify/reuse+altitude · `column-order.ts:23`, `column-order-dialog.tsx:68` · the anchor-slot interleave was implemented twice, and only the grid's copy was tested — extracted `placeMovables` / `movableColumnKeys`, both surfaces call it, spec asserts the two agree
- [x] fixed · simplify/reuse · `hooks/use-column-order.ts:20` · `withFiniteRanks` re-rolled the identity-preserving map filter `dropKeys` already is — `dropKeys` moved to its honest home (`hooks/create-json-map-store.ts`, beside `parseJsonMap`) and both hooks call it
- [x] fixed · simplify/efficiency · `grid/kosztorys-v2-columns.tsx:721` · the group→sort→regroup pass ran on every render for owners who never reordered (`!opts.columnRanks` never fires — the hook always hands over `{}`) — bail on an empty rank map, keeping the assembled array's identity
- [x] fixed · simplify/altitude · `toolbar/kosztorys-view-menu.tsx:96` · `next/dynamic` + an `orderMounted` latch reverted: `(frontend)/template.tsx` already imports framer-motion on every authenticated route, so the split bought only the `Reorder` submodule at the cost of the repo's only bespoke lazy-dialog wiring
- [x] skipped · simplify/altitude · `column-order.ts:46`, `kosztorys-v2-columns.tsx:726` · base ranks are derived per view, which is why the distinctness guarantee is only per-view; deriving them once from `COLUMN_LABELS` would delete the four-level `columnBaseRanks` thread AND the caveat — real, but it changes cross-view ordering semantics and deserves its own review
- [x] dropped · simplify · `toolbar/kosztorys-view-menu.tsx:162` · the column-list block sits ~7 levels deep and could be a local `ColumnListSection` — one cohesive section traded for a six-prop indirection
- [x] dismissed · simplify/efficiency · `column-order-dialog.tsx:48` · list re-derived on each render while open — ~30 keys and a label Map; snapshotting costs more than it saves
- [x] dismissed · simplify/altitude · `column-order-dialog.tsx:56` · props-into-state with a render-phase resync is the repo's own idiom (`ui/decimal-field.tsx:68`, `summary/global-discount-control.tsx:58`) and the mount latch is gone anyway
- [x] dismissed · simplify · `column-order.ts:51` · unexport `rankForMove` — it is the slice's core arithmetic and its round-trip specs are the ones that matter
- [x] dismissed · simplify/reuse · `column-order-dialog.tsx:131` · footer via `DialogActions` — that shell is cancel+confirm; this one is reset+close with a disabled guard it has no prop for
- [x] dismissed · simplify · `__tests__/lib/kosztorys/column-order.test.ts:16` · spec hardcodes the two anchor keys instead of importing `ANCHORED_COLUMN_KEYS` — deliberate independence from the module under test
- [x] dropped · reuse-scan · `column-order.ts:10` · `ANCHORED_COLUMN_KEYS` sits outside `column-config.ts`, where the other column-policy sets live, and `'actions'` is a raw literal with no `ACTIONS_COLUMN_ID` to reuse — placement/naming, pre-existing pattern

## Simplify pass

Ran `/simplify` (4 parallel angles: reuse, simplification, efficiency, altitude) + `primitive-reuse-scan` — 5 applied, 0 proposed, 6 dismissed, 2 dropped, 1 skipped; every finding folded into `## Findings` above (tagged `simplify` / `reuse-scan`). No separate report file: the ledger is the report.

## Tests & suite

- `pnpm typecheck` — clean
- `pnpm test` (unit) — 2291 passed, 115 skipped, 0 failed
- `pnpm lint` — 2 errors, both pre-existing in the untouched root `test.js` (`no-undef` on `console`); zero findings in `src/`
- `pnpm build` — passed (exit 0)
- `pnpm test:e2e` — NOT run (never run unprompted; the slice's browser coverage is the open E2E box above)
