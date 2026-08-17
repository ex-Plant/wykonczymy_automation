---
date: 2026-08-15T16:09:07Z
researcher: Claude (Sonnet 5)
git_commit: fc122eac74d1cd728054246c9f9f3c62f5f20bbb
branch: staging
repository: wykonczymy
topic: 'EX-521 — split the use-kosztorys-editor god hook; verify the three queued findings and settle the renderHook-harness premise'
tags: [research, codebase, kosztorys, editor, use-kosztorys-editor, testing, refactor]
status: complete
last_updated: 2026-08-15
last_updated_by: Claude (Sonnet 5)
---

# Research: EX-521 — split the `use-kosztorys-editor` god hook

**Date**: 2026-08-15T16:09:07Z
**Git Commit**: `fc122eac`
**Branch**: `staging`

## Research Question

EX-521 was filed 2026-07-17 as "split use-kosztorys-editor god hook **(behind a renderHook harness)**",
parked ever since. Two questions:

1. Are the three findings queued on it still true against current code?
2. **Is a `renderHook` harness actually required** — or is that premise stale?

## Summary

**The harness premise is refuted.** It is not merely unnecessary; installing one would contradict two
entries already in `lessons.md` and the repo's three canonical implementations of the alternative. The
real blocker was never test infrastructure — it is that the hook's logic is welded to its body, and the
fix and the testability are **the same move**: extract the core, test the core.

The three findings survive verification, but not intact — two need restating before they can be planned:

| #   | Finding                                                         | Verdict                                                                                         |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | `sectionOrderRef` is a second source of truth for section order | **CONFIRMED**, and it hides a latent bug the finding never named                                |
| 2   | Denormalized section fields have no bundle                      | **CHANGED** — one field no longer exists; sites grew 10 → 11–13; needs **two** bundles, not one |
| 3   | Undo commands are closures retaining hook contexts              | **CONFIRMED as mechanism, materially overstated as magnitude**                                  |

EX-521 is therefore not one blocked lump. It is **three independent slices plus a pure-extraction
backlog**, and only one of them is urgent.

## Detailed Findings

### The harness question — settled, three ways

**1. Doctrine already exists.** Two `lessons.md` entries rule on exactly this:

- `lessons.md:389` — _"This repo has no hook renderer — logic that must be tested has to live OUTSIDE
  the hook"_. Its rule: extract a pure function beside the hook and test that; anything genuinely
  hook-internal is a **browser-level** risk here and goes to `/10x-e2e`, "not to a hook-renderer dependency."
- `lessons.md:954` — _"No hook-test infrastructure is a design signal, not a blocker — extract the logic,
  don't install a runner"_. Its rule: _"When a behaviour is only reachable through a rendered hook, that
  is usually the hook hoarding logic that isn't stateful… Reach for new test infrastructure only when
  the thing under test is actually React behaviour."_

That second lesson was written about EX-577 declining a `renderHook` spec — the same decision, already
made once.

**2. Three canonical implementations of the alternative are in-tree.** The shape is a React-free core
plus a thin hook wrapper:

- `editor/hooks/use-undo-redo.ts:41-101` — `createUndoRedoStack(maxDepth)`. Owns the entire contract
  (LIFO, redo-clear-on-push, depth-cap eviction, `pruneByIds`). Critically `undo()`/`redo()` **return
  the command rather than executing it** (`:53-66`) — the effect is the caller's job, which is what
  makes it testable with no DOM. The hook (`:108-150`) is 40 lines of pure React: `useState(factory)`
  for a stable identity, a `bump` counter, five wrappers.
- `lib/kosztorys/save-lanes.ts:13-38` — `createSaveLanes`, comment at `:6`: _"Pure + React-free so the
  ordering contract is unit-testable without a DOM."_
- `hooks/create-json-map-store.ts:22-70` — pure `parseJsonMap`/`dropKeys` + a stateful factory;
  `use-column-widths.ts` is then a **12-line hook with zero logic of its own**.

The spec for the first says it out loud (`use-undo-redo.test.ts:7`): _"The stack core is React-free
so the ordering contract is tested directly."_

