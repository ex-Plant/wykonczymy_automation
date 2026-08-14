---
date: 2026-08-13T11:28:54+0200
researcher: Claude (Opus 5)
git_commit: 811e444a1215197a27bd25709ab150a31e57d769
branch: staging
repository: wykonczymy
topic: 'Synthetic „Pomiar bez etapu" stage — where it is created, what it breaks, what already handles it'
tags: [research, codebase, kosztorys, sheet-import, stages, settlement, snapshots]
status: complete
last_updated: 2026-08-13
last_updated_by: Claude (Opus 5)
---

# Research: „Pomiar bez etapu" — a synthetic stage carrying the Pomiar-vs-Σetapów difference

**Date**: 2026-08-13T11:28:54+0200
**Researcher**: Claude (Opus 5)
**Git Commit**: 811e444a1215197a27bd25709ab150a31e57d769
**Branch**: staging
**Repository**: wykonczymy

## Research Question

> **Superseded framing (2026-08-13, after this doc was written).** The owner rejected the synthetic
> stage: "zmieniamy w chuj model danych po to, żeby obsłużyć import starych arkuszy". The settled
> design is a read-only reference figure per item plus a live-derived discrepancy — see `change.md`
> and `plan.md`. **The factual findings below (import pipeline, insert/restore paths, preview
> gating, test blast radius) remain valid and are what the plan is built on**; only the framing of
> the question is obsolete. Two findings that changed the plan's shape came after this doc:
> `readImportGrids` does *not* fetch the robocizna tab's formulas, and column O is never resolved.

The owner's live sheets hand-type „Pomiar z natury" instead of leaving it as `=SUM(D:M)`, so the
imported kosztorys understates executed work (investment 31: 41 377 zł across 32 items). The settled
shape is one synthetic stage per kosztorys absorbing the difference, in both directions, screaming
via name + red cell + an error on the column total. Research question: where exactly does that stage
get created, what downstream code breaks, and which of the required guards do not exist yet?

## Summary

**Four findings dominate. Two invalidate premises recorded in `change.md`.**

1. **The premise "the bucket empties itself when the owner splits the quantities" is false.**
   The difference would land as a *stored* `stage_progress.qty_done` row, not a derived figure. Moving
   the quantity into a real stage adds to Σ etapów without debiting the bucket, pushing the sum
   *above* the typed Pomiar. The bucket must be derived, or the transfer must debit it, or the owner
   must zero it by hand. This is the single largest open decision.
2. **`plane: null` is not a marker.** Every stage produced by every import is already
   `plane: null, workerId: null` (`parse-robocizna.ts:138-144`). The money layer already fails closed
   on it — the bucket is *not* a new state for settlement — but nothing can identify the bucket
   afterwards. It needs a durable identity.
3. **The bucket leaks to the client and cannot be drained.** `PREVIEW_VISIBLE_COLUMNS` allowlists the
   whole stage group, so a red column named „Pomiar bez etapu" would print on the offer; and
   `disabled: st.plane == null` locks its own cells. Both follow from `plane: null`, and both need
   explicit carve-outs.
4. **The import's own strongest diagnostic goes tautological.** `compareFooterTotals` is what proved
   this defect exists; once Σ etapów equals the typed Pomiar by construction, it agrees with both
   footer rows and stops detecting anything. Whether the bucket is applied before or after that
   comparison is a real ordering decision, not a detail.

Clear, with no work owed: **snapshots** (no `SNAPSHOT_SCHEMA_VERSION` bump, the restore INSERT already
carries every field) and **Google Sheets write-back** (kosztorys stages are never written to any
spreadsheet; the frozen-column contract is untouched).

## Detailed Findings

### 1. Import pipeline — where the stage would be created

Chain: `kosztorys-actions-menu.tsx` → `previewKosztorysImport` / `applyKosztorysImport`
(`src/lib/actions/kosztorys-import.ts:48,83`) → `derivePlan` (`:30`) → `readImportGrids`
(`src/lib/kosztorys/sheet-import/read-sheet.ts:40`) + `serializeKosztorys` → `buildImportPlan`
(`src/lib/kosztorys/sheet-import/build-import-plan.ts:86`) → `replaceTreeWithSnapshot`
(`src/lib/kosztorys/replace-tree-with-snapshot.ts:33`).

