# Review-gate ledger — client-preview-settings · 2026-08-15

Base: `staging` · commits `1301267f`, `9b3a9af2`, `1ae01ffd`, `d50c164a`, `fef90b2b`, `0c3c11c8`

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only), then
`primitive-reuse-scan` + `/simplify` in the mutating pass. No `verify-manual-checks` skill in this
install → Step 0.5 skipped; the browser pass stays the human's, in `manual-checks.md`.

## Findings

- [x] 🟡 WARNING · fixed · `code-review` · `toolbar/menus/kosztorys-actions-menu.tsx:101` · `readSettings` had no latest-wins guard — a slow read from one dialog could land after a newer one and put a stale set back, which the next „Zapisz" would then write over the owner's save. Request-id counter added.
      test: test-driven-debugging · no automated test — the race needs two overlapping in-flight RPCs from one component; the guard is 3 lines and a spec for it would assert the counter, not the behaviour. Covered at the browser layer by EX-696.
- [x] 🟡 WARNING · fixed · `code-review` + `impl-review` (F2) · `dialogs/kosztorys-share-dialog.tsx:71` · „Dalej" wrote a per-investment row even when nothing was ticked, permanently detaching that investment from the firm-wide default. Now writes only when the draft differs (`sameClientViewSettings`, order-insensitive).
      test: TDD · unit — `__tests__/lib/kosztorys/client-view-settings.test.ts` (3 specs): set-not-list equality, changed-tick detection, sanitized-shape equality.
- [x] 🟡 WARNING · fixed · `code-review` · `kosztorys-editor-body.tsx:162,306` · `emptyByFilter` counted only `kind === 'filter'`, so a client whose every pozycja is empty got a blank grid with no explanation. The `client` kind now counts as a hider, with a client-worded title/description and no „Zresetuj filtry" button (nothing there is theirs to reset).
      test: test-driven-debugging · e2e — deferred into EX-696 with the rest of the browser surface; the unit layer cannot see an overlay's gating.
- [x] 🟡 WARNING · fixed · `code-review` · `dialogs/kosztorys-client-view-dialog.tsx:141` · „Zapisz jako domyślne" is two writes; a failed second one returned before `onSaved`, leaving the editor showing the old value for a row that WAS saved. `onSaved(draft)` now publishes after the first write, and the error names what did land.
      test: no automated test — a partial-failure path behind two server actions; asserting it would mean mocking both actions, which tests the mock. The user-visible half (the message) is copy.
- [x] 🟡 WARNING · skipped · `code-review` · `SummaryPanelContent`, `grid/cells/section-header-cell.tsx:103` · the setting reaches the grid's columns only — the podsumowanie and the section bands still print figures a hidden column reports. The panel was explicitly out of scope in the plan (owner's call), so the promise was narrowed instead: the dialog copy now says „które kolumny i pozycje klient widzi w rozpisce".
- [x] 🟡 WARNING · dismissed · `impl-review` (F1) · `lib/queries/preview-kosztorys.ts:110` · a failing settings read 500s `/k/<token>` instead of rendering. Kept deliberately: the only fallback available is the code default, i.e. *wider* disclosure than the owner configured — for a disclosure setting, failing closed beats serving a client columns that were hidden. The reachable cause (preview DB behind a migration) is a deploy gate, `pnpm db:migrate:preview`.
- [x] 🟡 WARNING · dismissed · `impl-review` (F4) · `grid/cells/section-header-cell.tsx:103` · `0c3c11c8` is unplanned relative to the plan — it was the user's explicit request this session („netto po kwocie"), not drift.
- [x] 🟡 WARNING · fixed · `impl-review` (F5) + `code-review` · `__tests__/lib/queries/kosztorys-client-view.test.ts:26` · the spec wrote the firm-wide global and never restored it, on a DB shared with every other integration spec; specs 1→2 were also order-coupled. Global restored in `afterAll`, the row moved to `beforeAll` as a fixture.
      test: TDD · integration — the spec IS the test; the fix is to its own hygiene.
