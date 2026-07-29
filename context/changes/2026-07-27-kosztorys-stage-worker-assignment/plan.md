# Worker↔etap assignment (EX-613) — Implementation Plan

## Overview

Give each etap an optional worker, so „należne" stops being an investment-level lump and becomes a
per-person figure. The per-worker table in „Podsumowanie podwykonawców" grows from _wypłacono only_
to _należne / wypłacono / pozostało_, and the wypłata form gets a roster that pre-fills those figures
without ever blocking a payment.

## Current State Analysis

- `kosztorys-stages` carries `plane` (nullable, `w_tools` / `own_tools`) and nothing about people.
  `src/lib/kosztorys/subcontractor-summary.ts:35-39` states the gap outright: „no work↔worker link
  exists".
- The only settlement pass that is stage-aware is `subcontractorDueByPlane`
  (`src/lib/kosztorys/settlement.ts:146-172`) — one loop over stages, inner loop over rows, already
  computing a per-etap total. A per-worker bucket is one `map.set` inside that loop.
- Realized wypłaty per worker already exist as a cached investment-scoped query
  (`sumPayoutsByWorkerForInvestment`, `src/lib/db/sum-transfers.ts:339-361`), with the null-worker
  bucket deliberately kept and labelled `UNASSIGNED_WORKER_NAME`.
- The block's per-worker table (`WorkerTotals`, `subcontractor-summary.tsx:243-280`) renders one
  „Kwota" column — Σ wypłat. Its source set is _workers with wypłaty_; a worker with etapy and no
  wypłaty does not appear at all.
- `treeToRows` (`src/lib/kosztorys/v2-rows.ts:21`) is a pure tree→rows denormalization already called
  **server-side** by `investment-summary-panel.tsx:62`. This is what makes decision #1 cheap: the same
  settlement function can be fed from the client's live grid state or from a server-fetched tree.
- The wypłata dialog is mounted in the top nav (`top-nav.tsx:31`), before any investment is known, and
  its `referenceData` is global and unparameterized — an investment-scoped roster cannot ride it. The
  precedent for selection-dependent data in that form is `use-saldo.ts` (on-demand server action,
  monotonic `requestRef` to drop stale responses, reset on type switch).
- `worker` is already **required** for a PAYOUT at both layers; `investment` is shown but optional.
  Nothing new becomes required.
- No pre-submit, non-blocking warning pattern exists anywhere in the forms tree. `transferFieldRules`
  has no severity axis — everything that fires becomes a blocking zod issue.

## Desired End State

An etap can name the person who is to do it. The subcontractor panel answers „ile jestem winien
komu" per person, with an explicit residual row for etapy nobody is assigned to. Adding a wypłata
shows what that worker is owed on the chosen investment and warns — without blocking — when the
figures cannot be trusted. Reassigning an etap that already holds executed quantities requires an
explicit confirmation naming the amount and both people.

### Key Discoveries

- `plane` is a nine-layer, fully-worked precedent for „a nullable per-etap attribute that changes
  money" — mirror it, with three deliberate divergences (nullable patch, optional at creation, no
  quantity lock), each commented at the point of divergence.
- **The `plane === null` skip happens first** (`settlement.ts:156-161`), so a plane-less etap
  contributes to no worker bucket even when a worker is assigned. Two orthogonal shortfalls; per the
  owner's decision only the plane one is surfaced.
- `stage-header.tsx:38-46` — the read-only branch predicate is `!onRename && !onRemove && !onSetPlane`.
  It must learn the fourth handler, or an `onSetWorker`-only mount falls through to the full menu.
- `kosztorys-v2-columns.tsx:380-382` — `disabled: st.plane == null` locks quantity entry. **Must not
  widen** to the worker: a worker-less etap still has a value.
- Snapshot payload change is additive ⇒ **no `SNAPSHOT_SCHEMA_VERSION` bump**, but
  `insert-kosztorys-tree.ts:40-52` must add the column to its INSERT with a tolerant
  `${s.workerId ?? null}` so old snapshots restore.
- `src/__tests__/lib/kosztorys/subcontractor-due-by-plane.test.ts:151-155` asserts the whole result
  shape with `toEqual` — adding a field breaks it mechanically.