- **Column O is never read.** `ColumnFieldT` (`columns.ts:37-43`) has no member for it; there is no
  matcher and no throw-away parse. It was a stored field, dropped by
  `src/migrations/20260716_0_drop_kosztorys_measured_qty.ts` (EX-494/EX-489 rationale in its header).
- **Adding it is small and low-risk.** Add `'measuredQty'` to `ColumnFieldT`, `FIELD_LABELS`,
  `FIELD_MATCHERS` (`exactly('pomiar z natury')` works — `fold()` trims the trailing space) and
  `ROBOCIZNA_FIELDS` (`resolve-columns.ts:106`). **Make it optional** (`OPTIONAL_FIELDS`,
  `columns.ts:59`) or every sheet lacking the column becomes a hard refusal. The parser then branches
  like it already does for `discount` (`parse-robocizna.ts:107`). Fixtures already carry O values and
  the header on every data row.
- **Stage creation point:** `parse-robocizna.ts:138-144` materialises one stage per `wykonano` column,
  all `label/plane/workerId = null`; `build-import-plan.ts:232` passes them through unchanged
  (`const stages = parsed.stages`). **Append the bucket at `:232`**, after the per-item loop and
  before the retained-items loop, which reads `survivingOrdinals` (`:233`) and remaps retained
  progress by ordinal (`:260-264`). Ordinal `count + 1` sorts last (`kosztorys-tree.ts:80`) and cannot
  collide with `kosztorys_stages_investment_ordinal_unique`.
- **Per-item difference:** emit inside the per-item loop at `build-import-plan.ts:224-226`, where
  `itemId` and the parsed progress are both in hand. Round through the existing `round6`
  (`derive-override.ts:5`) — raw float subtraction persists `54.99999999999999` into `numeric`.
- **Nothing rejects a negative.** `stage_progress.qty_done` is `numeric NOT NULL DEFAULT 0` with no
  CHECK (`src/migrations/20260709_0_add_kosztorys_stages.ts:27`) and `setStageProgressAction`'s schema
  is a bare `z.coerce.number()` (`src/lib/actions/kosztorys.ts:544`).
- **Import is wipe-and-reinsert, not merge** (`restore-kosztorys.ts:24-25`). Every stage label, plane
  and worker assignment is destroyed on each import, along with app-side stage quantities on
  sheet-matched items. Retained (non-sheet) items, a matched item's `note` and `hiddenInExport`, and
  the investment settings survive. Undo stays one click — a `manual` snapshot labelled
  „Przed importem z arkusza Google" is taken first (`kosztorys-import.ts:17`).

### 2. The stage model — `plane: null` is already routine

`KosztorysStageT` (`src/lib/kosztorys/types.ts:95-101`) types `plane` and `workerId` as nullable, and
`:88-93` documents `null` explicitly: *"null = undecided, which is NOT a plane: such an etap belongs
to no subcontractor bill and counts toward neither settlement figure."* The Payload collection agrees
(`src/collections/kosztorys-stages.ts`, both `required: false`).

Every branch on `plane`:

| Site | Behaviour on `null` |
|---|---|
| `settlement-view.ts:15-18` `stageAppliesToView` | client → `true` unconditionally; subcontractor → `false` |
| `subcontractor-due.ts:51-56` | `continue` — skipped, but raises `hasUnconfirmedPlane` |
| `kosztorys-v2-columns.tsx:102-109` `planeUnconfirmed` | red header + red cells on **every** row |
| `kosztorys-v2-columns.tsx:390` | **`disabled: st.plane == null`** — qty cells locked |
| `stage-header.tsx:105-123` | destructive-red label + `LabelHintIcon variant="planeUnconfirmed"` |
| `stage-header.tsx:166-175` | worker picker replaced by „najpierw wybierz rozliczenie" |
| `subcontractor-headline-summary.tsx:52-53` | warning badge beside the two crew amounts |