- [x] 🔵 OBSERVATION · fixed · `code-review` + `impl-review` (F3) · `lib/kosztorys/row-conditions.ts:75` · `client-empty` carried a `sectionLabel` nothing reads (the „Filtry" menu lists `kind === 'filter'`), which bought a per-render `sectionIdsWhereAllMatch` pass over the whole dataset. Set to `null`; `foldableSectionIds` now filters on `kind === 'filter'`; the spec invariant relaxed to `sectionLabel === null ⟺ kind !== 'filter'`.
      test: TDD · unit — the existing invariant spec, tightened to the real rule.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `lib/actions/kosztorys-client-view.ts:37` · the race-recovery `catch {}` swallowed validation/FK failures indistinguishably. Now logs with the repo's `TODO(EX-449) SENTRY-REQUIRED:` marker; the dead-position comment after `return` moved above it.
      test: no automated test — a logging call on an error path that already returns the right result.
- [x] fixed · `feature-first-structure` + `module-cohesion` + `code-review` · `dialogs/kosztorys-client-view-dialog.tsx:56` · two exported components in one file, and „Udostępnij" imported the form from a module named for the *other* dialog. `ClientViewSettingsForm` + `CheckboxRow` extracted to `dialogs/client-view-settings-form.tsx`.
- [x] fixed · `structure-scatter` + `impl-review` (F6) · `lib/queries/kosztorys-client-view-read.ts` · two sibling reads whose names didn't say which is the auth-gated RPC and which the `overrideAccess` resolver. Renamed to `client-view-settings-endpoint.ts`, docblock now names the reason (every export of a `'use server'` file is public).
- [x] fixed · `module-cohesion` · `lib/queries/preview-kosztorys.ts:105` · the token docblock had been separated from its function by the `PreviewKosztorysDataT` export wedged between them. Type moved to the top, docblock back onto `getPreviewKosztorysByToken`.
- [x] fixed · `comment-noise` · `grid/kosztorys-v2-columns.tsx:646`, `__tests__/…/preview-columns.test.ts:108,128` · 2 deleted, 1 trimmed — each restated the line or the `it()` title under it. The „subtracts, never adds" invariant was stated six times across the slice; the enforcement site keeps it.
- [x] dismissed · `comment-noise` · 5 remaining flags · each states a *why the absence* at a site where someone would reach for the opposite (a revalidation hook in the collection, `updateTag` in the action, the cache placement at the call site). Duplication is the point there, not noise.
- [x] dismissed · `code-review` · `src/migrations/20260815_0_add_kosztorys_client_view.ts` · verified against `@payloadcms/drizzle@3.73.0`: `timestamps: false` for globals, snake-cased slugs, the `kosztorys_client_view_id` column on `payload_locked_documents_rels`, and the missing `*_updated_at_idx` matching `20260720_0_add_kosztorys_shares.ts`. Owes `pnpm db:migrate:prod` by a human before the code ships.
- [x] dismissed · `tailwind-v4-audit` · whole diff · 0 findings; the two scanner hits (`style={{ left: guideX }}`, `h-[calc(100dvh-7rem)]`) predate the branch and are legitimate exceptions.
- [x] dismissed · `impl-review` (F10) · `review-gate.md` · „marked implemented with an empty ledger" — this gate is the ledger; it is written now, before archive.
- [x] dropped · `code-review` · `dialogs/client-view-settings-form.tsx` · no floor on the picker: the owner can untick every column and reach a grid with only the gutter. Self-evident in the preview beside it and one tick to undo — a pinned-column rule would constrain the owner to prevent a state they can see.
- [x] dropped · `code-review` · `lib/kosztorys/client-view-settings.ts:14` · `hideEmptyRows` defaults to `true`, so already-issued links start hiding rows nobody opted out of. Deliberate, plan-locked, and such rows move no figure; kosztorys data is pre-dogfooding throwaway (AGENTS.md).
- [x] dropped · `structure-scatter` + `module-cohesion` · `editor/dialogs/` (23 files), `lib/kosztorys/` (60 files), `RowActionsCell` in the columns module, the dialog-state accretion in the actions menu · all pre-existing, none created by this slice.
- [x] skipped · `module-cohesion` · `editor/use-kosztorys-editor.ts` · 1505-LOC god module, +22 lines here. Already tracked and deliberately deferred under **EX-515** (cohesive stateful unit, needs a test harness first) — not re-filed.
- [x] dismissed · `impl-review` (F7) · `lib/queries/kosztorys-client-view.ts:14` · „one indexed read" undercounts the fallback path (row miss → global read). Accurate for the hot path, which is what the sentence is about.
- [x] fixed · `primitive-reuse-scan` · `lib/actions/kosztorys-client-view.ts:19,43` + `lib/queries/kosztorys-client-view.ts:22` · the same investment-scoped `payload.find` written three times, while the sibling module this slice refactored already had the extracted form (`findShare`). Extracted `findClientViewRow(payload, investmentId, overrideAccess)` beside the resolver; `overrideAccess` stays a parameter because the two callers are gated differently.
- [x] fixed · `primitive-reuse-scan` · `hooks/use-latest-request.ts` (new) · the latest-wins guard was the third hand-roll of one pattern (`use-register-balance.ts:8`, `use-snapshot-list.ts:23`) with no primitive to reach for. Extracted `useLatestRequest` (`start()` → the „still newest" check, `disown()` for a reset a late response must not repopulate); the actions menu and `use-register-balance` both moved onto it. `use-snapshot-list` left alone — its `let active` form is an effect-cleanup idiom, and merging it is a different change.
- [x] fixed · `primitive-reuse-scan` · `lib/kosztorys/column-config.ts:166` · the 22-key allowlist existed twice — once as `PREVIEW_VISIBLE_COLUMNS`, once regrouped in the dialog's `client-view-groups.ts` — with a spec asserting they agree. Groups moved into `column-config.ts` and `PREVIEW_VISIBLE_COLUMNS` derived from them, so a column can no longer be offerable-but-barred. The old module is deleted; its spec moved to the `lib/kosztorys` mirror and now guards the flattening (a key repeated across groups) instead of the agreement it can no longer break.
- [x] fixed · `primitive-reuse-scan` · `dialogs/kosztorys-share-dialog.tsx:153,168` · the identical 9-line „Wróć do ustawień" ghost Button in both adjacent branches — hoisted to one element.
- [x] fixed · `primitive-reuse-scan` · `lib/kosztorys/row-conditions.ts:140` vs `kosztorys-editor-body.tsx:165` · „which kinds hide rows" was answered twice in opposite formulations — open-ended (`!== 'diagnostic'`) in the filter, closed enumeration in the empty state. A fourth kind would have hidden rows the empty state then failed to explain, which the filter's own comment warns against. One `engagedHiders` export now answers both.
- [x] dropped · `primitive-reuse-scan` · `kosztorys-client-view-dialog.tsx:34` + `kosztorys-share-dialog.tsx:62` · the same 5-line derive-during-render draft reset in both dialogs. No primitive exists and a `useDraftFromProp` hook would be as long as what it replaces — two copies of the React-sanctioned pattern is cheaper than the indirection.
- [x] dismissed · `primitive-reuse-scan` · `client-view-settings-form.tsx:17` `CheckboxRow`, `client-view-settings.ts:36` `sameClientViewSettings`, the two-step dialog state, the hand-rolled dialog footers · each verified against the catalogue as a non-dupe: the two existing label+Checkbox components are bound to a filter flip and to TanStack field context, the one near-equality helper (`sameKeys`) is order-SENSITIVE by design, and `DialogActions` is an Anuluj+one-primary footer that neither of these two footers is.

- [x] fixed · `simplify` · `lib/kosztorys/client-view-settings.ts:12` · `CLIENT_VIEW_CODE_DEFAULT` was exported, had zero callers, and re-stated as prose what `sanitizeClientViewSettings({})` actually produces — a constant that only pretended to be the source of the code default. Deleted; the sanitizer's docblock now says it IS the default.
- [x] fixed · `simplify` · `lib/queries/kosztorys-client-view.ts:39` · the resolver awaited the row, then awaited the firm-wide global — two round-trip depths on the COMMON path, because until an investment saves its own row the fallback is the answer. Both reads now issue at once; the wasted global read when a row exists is one row of a single-row table.
- [x] fixed · `simplify` · `lib/queries/kosztorys-client-view.ts:19` · `payload.find` defaults to `pagination: true`, buying a COUNT query beside a unique-indexed `limit: 1` lookup — on the public share page's critical path and both branches of the save. Turned off.
- [x] fixed · `simplify` · `lib/queries/kosztorys-client-view.ts:48` · `getClientViewDefaults` was exported for one in-file caller and stood up a second Payload client while the caller already held one. Inlined.
- [x] filed EX-697 · `simplify` · 4 cheap cleanups (`foldableSectionIds` computed on the preview path for an owner-only menu; a `useMemo` React Compiler makes moot; the `sanitize` import alias; the doubled empty-state ternary) + 2 shape fixes (`useDraft`, a form that owns its own „Wczytywanie…") · all behaviour-preserving and all worth doing — held back only because the slice was being closed out, not because they're contentious.
- [x] filed EX-697 · `simplify` (altitude) · 5 review-worthy refactors: `useClientViewSettings` for the lifecycle smeared across three components; `previewVisible` + `previewHiddenColumns` collapsed into one object whose presence is the switch (the illegal pairing is currently representable); a discriminated union on `RowConditionT.kind` now that `sectionLabel` is a second encoding of `kind === 'filter'`; one action returning `{ token, settings }` instead of two Next serializes anyway; empty-state copy keyed on the condition that hid the rows rather than on `preview`.
- [x] dismissed · `simplify` · `hooks/use-latest-request.ts:15` · one agent wanted the returned object un-`useRef`'d, another called the stable identity the right shape. Kept: a stable object is what lets a caller hold it without a `useCallback`, and the cost is one discarded literal per render of a handful of hook instances.
- [x] dropped · `simplify` · `use-kosztorys-editor.ts:385` · registering `client-empty` adds a 7th full-dataset count to the owner's memo for a number only an open dialog reads. Moving it out means either recomputing on dialog open or threading a second count path — more machinery than the pass it saves.
- [x] dismissed · `simplify` · `client-view-settings-form.tsx:49` · the form takes `value`/`onChange` as props but pulls the empty-row count from the editor context, so it can only render inside the provider. True, and fine: both its call sites are editor dialogs, and making it a prop just threads the same value through two more components.

## Simplify pass

Ran `/simplify` (4 angles in parallel) after a dedicated `primitive-reuse-scan` — **4 applied, 11 filed
as EX-697, 2 dismissed, 1 dropped**; every finding folded into `## Findings` above, tagged `simplify`.
Reuse was the highest-yield angle and had already been harvested by the earlier scan (5 fixes: the
tripled `payload.find`, the third hand-rolled latest-wins guard, the doubled back-button, the two
formulations of „which kinds hide rows", the twice-written 22-key allowlist).

## Tests & suite

- `pnpm typecheck` — clean, run after each batch of fixes.
- `pnpm exec vitest run` on the 5 affected specs — **45 passed** (client-view-settings 3,
  client-view-groups 2, row-conditions 20, kosztorys-empty-sections 6, preview-columns 14).
- Full suite (`lint` / whole `test` / `build`) not run — the session was closed out before Step 3's
  ask. **Owed before the PR.**
- `pnpm test:e2e` deliberately not run. The browser obligation is discharged as **EX-696**
  (`e2e-backlog`, project Wykonczymy).
- `pnpm db:migrate:prod` for `20260815_0_add_kosztorys_client_view` is owed by a human when the code
  ships — deploy-time gate, not a slice blocker.

## Status

Slice stays **in review**, not archived: `context/foundation/manual-checks.md` carries 10 unticked
boxes for it, and the manual pass is the human's.