**3. The `.tsx` objection doesn't hold either.** `vitest.config.ts:6` includes only
`src/__tests__/**/*.test.ts`, but a `.ts` spec **already imports a `.tsx` source module today** —
`editor/grid/v2-columns-order.test.ts:2` imports `buildV2Grid` from `grid/kosztorys-v2-columns.tsx`.
esbuild transforms it; the node env is fine as long as the spec calls a non-rendering export. So "the
logic lives in a `.tsx` file" is not a reason to need a DOM.

**Cost of the harness we are declining**: `@testing-library/react` + `@testing-library/dom` +
jsdom/happy-dom; `test.environment` change (or per-file docblocks to avoid slowing the ~120-file node
suite); an include-glob widening; and a `pnpm install` on this arm64 box, which is the documented
lightningcss hazard (`AGENTS.md` → Dependencies, `lessons.md:5`).

**The one genuinely DOM-shaped piece** is `hooks/use-undo-keyboard.ts` — a `keydown` listener with an
editable-focus escape hatch, self-described in-file as a _"FLAGGED heuristic (needs browser
verification)"_. That routes to E2E (fold into the already-owed **EX-525**), not to a harness. Its
decision logic (modifier + key + shift → undo/redo/none) can still be extracted as a pure predicate.

> **Conclusion:** delete the harness clause from EX-521. It was a deferral rationale, not a dependency.

### Finding 1 — `sectionOrderRef` (CONFIRMED, plus a latent bug)

Confirmed exactly as filed. `use-kosztorys-editor.ts:252` seeds `useRef(new Map(tree.sections.map(s =>
[s.id, s.displayOrder])))`; **4 mutating handlers, 5 `.set` statements, 1 read**:

| Line       | What                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `:252`     | mount seed                                                                                            |
| `:834-840` | `applySectionSwap` — reads both absolute orders, exchanges them, fires `swapSectionOrderAction(a, b)` |
| `:881-883` | `handleInsertSection` — reads `anchorOrder`, computes `at`                                            |
| `:889-891` | **the SQL mirror** — `for (const [id, order] of …) if (order >= at) set(id, order + 1)`               |
| `:892`     | stamps the new section at `at`                                                                        |
| `:902`     | `handleAddSection` caches the returned `displayOrder`                                                 |
| `:924`     | `handleAppendedSections` caches each appended section's                                               |

**The mirror is faithful today** — and that is the problem. Server side, `lib/kosztorys/display-order.ts:64-79`:

```sql
UPDATE ${table} SET display_order = display_order + 1
WHERE id IN (SELECT id FROM ${table}
             WHERE ${owner} = ${ownerId} AND display_order >= ${at}
             ORDER BY id FOR UPDATE)
```

Lines `:889-891` are a literal transliteration — same predicate, same delta, same scope. The statement
is `scope`-parameterised and **shared with `kosztorys-items`** (`ORDER_SCOPES`, `:13-16`), so an
items-side change to that SQL silently changes the rule the sections client is mirroring.

**The latent bug the finding never named:** `sectionOrderRef` is seeded at mount and **never re-seeded
after `router.refresh()`**. This is the same family as `lessons.md:165` (denormalized fields changed
outside the grid; a `useState`/`useRef` initializer is a mount-time snapshot). The in-file comment at
`:886-888` states the stakes: _"a missed shift makes every later section move exchange the wrong ones."_

`row-ops.ts:156-158` already proves the better mechanism — `groupBySection` derives the section
sequence from the rows array by first-appearance order. `neighborSectionId` (`:200-209`) resolves the
▲▼ neighbour from `rows` alone, and **`applySectionSwap` already calls it** (`:832`) — reaching for
`sectionOrderRef` only to get the two absolute integers. The rows array is already authoritative; the
ref exists solely to translate that sequence into DB integers.

**Proposed fix #1 (direction-based actions) — feasible, blast radius narrow.** The UI callbacks are
_already_ `(sectionId, 'up'|'down')` / `(sectionId, 'above'|'below')`
(`kosztorys-v2-columns.tsx:229-232`); the hook is the only place translating them into absolute
integers. There is exactly **one production caller** of each action. Real costs:

- `swapDisplayOrder` currently opens its own `getDb(payload)` outside a transaction. Server-side
  neighbour resolution forces it onto a transaction handle **while preserving the `ORDER BY id FOR
UPDATE` lock discipline** (`display-order.ts:87-92`, EX-632) or the deadlock guard is lost. _This is
  the main real work._
- It forks the sections/items symmetry that `display-order.ts` exists to maintain (its stated purpose,
  `:7-8`, EX-578). Either do both sides or accept the asymmetry deliberately.
- Edge no-op semantics: today the action is `void`-fired with no error handling (`:841`), so a
  server-side edge no-op would be invisible.
- `display-order.test.ts:170` and `:242-245` need rewriting to the new signatures.

**Respects `lessons.md:112`** ("swap 2 rows, don't renumber the section") — moving _resolution_ to the
server changes who computes the numbers, not how many rows are written. And it is **more** compatible
with the DnD→sparse-keys migration the corollary (`lessons.md:119-123`) mandates: absolute integers
stop leaking to the client entirely, so the key type becomes a server-only implementation detail.

### Finding 2 — section-field bundle (CHANGED SINCE FILING)

**`sectionDefaultCostVariant` no longer exists** — zero occurrences in `src/` or `e2e/`, removed by
`drop-cost-variant-columns` (2026-07-28, two days _after_ the finding was filed). The denormalized
section identity is today **two** fields: `sectionName` + `sectionColor`. Any cost estimate assuming
three is stale.

The tax has **grown**, not shrunk — 15 sites hand-list the pair, of which `synthetic-rows.ts:53/62`
and `settlement-aggregates.ts:103` did not exist when the finding was written. A new section field
costs **11–13 edits** today, in three groups:

- **Row-carrier (7 sites)** — `types.ts:191`, `row-ops.ts:23`/`:58`, `v2-rows.ts:39`,
  `use-kosztorys-editor.ts:650`, `synthetic-rows.ts:53`/`:62`. A `sectionRowFields()` projection
  collapses these.
- **Call sites (3)** — `use-kosztorys-editor.ts:674`, `:703`, `:871`, all passing
  `sample.sectionName`/`sample.sectionColor` → collapse to one spread.
- **Subtotal/chart (4)** — `types.ts:213` (`SectionSubtotalT`), `settlement-aggregates.ts:103`,
  `chart-slices.ts:53`, `kosztorys-v2-columns.tsx:226`. **A `Pick<KosztorysV2RowT, …>` does not reach
  these** — it is a second denormalization of the same identity onto a _different_ type.

**So the proposed single bundle is under-specified: this needs two.** Arguably the `SectionSubtotalT`
half is the more valuable one (declaration + accumulator + `Pick` across three files).

The write half **is** already unified (confirmed): `SECTION_ROW_FIELDS` (`:1043`) drives generic
`applySectionField` (`:1051`) / `handleSetSectionField` (`:1071`). But it is **not** the natural home
for the read bundle — it maps `rowKey → DB column` for _writable_ fields consumed by
`updateSectionFieldAction`. A read-only denormalized field would belong in the projection but not in
that map. Two adjacent constants sharing a comment is the honest shape, not one.

### Finding 3 — undo closures (CONFIRMED mechanism, OVERSTATED magnitude)

**The mechanism is real.** Five producers, all routing through `pushCommand` (`:331`) into a stack
capped at `MAX_DEPTH = 50` (`use-undo-redo.ts:35`): `:284-289` (grid burst), `:782-787` (item ▲▼),
`:821-826` (order renumber), `:856-861` (section reorder), `:339` via `pushReversible` (coeff / VAT /
discount / section field). All five inner functions are declared in the hook body, so V8
context-allocates and one retained command pins that render's whole activation object. Up to 50
distinct contexts can be alive.

**The magnitude claim does not survive scrutiny.** Four corrections:

1. **Structural sharing.** Every mutation path (`row-ops.ts:17`, `:120`, `:190`;
   `use-kosztorys-editor.ts:588`, `:1106`) is a `map`/spread producing new row objects **only for rows
   that changed**. A typing burst on one cell yields a 1000-element array whose 999 other slots point
   at the _same_ objects. Per-snapshot cost ≈ 1000 pointers (~8 KB) + the few changed rows — not a
   deep copy.
2. **`gridColumns` is not in the hook at all** — columns are built in `grid/kosztorys-v2-columns.tsx`.
   That item of the finding's retained list is simply wrong.
3. **`prevById` is a `useRef`** (`:238`) — one stable object across the mount, not multiplied by 50.
4. **The `useMemo` derivations alias rather than multiply** — renders that don't change deps hand back
   the identical object; `subtotals` is per-_section_ (tens), not per row.

Honest restatement: **plausibly low single-digit MB**, not "50 copies of the dataset". Worth fixing on
cleanliness grounds; **not the memory emergency the phrasing implies** — which moves it to the back of
the queue, not the front.

The one genuinely size-proportional payload is `handlePersistKosztorysOrder`'s `before`/`after`
(`:814-826`) — and those are the command's _data_ either way, so command-as-data does not fix it.

**Command-as-data is orthogonal to the EX-526 undo↔autosave reconciliation** — a dispatcher would call
the same `runGridReversal` on the same lane keys, so the ordering guarantee is preserved by
construction. Two things need care: `pruneByIds` reads `command.touchedIds`, and for
`'Zapisanie kolejności'` / `'Zmiana kolejności sekcji'` those ids are **captured before the mutation on
purpose** (`:851-853`) and cannot be re-derived at dispatch time — the descriptor must carry them as
payload. And the existing `use-undo-redo.test.ts` would stay green through this refactor **without
proving anything**, so it is no regression guard.

### Structural map — where the seams are

**14 state pieces** (7 `useState`, 1 `useTransition`, 6 `useRef`) + 8 delegated hooks; **62 returned keys**.

| Cluster                                                                | ~LOC | Verdict                                                                                                                         |
| ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| View state (search/sort/collapsed/view/axis/layer/widths/hidden/order) | ~70  | **STATEFUL, cleanly extractable** — zero dependency on `rows`/`stages`/actions. Highest-value first cut.                        |
| Derived figures (15 `useMemo`s, `:360-546`)                            | ~130 | **PURE, trapped.** Every one is a `useMemo` over a pure lib call.                                                               |
| Column build (`:346-437`)                                              | ~90  | **STATEFUL-by-coupling** — the `columnOpts` literal (34 keys) references 12 handlers declared _below_ it. The central junction. |
| Undo wiring                                                            | ~170 | **STATEFUL**, but coalescing is already pure and tested in `undo-coalesce.ts`.                                                  |
| Row ops (`:650-828`)                                                   | ~180 | **STATEFUL** shell over already-pure `row-ops`/`delete-policy`.                                                                 |
| Section ops                                                            | ~180 | **STATEFUL**, couples to row ops via the delete cascade and `prevById`.                                                         |
| Stage ops (`:930-1015`)                                                | ~86  | **STATEFUL but the loosest cluster** — touches `rows` only via `patchRows`, never the undo stack.                               |
| Save/settings (`:1102-1320`)                                           | ~220 | **STATEFUL, thinnest coupling of the mutation clusters.**                                                                       |
| `onChange` (`:1322-1396`)                                              | ~75  | **STATEFUL**, irreducible as a whole — but hides the single highest-value pure extraction.                                      |

**Couplings that block extraction, ranked:** (1) `columnOpts` forward-references 12 handlers via
declaration hoisting — sub-hooks must be called _before_ the column build; (2) `patchRows` (`:1102`) is
used by stages, sections, settings and coeffs — extract or thread it first or four clusters can't move;
(3) `prevById` serves as both diff snapshot **and** full-dataset read (`:669`, `:697`, `:719`, `:1022`)
— two responsibilities on one ref; (4) `flushUndoBuffer` is called from row ops, section ops,
`pushCommand` and the returned `undo`/`redo`; (5) `handleRemoveItem → handleRemoveSection` (`:742`)
crosses the row/section boundary.

