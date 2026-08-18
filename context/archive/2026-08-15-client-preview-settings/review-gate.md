# Review-gate ledger — client-preview-settings · 2026-08-15

Base: `staging` · commits `1301267f`, `9b3a9af2`, `1ae01ffd`, `d50c164a`, `fef90b2b`, `0c3c11c8`

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only), then
`primitive-reuse-scan` + `/simplify` in the mutating pass. No `verify-manual-checks` skill in this
install → Step 0.5 skipped; the browser pass stays the human's, in `manual-checks.md`.

## Findings

_Trimmed at archive (2026-08-17): every `fixed` finding was dropped from this ledger. A fix's durable
record is its commit — the code either reads that way now or it doesn't. What survives is the negative
space git cannot hold: what was deliberately NOT done, and why._

_Pre-trim tally: **21 fixed, 10 dismissed, 5 dropped, 2 skipped, 2 filed (EX-697) · 0 open**._

- [x] 🟡 WARNING · skipped · `code-review` · `SummaryPanelContent`, `grid/cells/section-header-cell.tsx:103` · the setting reaches the grid's columns only — the podsumowanie and the section bands still print figures a hidden column reports. The panel was explicitly out of scope in the plan (owner's call), so the promise was narrowed instead: the dialog copy now says „które kolumny i pozycje klient widzi w rozpisce".
- [x] 🟡 WARNING · dismissed · `impl-review` (F1) · `lib/queries/preview-kosztorys.ts:110` · a failing settings read 500s `/k/<token>` instead of rendering. Kept deliberately: the only fallback available is the code default, i.e. _wider_ disclosure than the owner configured — for a disclosure setting, failing closed beats serving a client columns that were hidden. The reachable cause (preview DB behind a migration) is a deploy gate, `pnpm db:migrate:preview`.
- [x] 🟡 WARNING · dismissed · `impl-review` (F4) · `grid/cells/section-header-cell.tsx:103` · `0c3c11c8` is unplanned relative to the plan — it was the user's explicit request this session („netto po kwocie"), not drift.
- [x] dismissed · `comment-noise` · 5 remaining flags · each states a _why the absence_ at a site where someone would reach for the opposite (a revalidation hook in the collection, `updateTag` in the action, the cache placement at the call site). Duplication is the point there, not noise.
- [x] dismissed · `code-review` · `src/migrations/20260815_0_add_kosztorys_client_view.ts` · verified against `@payloadcms/drizzle@3.73.0`: `timestamps: false` for globals, snake-cased slugs, the `kosztorys_client_view_id` column on `payload_locked_documents_rels`, and the missing `*_updated_at_idx` matching `20260720_0_add_kosztorys_shares.ts`. Owes `pnpm db:migrate:prod` by a human before the code ships.
- [x] dismissed · `tailwind-v4-audit` · whole diff · 0 findings; the two scanner hits (`style={{ left: guideX }}`, `h-[calc(100dvh-7rem)]`) predate the branch and are legitimate exceptions.
- [x] dismissed · `impl-review` (F10) · `review-gate.md` · „marked implemented with an empty ledger" — this gate is the ledger; it is written now, before archive.
- [x] dropped · `code-review` · `dialogs/client-view-settings-form.tsx` · no floor on the picker: the owner can untick every column and reach a grid with only the gutter. Self-evident in the preview beside it and one tick to undo — a pinned-column rule would constrain the owner to prevent a state they can see.
- [x] dropped · `code-review` · `lib/kosztorys/client-view-settings.ts:14` · `hideEmptyRows` defaults to `true`, so already-issued links start hiding rows nobody opted out of. Deliberate, plan-locked, and such rows move no figure; kosztorys data is pre-dogfooding throwaway (AGENTS.md).
- [x] dropped · `structure-scatter` + `module-cohesion` · `editor/dialogs/` (23 files), `lib/kosztorys/` (60 files), `RowActionsCell` in the columns module, the dialog-state accretion in the actions menu · all pre-existing, none created by this slice.
- [x] skipped · `module-cohesion` · `editor/use-kosztorys-editor.ts` · 1505-LOC god module, +22 lines here. Already tracked and deliberately deferred under **EX-515** (cohesive stateful unit, needs a test harness first) — not re-filed.
- [x] dismissed · `impl-review` (F7) · `lib/queries/kosztorys-client-view.ts:14` · „one indexed read" undercounts the fallback path (row miss → global read). Accurate for the hot path, which is what the sentence is about.
- [x] dropped · `primitive-reuse-scan` · `kosztorys-client-view-dialog.tsx:34` + `kosztorys-share-dialog.tsx:62` · the same 5-line derive-during-render draft reset in both dialogs. No primitive exists and a `useDraftFromProp` hook would be as long as what it replaces — two copies of the React-sanctioned pattern is cheaper than the indirection.
- [x] dismissed · `primitive-reuse-scan` · `client-view-settings-form.tsx:17` `CheckboxRow`, `client-view-settings.ts:36` `sameClientViewSettings`, the two-step dialog state, the hand-rolled dialog footers · each verified against the catalogue as a non-dupe: the two existing label+Checkbox components are bound to a filter flip and to TanStack field context, the one near-equality helper (`sameKeys`) is order-SENSITIVE by design, and `DialogActions` is an Anuluj+one-primary footer that neither of these two footers is.

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

Archived 2026-08-17 (EX-695 Done, owner's call). The 10 manual-check boxes in
`context/foundation/manual-checks.md` are still unticked — manual verification is non-blocking for
archive here, and the boxes stay in the registry until someone walks them.