So the money layer needs **no new guard** for a plane-less bucket — it is skipped by
`subcontractorDueByPlane`, absent from `byStage` / `byWorker`, and reports 0 in both subcontractor
views. But four consequences need decisions:

- **No system-owned-stage concept exists.** Rename (`use-kosztorys-editor.ts:875`), delete behind one
  confirm (`kosztorys.ts:517`, populated stages explicitly deletable per EX-477) and plane assignment
  are all available on any stage. `StagePatchT` (`types.ts:106-111`) cannot patch `plane` back to
  `null`, so a plane pick is **irreversible in-app**.
- **Assigning the bucket a plane is a real money bug**, not a fix: `subcontractor-due.ts:58-66` yields
  a negative `byWorker`, which `subcontractor-summary.ts:63-69` mislabels `no_executed_work` and
  `:135` sorts to the bottom of the table — the anomaly becomes the least visible row.
- **`hasUnconfirmedPlane` would fire permanently** on every imported kosztorys
  (`subcontractor-due.ts:51-56`, truthy for a negative too), with copy („suma jest niższa niż
  faktycznie wykonana praca") that is wrong in the negative direction. Red banner becomes furniture.
- **The bucket gets its own row in the „Robocizna" tab** (`summary-stages-tab.tsx:54-61`) with no
  filter of any kind, possibly negative netto *and* negative brutto (`moneyPair` VATs it), rendered as
  plain text with no `danger` tone — unlike every other deliberately-negative row
  (`settlement-groups.ts:46,103`).

### 3. Warning affordances and the audience gate

- **The audience flag is `preview`, and only `preview`.** Set by two routes
  (`(share)/k/[token]/page.tsx:16`, `(share)/podglad-klienta/[id]/page.tsx:14`), threaded through
  `KosztorysEditorBody` → `useKosztorysEditor` → `readOnly` / `previewVisible`. Do **not** conjoin
  `view === 'client'`: `use-kosztorys-editor.ts:171` pins `view` to `'client'` in preview, so
  `priceView === 'client'` is true for exactly the reader who must not see the warning
  (`lessons.md:467`, EX-535/EX-541). `settlement-summary.tsx:77` conjoins it only because that scream
  sits beside client-priced money; a quantity fact needs no such conjunct.
- **A total has no error state today.** `columnTotalsForRows` (`column-totals.ts:29`) returns
  `Map<string, number>`, and `withSyntheticRows` (`kosztorys-synthetic-rows.tsx:94-95`) turns it into
  a plain `content: string` rendered by `TotalsRowCell` (`:31-37`) with one fixed class string. Adding
  a tone means widening `SyntheticColumnDataT` (`:42-49`), deciding it at the single call site
  (`kosztorys-editor-body.tsx:116-126`, where `preview` is already in scope) and branching the classes
  in `TotalsRowCell` — mirroring `ReadOnlyCellText`'s `danger`.
- **Conditional cell styling is `cellClassName`'s function form**
  (`node_modules/react-datasheet-grid/dist/types.d.ts:46-50`), unused in this codebase so far but
  available. **Never a new conditional cell `component`** — that is exactly the remount trap at
  `lessons.md:145-156`. Caveat: `withSyntheticRows` spreads `...column` without touching
  `cellClassName`, so the function also runs for spacer / „Razem" / section band rows — guard with
  `isSyntheticRow(rowData.id)` or the red bleeds onto them.
- **A new `LabelHintIcon` variant is required.** The file's own contract (`label-hint-icon.tsx:9-30`)
  names variants by meaning and forbids borrowing a neighbour's alarm; `planeUnconfirmed` says
  „Rozliczenie etapu niepotwierdzone", which is a different and wrong claim here.
- **The bucket cannot be hidden independently.** `toggleKey` (`kosztorys-v2-columns.tsx:531-543`)
  collapses every `stage_*` id into `STAGES_COLUMN_GROUP`, so the picker shows one entry for all
  stage-quantity columns.
- **Preview exclusion needs a structural edit.** `STAGES_COLUMN_GROUP` is in
  `PREVIEW_VISIBLE_COLUMNS` (`column-config.ts:176-179`) and in preview the allowlist is the whole
  answer (`kosztorys-v2-columns.tsx:580`). The exclusion must test the **raw column id** inside
  `selectV2Columns`' `keep`, which currently receives only `toggleKey(c.id)` (`:589`) — the raw id has
  to be threaded through.
- The `stage-header.tsx:78-84` read-only branch (gated on handler absence, i.e. `preview`) already
  renders a bare label with no plane glyph and no warning icon — a new header icon is suppressed there
  for free.

### 4. Downstream consumers and negative quantities

`calc.ts` reads no stage quantity itself (`rowTotalQtyDone` lives in `settlement-rows.ts:14`), but
three of its guards decide the negative-direction behaviour:

- **`netForQtyForView` (`calc.ts:96`) returns 0 for a non-positive total qty.** An item whose typed
  Pomiar is 0 while its stages sum positive prices at **0 zł** despite carrying real work. The SQL twin
  does the same (`kosztorys-client-totals.ts:63`), so `test:parity` stays green with both planes wrong
  identically. Needs an explicit decision.
- **`stageValueForView` (`calc.ts:140`) is a qty *share* of the row net, not `qty × price`.** A
  negative bucket therefore inflates the real stages' per-etap values above what they delivered, and
  `stageAxisForView` (`settlement-aggregates.ts:50-61`) zeroes every stage's net contribution when the
  row total hits 0 while still accumulating qty — breaking the Σ-per-stage == row-net invariant its
  own comment declares (`:30-33`).
- **Negative and >100% are already normal rendered states**, deliberately unclamped
  (`calc.ts:165-166`, `settlement-rows.ts:48-53`) and explained to the owner in Polish
  (`header-tips.ts:31,35`). „Pozostało" returns `null` → „—" when `plannedQty <= 0`.

Reconciliation and the investments listing both move, as intended:
`sectionSubtotalsForView(rows, stages, 'client')` never filters stages
(`settlement-client-totals.ts:44`), and the SQL twin joins `stage_progress → kosztorys_stages` with no
plane predicate (`db/kosztorys-client-totals.ts:45-56`). `buildKosztorysReconciliation` compares
grosz-exact with no epsilon (`reconciliation.ts:41`), so every previously-green investment can flip at
once. The comment at `db/kosztorys-client-totals.ts:45` citing EX-494 goes stale.

Lower-severity collateral: `emptySectionIds` (`settlement-aggregates.ts:150`) folds a section
cancelled to zero; `delete-policy.ts:9` counts a negative as "row has progress"; `sort-value.ts:47-53`
orders on residual-adjusted values; `kosztorys-progress-counter.tsx:19` clamps above only, emitting
`width: '-12%'` and an `aria-valuenow` below `aria-valuemin`; the section pie is **not** hardened
against a negative slice the way „Struktura kosztów" was (`summary-overview-tab.tsx:109-111` vs
`slice-pie.tsx:28-29`, `pie-legend.tsx:25`).