## What We're NOT Doing

- **No splitting an etap between two people.** One etap, one worker.
- **No stripping the worker from the client share.** The share keeps shipping the tree as it does today.
- **No role gate.** „Podwykonawcy" is not role-gated today (only „Marża" is, via `financials`); it stays
  that way. MANAGER sees the per-worker figures.
- **No auto-snapshot and no undo entry** for a worker change — nothing is destroyed, and reassigning
  back is the exact inverse.
- **No worker on a transaction.** The deposit→etap bridge was built and torn out (EX-536); the
  assignment lives on the etap.
- **No quantity lock** on an unassigned etap, and no second badge on the etap header.
- **No new required field** anywhere in the wypłata form.
- **No E2E in this change** — filed to the `e2e-backlog` at the review gate.

## Implementation Approach

Three slices in dependency order: the column exists → the money splits by it → the wypłata form reads
the split. Each slice is independently shippable and independently useful.

The load-bearing structural decision is **one derivation, two feeds**: `subcontractorDueByWorker`
lives beside `subcontractorDueByPlane` in `settlement.ts` as a pure `(rows, stages) => …` function.
The editor feeds it live grid state (as it does today); the wypłata roster feeds it a server-fetched
tree through `treeToRows`. Two independent derivations are rejected — that divergence would be
unbounded and invisible, which is exactly the failure `lessons.md:19-24` names.

## Critical Implementation Details

**Ordering inside the settlement loop.** The per-worker bucket must be filled with `planeTotal`
_after_ the inner row loop and _after_ the `plane === null` `continue`. Filling it before the skip
would credit a worker for an etap that belongs to no plane and therefore contributes nothing to
`combined` — breaking the invariant `Σ per-worker + unassigned residual === combined` that Phase 2's
test pins. The UI closes the same trap from the other side (Phase 1: no worker picker on a plane-less
etap), but the loop must stay correct on its own — a legacy row can already be in that state.

**The reassignment confirm must read the money before the write.** The dialog names the executed value
of the etap, which is `Σ rows[stageKey(st.id)] × viewPrice(row, st.plane)` at the etap's own plane —
the same per-etap `planeTotal` the settlement loop computes. Take it from the existing derivation
rather than recomputing inline, or the dialog and the panel can quote different numbers.

## Phase 1: The assignment exists

### Overview

A nullable `worker` on the etap, writable from the etap header menu, with a loud confirmation when the
etap already holds executed quantities.

### Changes Required

#### 1. Migration

**File**: `src/migrations/20260728_1_add_worker_to_kosztorys_stages.ts` (+ two edits in
`src/migrations/index.ts`: import and array entry)

**Intent**: Add the nullable FK column. Hand-written — `migrate:create` emits phantom drift here.

**Contract**: `kosztorys_stages.worker_id integer REFERENCES users(id) ON DELETE SET NULL`, plus
`kosztorys_stages_worker_id_idx`. Copy the shape of
`20260718_1_add_kosztorys_stage_to_transactions.ts`, **not** the enum-typed plane migration. `down`
drops the index and the column. Filename lexical sort must match dependency order
(`lessons.md:173-178`).

#### 2. Collection field

**File**: `src/collections/kosztorys-stages.ts`

**Intent**: Declare the field so Payload's generated types and admin panel know it.

**Contract**: `{ name: 'worker', type: 'relationship', relationTo: 'users', required: false }`, sibling
to `plane`. Comment the divergence: unlike `plane`, null is a legitimate resting state.

#### 3. Types

**File**: `src/lib/kosztorys/types.ts`

**Intent**: Carry the worker through the tree and the autosave patch.

**Contract**: `KosztorysStageT` gains `workerId: number | null`. `StagePatchT` gains
`workerId: number | null` — **nullable in the patch**, unlike `plane`, because un-assigning is a legal
edit. Comment that divergence at the field.

#### 4. Tree read

**File**: `src/lib/db/kosztorys-tree.ts`

**Intent**: Select and map the new column.

**Contract**: add `worker_id` to the stage SELECT (~`:82`) and `workerId` to `mapStage` (~`:154`).