**14 pure functions are trapped in the hook body with no test.** The five highest-value:

| Location                                | Extraction                                                              | Why                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `:1326-1378` (the `onChange` diff loop) | `lib/kosztorys/grid-change-plan.ts` → `planGridChanges(next, prevById)` | **Highest value.** The editor's core diff→write→undo-capture decision, reachable only through a mounted grid today. |
| `:577-596`                              | `undo-reversal.ts` → `buildReversalPatches`                             | merge-by-row-id rule, untested                                                                                      |
| `:601-623`                              | → `planReversalWrites`                                                  | lane-key + value/restore pairing                                                                                    |
| `:230-231`                              | `money-axis.ts` → `effectiveMoneyAxis`                                  | three-branch nested ternary, zero tests                                                                             |
| `:467-476`                              | `row-view.ts` → `buildViewRows`                                         | filter→condition→sort pipeline order                                                                                |

Also notable: `:889-892` (the section tail shift) and `:851-853` (the `touchedIds` pre-capture) — the
two the test-infra pass independently flagged as highest-value, both pure arithmetic, both untested at
every layer.

### Blast radius — narrow, if the return stays flat

**Exactly one call site**: `kosztorys-editor-body.tsx:72`, which destructures 25 keys and spreads the
whole object into the provider (`:188`). The context type is `ReturnType<typeof useKosztorysEditor>`,
fanning out to **10 consumer components** (toolbar, view menu, filters/add/actions menus, global
settings, discount control, VAT field, stages tab, preset dialog).

- **Renaming/dropping a returned key breaks consumers at compile time** — `tsc` is a reliable gate for
  the whole refactor.
- **Regrouping the return** (`editor.view.search` instead of `editor.search`) touches all 10 consumers
  plus the 25-key destructure. **Avoid.** Compose sub-hooks internally, keep spreading them flat into
  the same 62-key object → the diff is confined to the hook plus new files, and **zero consumers change**.
- No test and no E2E imports the hook by name.
- One alias to watch: `onRenameSection: columnOpts.onRenameSection` (`:1426`) re-exports out of the
  column-options literal; if the column build moves, that alias moves with it.

## Architecture Insights

**Two hard constraints inherited from prior work, both easy to violate by accident:**

1. **Do not chase React Compiler memoization.** EX-496 (Done) rules: _"Nie ścigamy kompilacji poza
   rozbiciem hooka"_ — the gain was theoretical, the only attempt (`4c7a1cd7`) regressed perf and was
   reverted (`1f8ffdc5`), and the measured O(n²) was a separate issue (EX-517, done). EX-496 #1 is
   parked _behind_ this split, not a goal of it.
2. **Do not move handlers into context to buy stable identity.** That was precisely the reverted
   attempt: the context **value is the whole hook return object, whose identity churns every render**,
   and React re-renders every consumer on a value-identity change — `React.memo` and datasheet-grid's
   per-row memoization do not stop it. Result was per-keystroke re-renders of every row/header cell on
   a 1000+ row grid (`lessons.md:366`, and `context/archive/2026-07-17-kosztorys-editor-compile-fix/change.md:34-52`).

**The repo's routing rule for extracted logic** is well-established: either (a) a module-level pure
function in `src/lib/kosztorys/` — 60 modules, 51 specs — or (b) a `create*` closure factory colocated
with its hook. The hook then owns _only_ `useState`/`useRef`/timers/`router`. `renderHook` has never
been needed for either shape.

## Code References