### 5. Snapshots — clear

`SnapshotPayloadT` (`snapshot-format.ts:44-51`) carries stages and progress; `serialize-kosztorys.ts:18-19`
copies them verbatim; the restore INSERT already enumerates
`investment_id, ordinal, label, plane, worker_id` (`insert-kosztorys-tree.ts:7-13`). **Do not bump
`SNAPSHOT_SCHEMA_VERSION`** (`lessons.md:742`) — a bump makes `assertReadableSchemaVersion` throw on
every stored snapshot and on the hand-curated global preset library. `lessons.md:528` does bite the
moment the bucket's marker becomes a new column: `STAGE_INSERT_COLUMNS` must move in the same commit,
and the marker must live inside the snapshot payload or the round-trip silently loses it. The id remap
joins on ordinal (`insert-kosztorys-tree.ts:100-107`), so the bucket needs a distinct ordinal or the
INSERT dies 23505. Presets strip stages entirely (`serialize-preset.ts:22-25`) — no leakage.

### 6. Google Sheets write-back — not reachable

Write-back is exclusively the three mirror tabs (`google/app-managed-tabs.ts:23-27`), every row builder
takes a transfer doc (`google/tab-rows.ts:78,87,94`) and every trigger is a transfer hook
(`hooks/transfers/sync-sheet.ts:22,48`). The kosztorys direction requests `spreadsheets.readonly`
(`google/readonly-sheets-client.ts:6-8`) and only calls `values.batchGet` — a bug on this path
physically cannot write a cell. The frozen-column lesson (`lessons.md:12`) is scoped to written tabs
and is untouched.