#### 5. Write path

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Let `updateStageAction` accept the new key.

**Contract**: `stagePatchSchema` gains `workerId: z.number().int().positive().nullable().optional()`.
Same action, same `['kosztorysStages']` revalidation. No new action.

#### 6. Snapshot restore

**File**: `src/lib/kosztorys/insert-kosztorys-tree.ts`

**Intent**: Restore the column so a snapshot round-trip doesn't silently drop assignments.

**Contract**: add `worker_id` to the stage INSERT column list with `${s.workerId ?? null}` — tolerant,
so snapshots written before this change still restore. **No `SNAPSHOT_SCHEMA_VERSION` bump** (additive).

#### 7. Editor state + write

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Optimistic set-worker mirroring `handleSetStagePlane`.

**Contract**: `handleSetStageWorker(stageId, workerId: number | null)` — no-op guard off `stagesRef`,
optimistic `setStages`, debounced save with the same revert closure. Exposed as
`onSetWorker: editorOnly(...)` alongside `onSetPlane` (~`:314`). No undo push (matching `plane`).

#### 8. Workers into the editor

**Files**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`,
`src/components/kosztorys/editor/*` (prop chain), `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: The header picker needs the worker list; the page already fetches `referenceData`.

**Contract**: pass `refData.workers` (`WorkerRefT[]`) down to the column builder and into
`<StageHeader>`. Active-only filtering follows the combobox precedent
(`entity-combobox-field.tsx:60`) — the reference query itself has no `active` filter.

#### 9. Header picker + the loud confirm

**File**: `src/components/kosztorys/editor/grid/stage-header.tsx`

**Intent**: A „Pracownik" section above „Rozliczenie", and an `AlertDialog` when the etap already holds
executed quantities.

**Contract**:

- Props gain `workers?: WorkerRefT[]`, `onSetWorker?: (stageId: number, workerId: number | null) => void`,
  and `executedValue?: number` (the etap's own-plane total, for the confirm copy).
- **Extend the read-only predicate** to `!onRename && !onRemove && !onSetPlane && !onSetWorker`.
- The picker is single-select skinned as `DropdownMenuCheckboxRow` (the plane pattern) plus a „Bez
  przypisania" row that patches `null` — the divergence from plane, where unsetting is impossible.
- **The whole „Pracownik" section is disabled while `stage.plane == null`** (owner, 2026-07-28). A
  plane-less etap is skipped before any value is computed, so an assignment made there would show the
  worker's name against a silent `0 zł` należne. The disabled section carries the reason as its
  helper copy: „Najpierw wybierz rozliczenie etapu — bez niego etap nie ma ceny, więc nikomu nic nie
  nalicza." This is the ordering trap from Critical Implementation Details, closed at the UI instead
  of explained after the fact.
- When the etap holds quantities (`executedValue > 0`) **and** a worker is already assigned, route the
  pick through a `ConfirmDialog` naming the etap, the amount, and both people:
  „Etap „Malowanie" ma wykonane prace na 12 400 zł przypisane do: Jan Kowalski. Przepisać na: Adam
  Nowak? Kwota przejdzie do rozliczenia nowej osoby, a Janowi Kowalskiemu pozostało do wypłaty spadnie
  poniżej zera." Conditional dialog — the shape at `kosztorys-row-actions-menu.tsx:133-153`, not the
  unconditional one already in this file.
- **No worker badge** on the header label and **no `text-destructive`** for an unassigned worker: per
  the owner's decision the plane warning is the only etap-header signal.

#### 10. Creation stays optional

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-add-menu.tsx`

**Intent**: No change to behaviour — a comment recording the deliberate divergence.

**Contract**: the add path forces a plane (`:53-58`); it must **not** force a worker. One comment
saying so, so a later reader doesn't "fix" the asymmetry.

#### 11. Quantity entry stays open

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Guard against the obvious wrong mirror.

**Contract**: `disabled: st.plane == null` stays exactly as-is. A one-line comment stating that a
worker-less etap still has a value, so it must not join this predicate.

### Success Criteria

#### Automated Verification

- Migration applies against the local DB: `pnpm payload migrate` (docker Postgres on 5433)
- Types regenerate clean: `pnpm generate:types`
- New DB-backed spec passes — `src/__tests__/lib/actions/kosztorys-stages.test.ts` extended: patching
  `workerId` persists it, patching `null` clears it (assert the **row**, not the action's return value)
- Snapshot round-trip spec passes — a snapshot captured with an assigned worker restores it, and a
  snapshot written without the key restores as `null`

#### Manual Verification

- Etap header menu offers „Pracownik" with the active worker list and „Bez przypisania"
- Assigning a worker to an empty etap saves with no dialog
- The „Pracownik" section is disabled on an etap with no rozliczenie, and states why
- Reassigning an etap that has quantities shows the confirm with the correct amount and both names;
  cancelling leaves the assignment untouched
- An unassigned etap still accepts quantities (the plane lock is the only lock)
- A read-only / preview mount shows no worker anything

**Implementation Note**: when this phase's automated verification passes, commit and continue — manual
verification is collected once at the end into the manual-checks registry.

---

## Phase 2: Money per worker

### Overview

One grouping key inside the existing settlement pass, and the panel's per-worker table grown from one
column to three.

### Changes Required

#### 1. The grouping

**File**: `src/lib/kosztorys/settlement.ts`

**Intent**: Emit a per-worker partition of the same etap set the plane split already walks — no new
traversal of the 1000-row grid.

**Contract**: `SubcontractorDueByPlaneT` gains `byWorker: Map<number | null, number>` (or a small
`{ workerId, due }[]` — pick one and pin it in the test). Filled inside the existing stage loop,
**after** the `plane === null` `continue`, from the `planeTotal` already in hand. The invariant that
must hold: `Σ byWorker.values() === combined`. The docblock gains the two consequences research
surfaced: a worker spanning both planes is not derivable from `wTools`/`ownTools`, and a plane-less
etap credits nobody even when assigned.

#### 2. Block figures

**File**: `src/lib/kosztorys/subcontractor-summary.ts`

**Intent**: Turn the per-worker row from „Σ wypłat" into „należne / wypłacono / pozostało", over the
union of both source sets.

**Contract**: `computeSubcontractorSummary(dueNet, payouts, byWorker, stages?)` returns rows of
`{ workerId, name, due, paid, remaining, state }` where:

- source set = workers with wypłaty **∪** workers with assigned etapy (a worker with należne and no
  wypłaty must appear)
- sort = `remaining` **desc**, the null-worker bucket pinned last regardless of amount (keep the
  existing pin)
- `state` distinguishes the three red cases: `'overpaid'` (`due > 0 && remaining < 0`),
  `'no_stages'` (`due === 0` and the worker has no assigned etap), `'no_executed_work'` (`due === 0`
  but etapy are assigned — nothing executed yet). **As implemented these three are gated behind
  `remaining < 0` first, so a `due 0 / paid 0` worker reads as `settled` and carries no qualifier —
  a deliberate narrowing (pinned by `subcontractor-summary.test.ts`), recorded here at the review
  gate so it isn't re-read as drift.**
- the residual row for **etapy with no worker** is its own row, never distributed across assigned
  workers

Existing docblock at `:35-39` — the one that states the gap — must be rewritten, not left lying.

#### 3. Panel table

**File**: `src/components/kosztorys/summary/blocks/subcontractor-summary.tsx`

**Intent**: Three money columns per worker, and copy that says which kind of red a negative is.

**Contract**: `WorkerTotals` grows to `Podsumowanie pracowników | Należne | Wypłacono | Pozostało`.
A negative `Pozostało` reads `text-destructive` in **all three** states, with a short qualifier
beside the row so the reader knows which: „nadpłata" / „brak przypisanych etapów" / „przypisane etapy
bez wykonanych prac". The existing per-worker `Link` into the filtered transfers list stays on the
name cell.

### Success Criteria

#### Automated Verification

- `src/__tests__/lib/kosztorys/subcontractor-due-by-plane.test.ts` updated (the `toEqual` shape
  assertion at `:151-155` breaks mechanically) and green
- New invariant spec: `Σ per-worker należne + unassigned-worker residual === due.combined`
- New specs pinning the existing siblings hold per-worker: a per-item rabat does not move a worker's
  należne (`:124-129` twin); an active global discount does not either (`:131-139` twin)
- New spec for the three `state` values and the union source set (a worker with etapy and no wypłaty
  appears; a worker with wypłaty and no etapy appears with `due === 0`)
- Sort spec: rows ordered by `remaining` desc with the null bucket last

#### Manual Verification

- „Podsumowanie podwykonawców" shows the three columns; the figures reconcile against the headline
- A worker with assigned etapy and zero wypłat appears at the top of the list
- The unassigned-etapy residual row is present and labelled, and is never folded into a person
- Each of the three negative cases renders red with the right qualifier

---

## Phase 3: The roster on the wypłata form

### Overview

An investment-scoped, on-demand roster in the wypłata dialog that pre-fills what the chosen worker is
owed, and warns twice without ever blocking.

### Changes Required

#### 1. Server derivation

**File**: `src/lib/queries/` (new module, e.g. `subcontractor-roster.ts`)

**Intent**: The same figures the editor shows, computed server-side for a host that cannot reach
editor state.

**Contract**: `getSubcontractorRoster(investmentId)` → fetch the tree → `treeToRows` → **the same
`subcontractorDueByWorker` derivation from Phase 2** → join with `sumPayoutsByWorkerForInvestment` →
the same row shape the panel renders. **Not a second derivation** — decision #1.

_(Corrected at the review gate: the shorter `getSubcontractorRoster` is what shipped — the module
name already carries the investment scope. The original contract also claimed the roster is cached
on the existing `CACHE_TAGS`; see Performance Considerations for why that was false.)_

#### 2. On-demand fetch

**File**: `src/components/forms/hooks/use-roster.ts` (new), wired in `expense-form.tsx`

**Intent**: Load the roster when an investment is chosen, drop stale responses, reset on type switch.

**Contract**: copy the `use-saldo.ts` shape verbatim — server-action fetch keyed on the current
investment id, monotonic `requestRef`, cleared when the transfer type leaves PAYOUT or the investment
clears. Renders nothing when there is no investment (a wypłata with no investment shows **no roster**,
not an empty one).

#### 3. The two warnings

**Files**: `src/components/forms/**` (the wypłata form)

**Intent**: Non-blocking but **loud** pre-submit warnings. Non-blocking ≠ quiet — these say the money
on screen is wrong, so they use the existing destructive-toned primitives at full volume (owner,
2026-07-28: „ten wykrzyknik ma krzyczeć, to są pieniądze"). **No new advisory variant is invented.**

**Contract**: two independent, purely presentational warnings rendered beside the roster; neither
touches `transferFieldRules`, neither becomes a zod issue, neither gates submit:

- (a) the investment has etapy with no assigned worker → the roster's „pozostało" figures read short
- (b) the selected worker has no etapy on this investment → their „pozostało" will look like an
  overpayment

Reuse `WarningBanner` (`ui/warning-banner.tsx:7-26`) for (a) — an investment-level statement — and the
inline badge shape for (b), which sits next to one worker's figure. Follow `SettlementPlaneWarning`'s
design rule (`settlement-plane-warning.tsx:30-32`): name the count and give the reader something to
open, never a bare sum — „a warning that only states a sum leaves the reader with nothing to open,
which is how red banners become furniture." Badge (b) needs its own `aria-label`; the existing
`PlaneUnconfirmedBadge` label names _rozliczenie etapu_ and `ReconMismatchBadge`'s is E2E-asserted.

### Success Criteria

#### Automated Verification

- Parity spec (the whole point of decision #1): given one fixture tree, the server roster's per-worker
  `due` equals the client derivation's, figure for figure
- Roster spec: no investment → no roster; investment with no etapy → roster of payout-only rows
- Submit spec: a PAYOUT for a worker with no assigned etapy still succeeds — assert the **persisted
  transaction**, not the action's return value

#### Manual Verification

- Choosing an investment on a wypłata loads the roster; switching investments replaces it; switching
  the transfer type away from wypłata clears it
- Both warnings appear in their own conditions, read as loudly as the settlement-plane warning, and
  neither blocks submit
- The roster's figures match „Podsumowanie podwykonawców" for the same investment with nothing unsaved
  in the editor

---

## Testing Strategy

Anchored on `context/foundation/test-plan.md` **Risk #1** (two surfaces disagree — literally the
editor-vs-dialog divergence) and **Risk #2** (a form/mutation change breaks the real path silently).

### Unit tests

- Per-worker grouping: the `Σ per-worker + unassigned residual === combined` invariant
- Rabat- and global-discount-invariance of a worker's należne (twins of the existing plane specs)
- The three negative-`remaining` states and the union source set
- Sort order with the null bucket pinned

### Integration tests (DB-backed, under `src/__tests__`, run by `pnpm test:integration`)

- `updateStageAction` persists and clears `workerId`
- Snapshot capture→restore preserves the assignment; a pre-change snapshot restores `null`
- A PAYOUT for a worker with no assigned etapy persists

### E2E

Not in this change. The whole „Podsumowanie podwykonawców" block is browser-untested today, and
`pickComboOption` (`e2e/helpers.ts:80`) is module-private and would have to be exported first. **File
to the `e2e-backlog` label in Linear at the review gate** — the slice owes it either authored or filed.

## Performance Considerations

The editor already runs ~6 independent O(rows × stages) passes per render over a 1000+ row grid. The
per-worker grouping adds **O(stages)** inside an existing pass — no seventh sweep. A standalone
`useMemo` recomputing the same partition is the wrong shape and must not be written.

The server roster costs one **uncached** tree read plus one payout aggregate.

_(Corrected at the review gate — the plan asserted both were cached; `buildKosztorysTree` is not
wrapped in `unstable_cache` anywhere in the repo, so every roster load re-materialises the tree.
The **code was left alone**: freshness is what a money dialog wants, and the tree answering to four
invalidating tags is precisely why it was never cached. The standing `[PERF] getSubcontractorRoster`
log line is the measurement hook if this ever shows up as slow.)_

## Migration Notes

Kosztorys data is throwaway until dogfooding merges to `main` (AGENTS.md), so no backfill and no
compat shim. The column is nullable — every existing etap is simply unassigned. Prod migration is
applied by a human via `pnpm db:migrate:prod`, **before** the code that reads the column ships.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Integration suite passes: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-07-27-kosztorys-stage-worker-assignment/research.md`
- Decisions: `context/changes/2026-07-27-kosztorys-stage-worker-assignment/change.md`
- Structural sibling: `context/archive/2026-07-23-etap-tool-plane/change.md` (EX-565, the `plane` axis)
- The deferral this closes: `context/archive/2026-07-21-podsumowanie-podwykonawcow/change.md` (EX-558)
- Why the assignment is not on a transaction: `context/archive/2026-07-22-kosztorys-zaliczka-v2/change.md` (EX-536)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The assignment exists

#### Automated

- [x] 1.1 Migration applies against the local DB — afda6fc3
- [x] 1.2 Types regenerate clean — afda6fc3
- [x] 1.3 `updateStageAction` persists and clears `workerId` (DB-backed) — afda6fc3
- [x] 1.4 Snapshot round-trip preserves the assignment; pre-change snapshot restores `null` — afda6fc3

### Phase 2: Money per worker

#### Automated

- [x] 2.1 `subcontractor-due-by-plane.test.ts` updated for the new shape and green — 3f18d858
- [x] 2.2 Invariant: Σ per-worker należne + unassigned residual === `combined` — 3f18d858
- [x] 2.3 Rabat- and global-discount-invariance of a worker's należne — 3f18d858
- [x] 2.4 Three negative-`remaining` states and the union source set — 3f18d858
- [x] 2.5 Sort by `remaining` desc with the null bucket pinned last — 3f18d858

### Phase 3: The roster on the wypłata form

#### Automated

- [x] 3.1 Parity: server roster `due` === client derivation `due`, per worker — d9b3a06a
- [x] 3.2 Roster shape: no investment → no roster; payout-only rows when no etapy — d9b3a06a
- [x] 3.3 A PAYOUT for a worker with no assigned etapy persists — d9b3a06a