- `src/components/kosztorys/editor/use-kosztorys-editor.ts:252` — `sectionOrderRef` mount seed
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:889-891` — the client mirror of the server SQL
- `src/lib/kosztorys/display-order.ts:64-79` — the server statement being mirrored
- `src/lib/kosztorys/display-order.ts:87-92` — `ORDER BY id FOR UPDATE` lock discipline (EX-632)
- `src/lib/kosztorys/row-ops.ts:156-158` — `groupBySection`, the mechanism that makes the ref redundant
- `src/lib/kosztorys/row-ops.ts:200-209` — `neighborSectionId`, already called at `:832`
- `src/components/kosztorys/editor/hooks/use-undo-redo.ts:41-101` — `createUndoRedoStack`, the reference pattern
- `src/lib/kosztorys/save-lanes.ts:6` — _"Pure + React-free so the ordering contract is unit-testable without a DOM"_
- `src/__tests__/components/kosztorys/editor/grid/v2-columns-order.test.ts:2` — a `.ts` spec importing a `.tsx` module
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:851-853` — `touchedIds` captured pre-mutation
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:1322-1396` — `onChange`, the highest-value extraction
- `vitest.config.ts:5-9` — node env, `.ts`-only include
- `scripts/test-integration.sh:44-47` — DB-spec discovery by `skipIf(!ENV_READY)` marker, not by path

## Historical Context

- `context/archive/reviews/2026-07-26-staging-toolbar-sections-color.md:44` — where all three findings
  were filed together, explicitly _"all wait on the same `renderHook` harness"_. That coupling is the
  premise this research refutes.
- `context/archive/reviews/2026-07-17-staging-batch.md:37` — _"test: TDD · unit (renderHook) — owed
  under EX-521 (the hook has no harness yet)"_.
- `context/archive/2026-07-17-kosztorys-editor-compile-fix/change.md:66-69` — EX-521 parked, citing _"a
  dependency-install prerequisite (`@testing-library/react` + a DOM env … which trips the arm64
  `lightningcss` hazard)"_. That prerequisite is exactly what we are declining.
- `context/foundation/roadmap.md:361` — S-07 owes a `hasPendingBurst` unit test "behind the renderHook
  harness". Now unblocked: it is one line (`:1482-1483`), extractable as `undoAvailability(canUndo,
canRedo, hasPendingBurst)`.

## Test Routing

**Anchor risks** (`context/foundation/test-plan.md`): **#4** _"Editor data loss — optimistic autosave
swallows an error, an unsaved change is lost, and there is no way to revert"_ and **#2** _"A form /
mutation change breaks the user-facing path silently"_. Rollout **Phase 3** ("Kosztorys calc-core +
editor safety", risks #1/#4/#6) is `not started` — this work is a down-payment on it.

**Gap worth recording:** no named risk covers **section-ordering integrity** specifically. That may
warrant a `/10x-test-plan` extension rather than being smuggled in under #4.

**Layer routing:**

- Extracted pure functions → plain vitest under the mirrored `src/__tests__` path.
- Direction-based actions → DB-integration (`skipIf(!ENV_READY)`), joining `display-order.test.ts`.
- `useUndoKeyboard`'s focus check → E2E only.

**Already-owed E2E (do not re-file):** **EX-525** (undo/redo — `grep -rn "undo" e2e/` returns nothing;
zero browser coverage) and **EX-472** (section/row ⋯-menu ops + order integrity). `kosztorys-section-headers.spec.ts`
is the only editor-grid spec and covers bands only — not add/insert/delete/reorder.

**The untested seam that matters most:** the server SQL and the client mirror are each tested in
isolation; **their agreement is not**. Insert a section mid-sheet → move a later section → reload is
untested at every layer. This is the `lessons.md:40` shape ("an invariant enforced in two planes needs
a test on the BRIDGE, not one test per plane") — and the direction-based fix **deletes the second
plane**, which is a better answer than testing the bridge.

## Open Questions

1. **Sections-only or sections+items?** Direction-based resolution forks the symmetry
   `display-order.ts` exists to preserve (EX-578). Doing both doubles the slice; doing one leaves a
   deliberate asymmetry needing a comment.
2. **Is the `SectionSubtotalT` bundle in scope**, or is the row-carrier projection enough for now?
3. **Does finding 3 still earn a slice** now that the magnitude is low single-digit MB? It may be
   better folded into whichever slice touches those producers anyway.
4. **Should the section-ordering-integrity risk be added to `test-plan.md`** before writing its tests?