### 7. Tests

**Tautology risk, ranked** — `lessons.md:349` applies directly (a definition change *silences* the
specs encoding the old definition; rewrite red-first, do not supplement):

1. `sheet-import/footer-totals.test.ts:34,39,48` — the app-vs-sheet executed total agrees by
   construction; `:39` ("flags a mismatch") becomes unreachable on real sheets. Also
   `compareFooterTotals`' `matchedAgainst` heuristic picks the first candidate within tolerance
   (`footer-totals.ts:83-88`), so converging app figures start mislabelling footer rows.
2. `kosztorys-v2-rows.test.ts:282-312` — the literal EX-489 licznik block the lesson was written about.
3. `financial-golden-master-db.test.ts:139-158` — the per-investment hash includes `sum(sp.qty)`, so
   synthetic rows move every affected investment's **input** fingerprint and the spec **skips silently**
   (`:314-370`). No signal at all, which is worse than green-but-blind; the `comparable/total` floor
   (`:376-386`) is the only backstop. **Capture a copy of
   `src/__tests__/fixtures/financial-golden-master.json` before any `test:golden:update`.**
   `investment-render-parity-db.test.ts` compares two renders of the same figure and structurally
   cannot catch this — do not read its green as coverage.
4. `e2e/investments-listing-kosztorys.spec.ts:74,96,107` — locates „Etap 1" by header index then
   indexes `.dsg-cell`; an extra column shifts indices, and the qty-edit→marża causal chain may be
   absorbed by the bucket.
5. `subcontractor-due-by-plane.test.ts:230` — `Razem(z) + Razem(bez) == wykonana praca` becomes false
   by construction with a plane-less bucket.

**Hard breaks (numbers):** `build-import-plan.test.ts:64-70` (`toHaveLength(10)` + `{ stages: 10 }` —
the only literal stage count), `kosztorys-import.test.ts:90,170`.

**Direct contradiction:** `parse-robocizna.test.ts:81` asserts *"imports no stage labels, planes or
workers — the sheet is not their source"*. Creating a **labelled** bucket in the parser breaks that
stated rule — another argument for creating it in `buildImportPlan`, not the parser.

**Two hand-written `ImportReportT` literals** must be updated with any new report field:
`kosztorys-import.ts:70` (`emptyReport()`) and `sheet-import-gate.test.ts:20`.

**Uncovered ground (no spec today):** negative stage quantity anywhere; the bucket's ordinal placement;
re-import idempotence (second bucket or update the first?); whether the owner may delete/rename it
(`kosztorys-stages.test.ts:148-192` currently permits deleting any stage);
`serialize-restore-roundtrip.test.ts:235` (pre-EX-613 back-compat) is the precedent to copy for a
pre-change-snapshot case.

**Every fixture row is already internally consistent** — `O == Σ(D:M)` throughout
`fixtures/kosztorys-sheet/rows.ts:26-49`. The defect is invisible to the current corpus; a diverging
fixture (positive *and* negative) is a prerequisite, and `no-pii.test.ts` governs anything added there.

## Code References

