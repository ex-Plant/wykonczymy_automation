# Review-gate ledger — sortowanie-kolumn-spojne · 2026-08-18

Scope: commits `aeaf755f`, `e5a12767`, `2b0d9aee`. Files:
`src/lib/kosztorys/sort-value.ts`, `src/lib/kosztorys/stage-keys.ts`,
`src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`,
`src/components/kosztorys/editor/grid/{sort-menu-items,sort-header,stage-header,kosztorys-v2-columns}.tsx`.

Step 0.5 (browser verification pass) not run — Playwright is never driven unprompted here; the
slice's manual checks are registered in `context/foundation/manual-checks.md`.
`tailwind-v4-audit` dropped — the diff adds no styling: every class in it is an existing utility
moved verbatim out of `sort-header.tsx`.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `stage-header.tsx:138` · an actively-sorting etap column gave
      no visual signal (`icon={null}`, no trigger colour, no weight) — EX-486 exists because a sort
      with no visible owner strands the user. Now the trigger swaps its ChevronDown for `SortIcon`,
      goes `text-primary`, and the label goes `font-semibold`, exactly like `SortHeader`.
      test: no automated test · — pure visual affordance; covered by the registered manual check
      „sortowanie po ilości etapu", no unit-level assertion worth the coupling
- [x] 🔵 OBSERVATION · fixed · code-review · `sort-value.ts:36` · the per-etap wartość key validated
      its stage id against the FULL stage list while the figure itself is view-scoped, so a foreign
      plane's etap would have returned a number instead of „—". Latent only (`reconcileSort` never
      offers such a key today), closed with `stagesForView(stages, view)`.
      test: TDD · unit — new spec „has no value for an etap the plane does not price"
- [x] 🔵 OBSERVATION · dismissed · code-review · `sort-value.ts:130` · `String(value)` on a row field
      typed outside `string | number` — no such field exists on `KosztorysV2RowT`, and the return
      type stays honest for every real column. Unreachable, no guard worth the noise.
- [x] 🔵 OBSERVATION · dismissed · impl-review/code-review · `sort-value.ts:122` · the `''`→`null`
      change reaches every text column, not only the five named groups. Intended and documented: the
      old coercion was also dropping a whole numeric column into `localeCompare` whenever one cell
      was cleared. Both effects are pinned by specs.
- [x] 🔵 OBSERVATION · fixed · impl-review · `sort-value.ts:121` · redundant `opts.onSetSort?.()`
      inside the `if (opts.onSetSort)` guard — gone with the `sortableHeader` extraction below.
- [x] 🔵 OBSERVATION · dismissed · impl-review · `stage-header.tsx:88` · the read-only gate doesn't
      list `onSort`. It cannot fire without the other handlers (`editorOnly` nulls them as one set),
      and the gate's meaning is „no editor callbacks at all" — adding a fourth term would suggest a
      combination that does not exist.
- [x] 🔵 OBSERVATION · dismissed · code-review · `kosztorys-sort-value.test.ts:192` · the etap-qty
      case is characterization, not regression (that axis already sorted). Kept deliberately: it is
      the axis the change made _offerable_, and it pins the qty/wartość namespace split.
- [x] fixed · structure-scatter · `stage-keys.ts` · the new reverse parser was the third stage-key
      decoder and absorbed neither `toggleKey` nor `diffRow` — the latter still doing the unguarded
      `slice` + `Number` the new helper was written to document. Added `stageIdFromQtyKey` and
      `stageGroupOfKey`; both call sites now route through them.
      test: TDD · unit — new spec: a `stage_`-prefixed key with a non-numeric tail is not progress
- [x] fixed · reuse · `sort-value.ts:49` · `overrideMode` + the raw `OVERRIDE_FIELDS` read duplicated
      `overrideSnapshot()` in `subcontractor-price-edit.ts` — now imported instead.
- [x] fixed · reuse · `kosztorys-v2-columns.tsx:139,428` · the `SortStateT → SortPickT|null`
      narrowing was written out three times; extracted as `activeSortPick()` in `row-view.ts`.
- [x] fixed · reuse · `kosztorys-v2-columns.tsx:128` · `stageValueHeader()` had become `title()` with
      the label supplied; both now compose one `sortableHeader(label, field, tip, opts)`.
- [x] fixed · reuse · `stage-label.ts` (new) · `stage.label ||` vs `stage.label ??` disagreed across
      the three surfaces that name an etap — an empty label rendered a blank column in one and „Etap
      N" in another. One `stageLabel()` helper, `||` semantics everywhere.
- [x] fixed · comment-noise · `sort-menu-items.tsx:56` · label comment restating `SortIcon` — deleted.
- [x] fixed · comment-noise · `sort-value.ts:124,135` · two vanished-state clauses („used to answer
      here", the removed `sortable: false`) recast in the present tense.
- [x] fixed · comment-noise · `stage-keys.ts:3`, `sort-menu-items.tsx:12`, `stage-header.tsx:37`,
      `stage-header.tsx:47` · four restating sentences trimmed.
- [x] dismissed · comment-noise · `sort-menu-items.tsx:17` · flagged-uncertain, kept whole — it
      explains why this is a set of items rather than a menu, which the code cannot say.
- [x] fixed · impl-review · `plan.md` · Progress rows were ticked without the ` — <sha>` the plan's
      own convention requires; the three commit shas are recorded.

## Simplify pass

Ran as the gate's mutating pass, folded into `## Findings` above (tagged `reuse` / `comment-noise` /
the reviewer that raised it): 11 applied, 0 proposed, 5 dismissed. No separate report file — this
ledger is the report.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm lint` — 3 errors, all pre-existing and outside this diff (`src/hooks/use-latest-request.ts`,
  root `test.js`).
- `pnpm test` — full unit suite green (see close-out).
- E2E: none owed. The change adds no new browser-level flow — it widens an existing header-menu
  gesture to more columns, and the sort engine it drives is covered at unit level.
- Manual: 11 checks registered in `context/foundation/manual-checks.md`, unticked. Non-blocking by
  standing owner decision — the slice is closed as done (EX-710) with the checks left as a registry.
