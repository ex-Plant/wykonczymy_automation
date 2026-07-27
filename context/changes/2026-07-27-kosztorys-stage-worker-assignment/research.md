---
date: 2026-07-27T21:22:44Z
researcher: Claude (Opus 5)
git_commit: f32c52595313dbac80af9878fe9770af4d0bb064
branch: ex-607-kosztorys-section-footer-row
repository: wykonczymy
topic: 'Assign one worker per etap; attribute należne per worker; roster on the wypłata form'
tags: [research, codebase, kosztorys, stages, settlement, payouts, transfers]
status: complete
last_updated: 2026-07-27
last_updated_by: Claude (Opus 5)
---

# Research: worker↔etap assignment (EX-613)

**Date**: 2026-07-27 21:22 UTC
**Researcher**: Claude (Opus 5)
**Git Commit**: `f32c5259`
**Branch**: `ex-607-kosztorys-section-footer-row`
**Repository**: wykonczymy

## Research Question

Add a nullable `worker` to `kosztorys-stages` (one etap, one worker, planned „kto ma zrobić"),
derive `należne` per worker from executed work, and surface a roster on the wypłata (PAYOUT) form
that pre-fills but never gates. What is the real shape of the code this lands in, and what breaks?

## Summary

The feature is **one column plus one grouping key**, and the surrounding machinery is unusually
complete. `plane` on `kosztorys-stages` is a near-exact structural template for `worker`, the
per-worker PAYOUT sum already exists as a cached investment-scoped query, and the per-worker table
in „Podsumowanie podwykonawców" is already a roster — it is one derivation short of the whole
feature. The code even states the gap outright
(`src/lib/kosztorys/subcontractor-summary.ts:35-39`).

Six findings change the plan:

1. **`SubcontractorSummary` has exactly ONE host — the editor — and its figures are computed
   CLIENT-side** (`use-kosztorys-editor.ts:441`, a `useMemo` over live grid state). The investment
   page deliberately drops the „Podwykonawcy" tab. **There is no server-side `należne` path today.**
   The wypłata dialog is a _third_ host that cannot reach client editor state, so slice 3 needs a
   new server derivation — and that introduces a live-edits-vs-saved-state divergence between the
   two surfaces. This is the "two planes both green" drift `settlement.ts:70-72` warns about, and it
   is the single biggest design risk in the change.
2. **There are TWO independent null residuals, not one.** A `plane === null` etap is skipped
   _before_ any value is computed (`settlement.ts:156-161`), so a worker assigned to a plane-less
   etap earns nothing from it. Worker-unassigned is orthogonal. The invariant is
   `Σ per-worker + unassigned-worker residual == combined`, and `combined` is itself already short
   of the executed work whenever `hasUnconfirmedPlane`.
3. **The client share ships the full tree unstripped** — `client-kosztorys.ts:19-22` says so
   explicitly ("the owner accepted the leak"). A `worker` on `KosztorysStageT` reaches the client's
   RSC payload even if no component renders it.
4. **No pre-submit, non-blocking warning pattern exists in the forms tree.** Everything is binary
   zod. The only warning channel is `ActionResultT.warning` → a _post-submit_ toast, which is the
   wrong moment for "you're about to pay someone with no assigned work" — and which the optimistic
   submit branch drops on the floor anyway (`use-form-submit.ts:42-54`).
5. **`worker` is already hard-required for a PAYOUT; `investment` is optional.** So the roster is
   purely additive, and a wypłata with no investment must render no roster at all (not an empty one).
6. **History says: do not put an etap on a transaction.** The deposit→etap bridge was built and torn
   out (EX-536, migration `20260721_0`), after two follow-up bugs keeping the cross-aggregate tag
   coherent. EX-613 does not re-introduce it — the assignment lives on the etap.

## Detailed Findings

### A. The `plane` template — what to mirror, field by field

| Layer        | `plane` today                                                                                                | What `worker` needs                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collection   | `kosztorys-stages.ts:35-44`, `type: 'select'`, `required: false`                                             | sibling `relationship` → `users`, `required: false`                                                                                                                               |
| Migration    | `20260724_2_add_plane_to_kosztorys_stages.ts` (enum type + nullable col)                                     | **not** the enum shape — copy `20260718_1_add_kosztorys_stage_to_transactions.ts`: `worker_id integer REFERENCES users(id) ON DELETE SET NULL` + `kosztorys_stages_worker_id_idx` |
| Type         | `KosztorysStageT` `types.ts:98-103`; `StagePatchT` `:108-111`                                                | add `workerId: number \| null`; patch field **nullable** (unlike `plane`, un-assignment is legal)                                                                                 |
| Tree SQL     | `kosztorys-tree.ts:82-83` `SELECT id, ordinal, label, plane`                                                 | add `worker_id`; mapper `mapStage` `:154-159`                                                                                                                                     |
| Action       | `updateStageAction` `kosztorys.ts:600-614`, `stagePatchSchema` `:590-595`, revalidates `['kosztorysStages']` | one more optional key on the same schema/action                                                                                                                                   |
| Client state | `handleSetStagePlane` `use-kosztorys-editor.ts:859-874`                                                      | copy verbatim: no-op guard off `stagesRef` → optimistic `setStages` → debounced save with a revert closure that re-checks nothing newer landed                                    |
| Column       | `kosztorys-v2-columns.tsx:368-385` passes `onSetPlane` into `<StageHeader>` as `title`                       | same slot; wire `onSetWorker: editorOnly(...)` at `use-kosztorys-editor.ts:314`                                                                                                   |
| Header UI    | `stage-header.tsx:84-100`, single-select skinned as `DropdownMenuCheckboxRow`                                | a „Pracownik" section above „Rozliczenie"; needs `WorkerRefT[]` passed down                                                                                                       |
| Snapshot     | rides `SnapshotPayloadT.stages` (`snapshot-format.ts:37-44`)                                                 | **additive ⇒ no `SNAPSHOT_SCHEMA_VERSION` bump** (`:8-10`); but `insert-kosztorys-tree.ts:40-52` must add the column to its INSERT with the tolerant `${s.workerId ?? null}`      |
| Preset       | `stages: []` by design (`serialize-preset.ts:22-24`)                                                         | nothing                                                                                                                                                                           |
| Sheets       | stages are **not** serialized to Sheets at all (`grep stage src/lib/google/` → 0 files)                      | nothing                                                                                                                                                                           |

**Migration naming**: `src/migrations/YYYYMMDD_<n>_<slug>.ts` → `20260727_0_add_worker_to_kosztorys_stages.ts`,
hand-written, plus **two** edits in `src/migrations/index.ts` (import + array entry). Lesson
`lessons.md:173-178`: filename lexical sort must match dependency order.

**Three traps in the mirror:**

- `stage-header.tsx:38-46` — the read-only branch predicate is `!onRename && !onRemove && !onSetPlane`.
  Adding a fourth handler without extending this condition means an `onSetWorker`-only mount falls
  through to the full menu.
- `kosztorys-v2-columns.tsx:380-382` — `disabled: st.plane == null` locks qty entry. **Do not widen
  it**, and do not add a `workerUnassigned(st)` twin of `PLANE_UNCONFIRMED_CELL` (`:101-108`). The
  plane lock exists because a plane-less etap's money vanishes from both crews' bills; a worker-less
  etap still has a value.
- `kosztorys-add-menu.tsx:53-58` forces a plane at creation ("no new stage is ever unconfirmed").
  The worker is optional at creation — a deliberate divergence from the sibling, and it should be
  commented as one.

**dsg column rule**: the module-scope-`component` rule (`lessons.md:137-143`) governs
`Column.component` (cells), **not** `Column.title`. `StageHeader` is a `title` ReactNode, so an
inline handler closure is safe — that is why `onSetPlane` works today. Only if worker info ever
renders _inside cells_ does it have to move to `columnData`.

### B. The math — where the grouping lands

`subcontractorDueByPlane` (`settlement.ts:146-172`) loops stages-outer / rows-inner and already
computes `planeTotal` **per etap**. A per-worker bucket is `map.set(st.workerId, prev + planeTotal)`
after the inner loop: **zero new row traversals, O(stages) extra work**, on a memo whose deps
(`[rows, stages]`) are already correct.

This matters — the editor already runs **~6 independent O(rows × stages) passes per render**
(`use-kosztorys-editor.ts:354, 396, 398, 402, 415, 441`) over a 1000+ row grid. A separate
`useMemo` doing its own sweep would be a seventh pass for a number already in hand.

The pre-rabat linearity argument in the docblock survives: grouping by worker is a _different
partition of the same etap set_, and value is linear in qty at a fixed per-etap price. Two
consequences the docblock does not cover:

- A worker spanning both planes sums two differently-priced sub-totals, so their `należne` is not
  derivable from `wTools`/`ownTools`.
- The `plane === null` skip happens **first**, so a plane-less etap contributes to no worker bucket
  even when a worker is assigned. Two orthogonal shortfalls, both needing their own signal.

`executedWorkNetPreRabat` has **no production caller** — it survives as the test-only parity oracle.
Pin any new invariant against `subcontractorDueByPlane(...).combined`.

### C. The hosts — and the divergence risk

- **Host A (editor)** — `kosztorys-editor-body.tsx:217-246` → `KosztorysTotalsPanel` →
  `summary-panel-content.tsx:253-266`. `subcontractorDue` comes from the **client** memo, so it
  reflects unsaved edits.
- **Host B (investment page)** — `investment-summary-panel.tsx:20` pins
  `INVESTMENT_PANEL_VIEWS = ['summary','wydatki','margin']`, deliberately excluding `podwykonawcy`
  (comment at `:15-19`: the transfers table below already lists every wypłata). **The block never
  renders here.**
- **Host C (client share)** — `summary-panel-content.tsx:176-177` filters `podwykonawcy` out under
  `clientView`.

So the roster for the wypłata dialog is a genuinely new server-side derivation. Either it reads
saved DB state (and can disagree with the editor's live figure) or the divergence is accepted and
stated. **This is the decision the plan must make explicitly**, per `lessons.md:19-24` (a figure
computed by two code paths needs the invariant asserted, not assumed).

### D. The payout half — already built

`sumPayoutsByWorkerForInvestment` (`sum-transfers.ts:339-361`):

```sql
SELECT worker_id, COALESCE(SUM(amount), 0) AS total
FROM transactions
WHERE type = 'PAYOUT' AND investment_id = $1 AND cancelled IS NOT TRUE
GROUP BY worker_id
```

Cached investment-scoped on `CACHE_TAGS.transfers` (`reference-data.ts:253-265`). The null-worker
bucket is deliberately kept (`:331-338`: excluding it would overstate the debt). Labelled via
`UNASSIGNED_WORKER_NAME = 'Bez przypisanego pracownika'` + `resolvePayoutWorkerNames`
(`subcontractor-summary.ts:5,10`). DB-backed spec at `src/__tests__/lib/db/sum-payouts-by-worker.test.ts`.

**The roster's source set changes.** Today it is _workers with payouts_ (`GROUP BY worker_id`). It
must become _workers with payouts ∪ workers with assigned etapy_ — a worker with etapy and no
payouts does not appear at all today.

### E. The wypłata form

Path: `top-nav.tsx:31` → `ExpenseDialog` → `ExpenseForm` → `createBulkTransferAction`
(`lib/actions/transfers.ts:64-131`) → `validateTransfer` hook.

- The worker field is `EntityComboboxField variant="worker"` over `referenceData.workers`
  (`expense-form.tsx:372-374`). `referenceData` is **global** — `fetchReferenceData` takes no
  arguments, cache key `['reference-data']` (`reference-data.ts:70-186`) — and the dialog is mounted
  in the top nav before any investment is known. **An investment-scoped roster cannot ride it.**
- The workers query has **no role filter and no `active` filter** (`reference-data.ts:95-99`);
  active-only is applied client-side in the combobox (`entity-combobox-field.tsx:60`).
- The precedent for selection-dependent data is **`use-saldo.ts`** — an on-demand server-action
  fetch keyed on the current selection with a monotonic `requestRef` to drop stale responses, reset
  on type switch (`expense-form.tsx:98, 307, 351-357`). Copy that shape for `useRoster(investmentId)`.
- Validation today: `worker` **required** for PAYOUT (both layers —
  `transfer-validation.ts:54-57`, `validate.ts:91-93`); `sourceRegister` required;
  `investment` **shown but optional** (PAYOUT is in `INVESTMENT_TYPES` but not
  `REQUIRES_INVESTMENT_TYPES`). Nothing new must be made required.

### F. Warnings — the gap

| Primitive                | File                                         | Fit                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WarningBanner`          | `ui/warning-banner.tsx:7-26`                 | investment-level banner in the dialog                                                                                                                                                                                |
| `SettlementPlaneWarning` | `summary/settlement-plane-warning.tsx:33-58` | the _design template_ — returns `null` when clean, names a count, links to the rows ("a warning that only states a sum leaves the reader with nothing to open, which is how red banners become furniture", `:30-32`) |
| `PlaneUnconfirmedBadge`  | `ui/plane-unconfirmed-badge.tsx:9-21`        | inline badge beside a figure that reads short; needs its own `aria-label` (the existing one names _rozliczenie etapu_, and `ReconMismatchBadge`'s is E2E-asserted)                                                   |

Two real gaps:

- **No advisory tier.** Every warning primitive in `components/ui/` is `text-destructive`. A
  non-blocking "this worker has no etapy here" should probably read softer than the settlement-plane
  scream — that is a new variant to design.
- **No pre-submit non-blocking warning exists in any form.** `transferFieldRules`
  (`lib/schemas/transfer-validation.ts:31-64`) is `{invalid, message, path}` with no severity;
  everything that fires becomes a blocking zod issue. `FieldDescription` (`ui/field.tsx:132`) is a
  static string, not a reactive slot. The one warning channel, `ActionResultT.warning` →
  `use-form-submit.ts:33`, is post-submit **and is dropped entirely on the optimistic branch**
  (`:42-54`) — a latent bug worth noting regardless of this change.

### G. Making a reassignment loud

The etap header already has the composition, in three existing pieces:

1. **A populated predicate** — `delete-policy.ts:37-50` / `isRowPopulated` (`:8-10`,
   `stages.some((st) => (row[stageKey(st.id)] ?? 0) !== 0)`). The etap analogue is
   `rows.some((row) => row[stageKey(st.id)])` — the same expression `settlement.ts:160` already uses
   to gate `hasUnconfirmedPlane`.
2. **A conditional `ConfirmDialog`** — the shape at `grid/menus/kosztorys-row-actions-menu.tsx:133-153`
   (conditional), **not** `stage-header.tsx:116-126` (unconditional).
3. **`captureAutoSnapshot`** before the write — `capture-auto-snapshot.ts:9-17`, the
   `removeStageAction` shape (`kosztorys.ts:632`).

Two facts constrain the choice: a plane change has **no undo-stack entry** today
(`handleSetStagePlane` calls no `push*`), and `captureAutoSnapshot` currently fires only on
destructive cascade paths. Adding either for a worker reassignment is new behaviour, not a
copy — which is fine, but it should be a deliberate line in the plan.

### H. Disclosure

`buildClientKosztorysEditorData` (`client-kosztorys.ts:19-22`) passes the tree through **unstripped**
— stated as an accepted leak. `client-kosztorys.ts:102` reads with `overrideAccess: true` for the
public token route. Gates 4–10 (`readOnly`, `clientVisible`, view pinning, panel-tab filtering) are
all _presentation_ gates. A worker name would therefore sit in the client's RSC payload unless the
strip happens in `buildClientKosztorysEditorData` or `mapStage` forks.

Separately, `roadmap.md` S-10 (`kosztorys-column-rbac`, Status `proposed`) and open owner question
P10 in the domain notes put subcontractor cost figures in the MANAGER-sensitive class. A per-worker
należne column is squarely in it.

## Code References

- `src/lib/kosztorys/subcontractor-summary.ts:35-39` — the gap, stated in a docblock
- `src/lib/kosztorys/settlement.ts:146-172` — `subcontractorDueByPlane`, where the grouping lands
- `src/lib/kosztorys/settlement.ts:156-161` — the plane-null skip, i.e. the second residual
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:441` — the only production caller (client-side)
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:859-874` — `handleSetStagePlane`, the write template
- `src/components/kosztorys/editor/grid/stage-header.tsx:38-46` — the read-only predicate to extend
- `src/components/kosztorys/editor/grid/stage-header.tsx:84-100` — the plane picker to mirror
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:380-382` — `disabled: st.plane == null`, do not widen
- `src/lib/db/kosztorys-tree.ts:82-83, 154-159` — stage SELECT + mapper
- `src/lib/kosztorys/insert-kosztorys-tree.ts:40-52` — the restore INSERT that must learn the column
- `src/lib/db/sum-transfers.ts:339-361` — the per-worker PAYOUT sum, ready to use
- `src/components/kosztorys/summary/blocks/subcontractor-summary.tsx:244-280` — `WorkerTotals`, the roster one column short
- `src/components/kosztorys/summary/blocks/subcontractor-summary.tsx:234-239` — the entire negative-signal surface
- `src/components/investments/investment-summary-panel.tsx:20` — why there is no server-side host
- `src/components/forms/hooks/use-saldo.ts` — the investment-scoped fetch precedent
- `src/lib/schemas/transfer-validation.ts:54-57`, `src/hooks/transfers/validate.ts:91-93` — worker already required
- `src/lib/queries/client-kosztorys.ts:19-22` — the accepted client leak
- `src/migrations/20260718_1_add_kosztorys_stage_to_transactions.ts` — the FK-column migration template
- `src/__tests__/lib/kosztorys/subcontractor-due-by-plane.test.ts:151-155` — the exact-shape assertion this change breaks

## Architecture Insights

- **The plane axis is a fully-worked precedent for "a nullable per-etap attribute that changes
  money".** Nine layers, one write path, one optimistic-patch shape, one badge. Deviating from it
  needs a reason; three deviations are justified here (nullable patch, optional at creation, no qty
  lock) and each should be commented at the point of divergence.
- **The settlement layer is deliberately stage-aware and the pricing layer deliberately is not**
  (EX-489 boundary, domain notes ~`:253`). A per-worker figure is a settlement concern; nothing goes
  into `calc.ts`.
- **Two nullable axes on one entity means two independent shortfalls.** The UI already has the
  vocabulary for one of them; it needs a second, distinguishable one, and the two can compound on a
  single etap.
- **The negative-`remaining` signal currently encodes one meaning and will have to encode three**
  (genuinely overpaid / paid against no assigned work / nothing paid yet). The current
  `remaining < 0 && 'text-destructive'` cannot express that.

## Historical Context (from prior changes)

- `context/archive/2026-07-23-etap-tool-plane/change.md` (EX-565) — the per-etap `plane` attribute
  and the move to **view-independent** subcontractor settlement. The direct architectural sibling.
- `context/archive/2026-07-25-subcontractor-view-settlement-only/change.md` — ruled that an
  unassigned etap **belongs to no plane and counts toward neither figure**: _"a missing amount with
  a warning beats an amount charged to a crew nobody picked."_ The precedent for the unassigned
  residual row.
- `context/archive/2026-07-21-podsumowanie-podwykonawcow/change.md` (EX-558) — built the block,
  and explicitly deferred this work: _"»Pozostało do wypłaty per ekipa« wymagałoby przypisania prac
  kosztorysu do ekip … osobny, większy slice na przyszłość."_ **EX-613 is that slice.** Also fixes
  the no-VAT rule (one „Kwota" column, no netto/brutto axis) that the roster must respect.
- `context/archive/2026-07-22-kosztorys-zaliczka-v2/change.md` (EX-536) — the deposit→etap bridge
  torn out; `transactions.kosztorys_stage_id` dropped by `20260721_0`. Two follow-up bugs
  (`f4c21124`, `273e2cf1`) were needed to keep the cross-aggregate tag coherent as the parent row
  moved. **Evidence for keeping the assignment on the etap and off the transaction.**
- `context/archive/2026-07-15-kosztorys-stages-source-of-truth/change.md` (EX-489/EX-494) — pomiar
  IS the stage sum. There is no independent measured quantity to attribute; per-worker należne is
  necessarily Σ over etapy.
- `context/reference/kosztorys-editor-domain-notes.md:449-451` — _"Rozliczenie per pracownik jest
  osobną warstwą … nie mieszać jej do tej zmiany"_ (written of EX-565). That layer is now this change.
- `context/reference/kosztorys-editor-domain-notes.md:541` — the money model: wypłaty należne = Σ
  subcontractor price from the kosztorys; kwota do zapłaty = należne − Σ realized `PAYOUT`.
- `context/foundation/lessons.md:187-193` (EX-547) — before hardening a write-side guard on the new
  FK, follow it to the read path; a scoped read can make the invalid state unreachable.

## Related Research

- `context/archive/2026-07-21-podsumowanie-podwykonawcow/plan.md:87` — the prior inventory that
  confirmed zero worker↔work attribution at every layer (item, section, stage, progress)

## Testing Landscape

- **Breaks mechanically**: `src/__tests__/lib/kosztorys/subcontractor-due-by-plane.test.ts:151-155`
  asserts the whole `SubcontractorDueByPlaneT` shape with `toEqual`. Adding a field fails it.
- **The invariant to add**, twin of `:181-191`:
  `Σ per-worker należne + unassigned residual == due.combined`. No existing test covers it.
- **Also to pin** (existing siblings say it must hold): per-worker należne is unmoved by per-item
  rabat (`:124-129`) and by an active global discount (`:131-139`).
- **Action-level precedent**: `src/__tests__/lib/actions/kosztorys-stages.test.ts` (DB-backed) is the
  model for a persisted-state test of the new patch — assert the row, not the action's return value.
- **E2E**: the whole „Podsumowanie podwykonawców" block is browser-untested (one comment hit across
  `e2e/`). `pickComboOption` (`e2e/helpers.ts:80`) is **module-private** and must be exported before
  any spec can drive the roster or a worker picker.
- **Test plan**: `context/foundation/test-plan.md` names no risk for etapy, workers, or payouts.
  Anchor on **Risk #1** (two surfaces disagree — directly the editor-vs-dialog divergence) and
  **Risk #2** (a form/mutation change breaks the real path silently). Phases 2–5 are `not started`.
- **Roadmap**: no slice covers this. It proceeds as a Linear-tracked follow-on, the way EX-565 did.

## Open Questions

1. **Live vs saved.** The editor's `należne` reflects unsaved grid edits; a dialog roster reads the
   DB. Do they have to agree, or is the divergence accepted and labelled? If they must agree, the
   derivation has to be a single shared pure function fed by both a client and a server assembly —
   and the parity has to be asserted, not assumed (`lessons.md:19-24`).
2. **The loud reassignment.** Confirm dialog gated on `rows.some(row[stageKey(st.id)])`, plus/minus
   an auto-snapshot, plus/minus a first-ever undo entry for a stage-metadata change. Owner: "it has
   to be loud as fuck."
3. **Client disclosure.** Strip `worker` from the share tree, or extend the accepted leak?
4. **The two residuals in one UI.** An etap can be simultaneously plane-unconfirmed and
   worker-unassigned. Does it get two badges, one combined signal, or is the plane one dominant?
5. **The three-state negative.** Which of the three meanings of a negative pozostało get their own
   visual treatment, and which share one?
6. **Roster ordering and inclusion.** Union of "has etapy" and "has payouts"; the existing sort
   (amount desc, null bucket pinned last, `subcontractor-summary.ts:45-50`) needs a rule for a
   worker with należne but no payouts.
7. **MANAGER visibility.** Per-worker należne is cost/margin-class data (S-10 `proposed`, domain
   notes P10). Is the roster OWNER-only?