- `src/lib/kosztorys/sheet-import/build-import-plan.ts:232` — the single append point for the bucket stage
- `src/lib/kosztorys/sheet-import/build-import-plan.ts:224-226` — per-item difference emission point
- `src/lib/kosztorys/sheet-import/parse-robocizna.ts:138-144` — every stage born `plane: null, workerId: null`
- `src/lib/kosztorys/sheet-import/columns.ts:37-43` — `ColumnFieldT`, where `measuredQty` would be added
- `src/lib/kosztorys/sheet-import/footer-totals.ts:51,83-88` — the diagnostic that would go tautological
- `src/lib/kosztorys/settlement-view.ts:15-18` — client view returns every stage unconditionally
- `src/lib/kosztorys/subcontractor-due.ts:51-56` — the `plane === null` skip + `hasUnconfirmedPlane`
- `src/lib/kosztorys/calc.ts:96,140-151` — the two `> 0` guards that decide negative-direction behaviour
- `src/lib/kosztorys/column-totals.ts:29,76-88` — totals keyed by `stageKey(stage.id)`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:102-109,390,578-589` — `planeUnconfirmed`, the qty lock, the preview allowlist filter
- `src/components/kosztorys/editor/grid/kosztorys-synthetic-rows.tsx:42-49,94-95` — where a total tone would live
- `src/lib/kosztorys/column-config.ts:176-179` — stage groups allowlisted into the client preview
- `src/lib/kosztorys/insert-kosztorys-tree.ts:100-107` — ordinal-keyed id remap + the unique constraint
- `src/migrations/20260709_0_add_kosztorys_stages.ts:27` — `qty_done numeric NOT NULL DEFAULT 0`, no CHECK

## Architecture Insights

- **The codebase is written as "signed money is fine, quantities are positive."** Every clamp found is
  an input clamp or a float tolerance; the real guards are truthiness and `> 0` tests. This change is
  the first to make a quantity signed, and those tests fail *to zero* rather than propagate.
- **`plane: null` carries two meanings after this change** — „nikt jeszcze nie wybrał rozliczenia,
  kliknij i wybierz" (fixable by the owner, and the UI offers the fix) and „this bucket belongs to no
  crew by design" (where the offered fix is a money bug). One flag cannot say both.
- **Client-view computations never filter stages**, by design and by comment. That is what makes the
  bucket flow correctly into robocizna on the listing and the investment page — and simultaneously
  what makes it leak into the client-facing offer. Same property, two consequences.
- **A derived bucket would sidestep most of this**: no stored negative, no drain problem, no ordinal,
  no snapshot marker, nothing to delete or rename. The cost is that it re-introduces a stored Pomiar —
  the second source of truth EX-494 removed — which `change.md` already rejected once.

## Historical Context (from prior changes)

- `context/foundation/lessons.md:349` (EX-489) — a definition change silences the specs encoding the
  old definition. This change is the exact inverse of EX-494 and hits the same specs.
- `context/foundation/lessons.md:467` (EX-535/EX-541) — an owner-internal scream needs its own audience
  flag (`!preview`), never a price-view flag. The bucket reproduces that failure shape by a new door.
- `context/foundation/lessons.md:145-156` — dsg remounts on a fresh `component` reference; per-column
  variation goes through `columnData`, and per-row styling through `cellClassName`.
- `context/foundation/lessons.md:742` — never bump `SNAPSHOT_SCHEMA_VERSION`; `:528` — the restore
  INSERT must learn about any new column in the same commit.
- `context/foundation/lessons.md:12` — frozen sheet column positions; scoped to written tabs, so this
  change does not touch it.
- `src/migrations/20260716_0_drop_kosztorys_measured_qty.ts` — the EX-494 removal this change partially
  revisits.

## Open Questions

1. **Derived, auto-debited, or manual?** The bucket cannot be a plain stored quantity and still keep
   the „empties itself" promise. This gates almost everything else.
2. **Before or after `compareFooterTotals`?** Before → both footer figures agree (the stated goal) but
   the diagnostic dies. After → the preview keeps flagging a mismatch the import now handles.
3. **Durable identity** — a new column (`is_synthetic`) with the migration + `STAGE_INSERT_COLUMNS` +
   snapshot-payload consequences, or a reserved ordinal, or a sentinel label the rename action refuses
   to overwrite (fragile: nothing stops the owner renaming it today).
4. **Item priced at 0 zł when typed Pomiar is 0 but stages carry work** (`calc.ts:96`,
   `kosztorys-client-totals.ts:63`) — accept, or change both planes together?
5. **Re-import idempotence** — second bucket, or update the first? The current import wipes and
   rebuilds, so the bucket is recomputed every run and any app-side split is lost unless it happens in
   the sheet. The dialog copy must not promise otherwise.
6. **Does the import preview currently surface the footer mismatch on investment 31?** Raised during
   evidence gathering, still unverified. If it did not, that is a separate defect.
