# Review-gate ledger — staging toolbar + section ops + section colour · 2026-07-26

Scope: everything on `staging` not covered by the previous gate. The batch
`d5b80d37`..`8ef4a3e5` already has its own ledger
(`.review-gate/staging-post-merge-kosztorys-refactors.md`, all boxes closed), so this
gate covers:

- `1bd8bd2e` dedupe toolbar panel-toggle buttons (`panel-toggle-button.tsx`)
- `d81fef76` reposition toolbar toggles
- `49ec90ad` move „Widok sekcji" into the right-aligned toolbar cluster
- `44296504` section insert + reorder in the row-actions menu (`swapSectionOrderAction`,
  `insertSectionAction`, `swapSectionBlock`, `applyInsertSectionRow`)
- `961e1f7c` remove the redundant Sekcje side drawer
- `7765ef49` per-section colour end-to-end (migration + `section-colors.ts` palette +
  `SectionColorPicker` + pinned pie fills + grid row tint)

**Explicitly out of scope:** the EX-573 transfer-type spec table and the netto-expense
batch, which arrived on this branch via the `ba1084bf` merge of `origin/staging`. Both
carry their own closed ledgers (`context/changes/2026-07-25-transfer-type-spec-table/review-gate.md`,
`context/changes/netto-expense-type/review-gate.md`).

No `plan.md` covers this batch (worked directly on `staging`) → `/10x-impl-review`
dropped from the fan-out. No manual-verification skill in this project → Step 0.5
skipped. Ran: `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.

## Findings

<!-- ONE checkbox per finding — every source folds in here. Most-severe first.
     Format: [box] [severity tag, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

- [x] 🔴 CRITICAL · fixed · `code-review` · `src/lib/kosztorys/insert-rows.ts:38` · `insertSections`
      never wrote the new `color` column, so restoring a snapshot or appending a preset silently
      dropped every section's pinned colour — added `color` to the column list and
      `${s.color ?? null}` to the VALUES tuple.
      test: test-driven-debugging · unit — owed; see the Tests section (round-trip through
      `appendPresetSections` asserting `color` survives).
- [x] 🔴 CRITICAL · fixed · `code-review` · `src/lib/kosztorys/row-ops.ts:152` ·
      `applyInsertSectionRow` spliced by ARRAY index, but `applyAddItem` appends new items at the end
      of `rows`, so a section's rows are not guaranteed contiguous — inserting a section next to a
      section with a stray tail row landed the new block in the wrong place. Rewritten to splice into
      the block _sequence_ and regroup, matching `swapSectionBlock`.
      test: test-driven-debugging · unit — owed; non-contiguous-block case.
- [x] 🔴 CRITICAL · fixed · `code-review` · `src/lib/actions/kosztorys.ts` (`swapSectionOrderAction`) ·
      two sequential `payload.update` calls with no transaction: a failure between them leaves both
      sections on the SAME `display_order` (no unique constraint), making the reloaded section order
      non-deterministic. Wrapped in `withPayloadTransaction(..., { skipRevalidation: true })`.
      test: no automated test — the failure window needs a mid-transaction fault injection the
      harness has no seam for; the transaction wrapper is the guard.
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      the section ▲/▼ handler read `rows` from the closure and called `setRows(swapSectionBlock(rows, …))`,
      so two fast moves raced on a stale array — switched to the functional
      `setRows((rs) => swapSectionBlock(rs, sectionId, dir))`.
      test: no automated test — React state-batching race, not reachable from a unit spec.
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      the undo command's `touchedIds` were computed AFTER the swap, pruning the wrong ids from the
      command stack — captured before the swap and passed to `pushCommand`.
      test: no automated test — undo-stack pruning has no isolated harness yet.
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      the `sectionOrderRef` tail-shift mirror ran only after `addItemAction` succeeded, so a failing
      item insert left the ref disagreeing with the DB about section order — moved to immediately
      after `insertSectionAction` resolves.
      test: no automated test — needs a failing-action seam in the hook.
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      the colour handler pushed an undo command even when the section was unknown or the colour
      unchanged, polluting the stack with no-ops — added the `sectionRow` lookup + `before === color`
      early returns.
      test: no automated test — cheap guard, covered by the picker's own `aria-pressed` state.
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/kosztorys/chart-slices.ts` · a section pinned to
      e.g. blue and an unpinned section landing on blue by position rendered two identical wedges.
      `paintSlices` now subtracts the pinned fills from the positional pool before assigning.
      test: unit — `src/__tests__/kosztorys-chart-slices.test.ts` extended.
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/kosztorys/append-preset-sections.ts:58` · a preset
      or snapshot written before the colour column has no `color` key — `s.color ?? null` normalizes
      it instead of writing `undefined`.
      test: folded into the `insert-rows` round-trip test above.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/kosztorys/section-colors.ts:188` ·
      `isSectionColorKey` validated only on write, so a palette key later retired from
      `SECTION_COLORS` would paint a wedge with a dead CSS var — the column is plain text on purpose
      (the palette grows without a migration), so the key is now validated on read too.
      test: no automated test — dropped, the guard is a one-line Map lookup.
- [x] fixed · `structure-scatter` · `src/components/kosztorys/editor/toolbar/panel-toggle-button.tsx` ·
      a generic icon-toggle button living under `editor/toolbar/` while every other generic control
      sits in `components/ui/` — `git mv`d to `src/components/ui/panel-toggle-button.tsx`, 1 import
      site updated.
- [x] fixed · `feature-first-structure` ·
      `src/components/kosztorys/editor/toolbar/menus/{kosztorys-row-actions-menu,section-color-picker}.tsx` ·
      the row-actions menu is a grid-cell affordance, not a toolbar one — `git mv`d both to
      `src/components/kosztorys/editor/grid/menus/`, 3 import sites updated.
- [x] fixed · `module-cohesion` · `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts` ·
      the growing `RowActionsCell` option bag was declared inline in `kosztorys-v2-columns.tsx` —
      extracted to its own module so the columns file stays a column list.
- [x] fixed · `tailwind-v4-audit` · `src/styles/globals.css` · the 27 palette values were about to be
      arbitrary `[...]` classes — registered as `@theme` tokens (`--color-section-<hue>[-soft|-deep]`,
      derived from the nine chart hues via `color-mix(in oklch, …)`) so Tailwind generates the
      utilities.
- [x] fixed · `tailwind-v4-audit` · `src/lib/kosztorys/section-colors.ts` · the palette must be
      written as 27 literals, never assembled from `${hue}-${tint}` — Tailwind cannot scan a template
      string and the generated `bg-…` class would ship without its rule. Documented at the top of
      the file so a future "dedup" doesn't undo it.
- [x] fixed · `tailwind-v4-audit` · `src/components/kosztorys/editor/grid/menus/section-color-picker.tsx` ·
      swatch grid hard-coded `grid-cols-9` with no explanation of the number — commented to the nine
      hues, so the three tint rows read as one family per column.
- [x] fixed · `code-review` ·
      `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx` ·
      `sectionGroupShown` chained only four of the six section handlers, so a menu given ONLY
      `onMoveSectionDown` or `onSetSectionColor` rendered the colour picker with no „Sekcje" header —
      widened to all six and wrapped in `Boolean()`.
      test: no automated test — dropped; the prop combination does not occur at the single call site
      today, the guard is defence for a future one.
- [x] fixed · `code-review` ·
      `src/components/kosztorys/editor/grid/menus/section-color-picker.tsx` · the swatches exposed the
      raw palette key (`turquoise-deep`) as their `title`/`aria-label` in a Polish UI — added
      `colorLabel()` mapping hue+tint to Polish („turkusowy ciemny").
- [x] fixed · `module-cohesion` · `src/lib/kosztorys/row-ops.ts:167` · `applyInsertSectionRow` and
      `swapSectionBlock` each rebuilt the section→rows map inline — extracted the private
      `groupBySection` helper both now share.
- [x] fixed · `code-review` · `src/lib/kosztorys/append-preset-sections.ts:3` · dead `sql` import left
      after the bulk-insert extraction — removed (eslint `no-unused-vars` was warning).
- [x] fixed · `comment-noise` · `src/lib/kosztorys/row-ops.ts` (`neighborSectionId`, `sectionSequence`) ·
      two comments restated the signature — deleted one, trimmed the other to the non-obvious half
      (why the sequence is read off `rows` rather than a second stored order).
- [x] fixed · `comment-noise` · `src/lib/kosztorys/chart-slices.ts` · a three-line comment narrated
      what the `??` on the next line already says — deleted; the header comment kept and sharpened
      to name the _unpinned_ survivors.
- [x] fixed · `comment-noise` · `src/lib/kosztorys/types.ts` · `sectionColor`'s comment ended with
      "as it always has", a vanished-state clause — trimmed.
- [x] fixed · `comment-noise` · `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts` ·
      a comment restated the option name it sat above — deleted.
- [x] fixed · `code-review` · `src/lib/kosztorys/section-colors.ts` · dead `SECTION_COLOR_ROW` export
      left from an earlier grouping shape — deleted after a grep across `src/` returned no
      references, gated on a clean `tsc`.
- [x] dismissed · `structure-scatter` · `src/lib/kosztorys/chart-slices.ts` (`CHART_FILLS`) · proposed
      deriving `CHART_FILLS` from `SECTION_COLORS` since they share values. **Rejected:** they share
      values but NOT order, and `CHART_FILLS`' order is the load-bearing positional palette — deriving
      it would recolour every existing pie in the app. Documented the string-identity coupling in a
      comment instead.
- [x] dropped · `module-cohesion` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` · the
      hook is ~700 lines and mixes row ops, section ops, undo, and autosave. Real, but it is a
      cohesive stateful unit and splitting it without a test harness first is exactly the review-worthy
      refactor EX-515 already deferred — no new issue, the existing one covers it.
- [x] skipped · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts`
      (`sectionOrderRef`) · the mount-seeded section-order Map is a second source of truth alongside
      `rows`; it works, but every section mutation must remember to sync it. Deliberately not
      reshaped in this gate — behaviour-changing and worth its own review. Noted on EX-515.

- [x] fixed · `simplify` · `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx` ·
      `itemOrderItems` and `sectionOrderItems` were the same four rows twice (same icons, same
      „Wstaw powyżej/poniżej" + „Przesuń w górę/w dół" labels, same `disabled={sortActive}`) — and
      they had already drifted once in this batch. Folded into one `orderItems(...)` renderer both
      groups call.
- [x] fixed · `simplify` · `kosztorys-row-actions-menu.tsx` + `kosztorys-v2-columns.tsx` · the six
      optional section props all come from ONE `editorOnly()` gate, so they are all-present or
      all-absent — yet the batch paid for that three times (five conditional prop bindings in the
      columns file, four `{onX && …}` wrappers in the menu, and a six-term `sectionGroupShown` OR).
      Collapsed into a single optional `section` bundle whose _presence_ gates the group, so it
      cannot half-appear. This supersedes the `sectionGroupShown` widening above.
- [x] fixed · `simplify` · `kosztorys-row-actions-menu.tsx` · `withSortHint` and the inline
      remove-tooltip wrapper were two spellings of the same "wrap a pointer-events-none disabled item
      so the tooltip still catches hover" idiom — generalized to one `withHint(node, reason?)`.
- [x] fixed · `simplify` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      `applySectionColor`/`handleSetSectionColor` were a line-for-line clone of
      `applySectionRename`/`handleRenameSection`; `updateSectionFieldAction` was already the generic
      write, only the client half was left un-generalized. Replaced with one `SECTION_ROW_FIELDS`
      map + `applySectionField` / `handleSetSectionField`, so `defaultCostVariant` won't triplicate it.
- [x] fixed · `simplify` · `use-kosztorys-editor.ts` · `handleInsertSection` and `handleAddSection`
      repeated the same 12-line `buildBlankRow({…})` argument object — this batch had to edit both to
      add `sectionColor`. Extracted `buildNewSectionRow(sectionId, item)`.
- [x] fixed · `simplify` · `src/lib/kosztorys/row-ops.ts` · `sectionSequence` duplicated what
      `groupBySection` already computes (a Map preserves insertion order, so its keys ARE the
      sequence) — both movers walked `rows` twice for two views of one fact. Deleted it in favour of
      `[...blocks.keys()]`, and folded the shared "mutate the sequence, re-concatenate the blocks"
      tail into `regroup(blocks, seq)`, so the non-contiguity invariant is stated once in code
      instead of twice in prose.
- [x] fixed · `simplify` · `src/lib/kosztorys/section-colors.ts` +
      `grid/menus/section-color-picker.tsx` · the swatch labels were reverse-engineered from the key
      by string surgery against two untyped `Record`s, with no fallback on the tint half (an unknown
      tint would have rendered „niebieski undefined") and the label computed twice per swatch.
      Since the palette is already an explicit literal table, each entry now carries its own `label`.
- [x] fixed · `simplify` · `src/components/ui/panel-toggle-button.tsx` (deleted) · extracted in
      `1bd8bd2e` to dedupe the „Sekcje" and „Podsumowanie" toggles — but `961e1f7c` deleted the
      „Sekcje" one with the drawer, leaving a `components/ui/` "primitive" with a single consumer and
      a hardcoded disclosure chevron. Inlined back into `kosztorys-toolbar-totals-toggle.tsx`; three
      hops to render one button became one. (Reverses this gate's own structure-scatter move above —
      the move was right for a shared primitive, and it stopped being one.)
- [x] fixed · `simplify` · `toolbar/kosztorys-toolbar-view-toggles.tsx` (deleted) · after the view and
      filter menus moved out, the file's whole body was one `ToolbarToggle` and a context read —
      a file and an import for zero composition. Inlined into `kosztorys-editor-toolbar.tsx`.
- [x] fixed · `simplify` · `toolbar/menus/kosztorys-actions-menu.tsx` · the only toolbar child taking
      six drilled props while its four siblings read `useKosztorysEditorContext()` themselves —
      deleting `KosztorysToolbarActions` moved the drilling up rather than removing it. It now reads
      the context too; the toolbar's destructure drops from nine values to six.
- [x] fixed · `simplify` · `src/lib/kosztorys/section-colors.ts` · `sectionColorSwatch` exported with
      zero callers (the picker reads `color.swatch` off the table directly) — deleted.
- [x] fixed · `simplify` · `use-kosztorys-editor.ts:1207` · `handleRenameSection` /
      `handleRemoveSection` still in the hook's returned object after the Sekcje drawer (their only
      external consumer) was deleted; the grid reaches them through `columnOpts`. Dropped from the
      return, kept as locals.
- [x] fixed · `simplify` · `src/components/kosztorys/summary/blocks/brutto-netto-summary.tsx` · dead
      `SectionSliceInputT` import left by the chart-slices rework — removed.
- [x] filed · `simplify` · `src/lib/actions/kosztorys.ts:314,271` · `swapSectionOrderAction` /
      `insertSectionAction` are near-verbatim copies of their item twins, and they have already
      diverged on transaction policy: the section swap is transactional (this gate's 🔴 fix), the item
      swap still runs `Promise.all` untransacted. Two copies is how you get to keep both answers.
      Not fixed here: unifying them changes behaviour in the item path, which is outside this batch
      and worth its own review — filed **EX-578** (also carries the "inserting a section = two
      sequential server actions" round-trip finding).
- [x] filed · `simplify` · `use-kosztorys-editor.ts` (`applySectionField`) · every swatch click fires
      `updateSectionFieldAction` + a full-route revalidation, and the picker is deliberately built for
      repeated picking — a 10-swatch browse costs 10 auth round trips, 10 UPDATEs and 10 RSC
      refetches. Not fixed here: debouncing a write that also feeds `pushReversible` is
      behaviour-changing and needs the undo interaction thought through — filed **EX-579**.
- [x] filed · `simplify` · `use-kosztorys-editor.ts` · three findings that all live inside the god
      hook and all wait on the same `renderHook` harness — the `sectionOrderRef` second source of
      truth (this gate's skipped finding above, now corroborated by three independent passes), the
      missing `SectionRowFieldsT` bundle behind the ten-site cost of adding `sectionColor`, and
      undo commands being closures that retain up to 50 whole hook contexts. Recorded on **EX-521**.
- [x] dismissed · `simplify` · `src/lib/kosztorys/chart-slices.ts` · re-raised deriving `CHART_FILLS`
      from `SECTION_COLORS` and deduping on palette key instead of CSS string. Same answer as the
      Step 1 triage: the two lists share values but not ORDER, and `CHART_FILLS`' order is the
      load-bearing positional palette. Keying the dedup on the palette index only helps if
      `CHART_FILLS` is derived, so it doesn't stand on its own.
- [x] dropped · `simplify` · `src/lib/kosztorys/section-colors.ts` · `rowTint` embeds the `.dsg-cell`
      selector and a `/20` opacity 27 times; a single `--section-tint` custom property + one rule in
      `globals.css` would centralize it. Real, but the row-tint shape is being actively iterated (the
      `!` there is load-bearing — dsg's stylesheet is unlayered and outranks `@layer utilities`), and
      rewriting it mid-flight would fight that work for no behavioural gain.
- [x] dropped · `simplify` · `src/lib/kosztorys/row-ops.ts` · `neighborSectionId` then
      `swapSectionBlock` each rebuild the section map, so a ▲/▼ walks `rows` twice. ~1000 extra
      iterations per click on the largest sheet — below the threshold where the plumbing to pass the
      blocks down is worth it.

## Simplify pass

Ran `/simplify` (4 parallel cleanup agents: reuse / simplification / efficiency / altitude), scoped to
this batch's files only — the EX-573 + netto work that arrived via the `ba1084bf` merge was excluded.
**13 applied, 3 filed, 1 dismissed, 2 dropped;** each folded into `## Findings` above, tagged
`simplify`. Three agents independently converged on `sectionOrderRef` and on the section/item action
duplication, which is why both were filed rather than dropped.

## Tests & suite

Two regression guards authored for the gate's correctness findings:

- `src/__tests__/lib/kosztorys/section-row-ops.test.ts` (new, 9 specs) — `applyInsertSectionRow`,
  `swapSectionBlock` and `neighborSectionId` against BOTH a tidy fixture and a non-contiguous one
  (a row appended at the array end by `applyAddItem`, which is the shape that broke the index splice).
- `src/__tests__/lib/kosztorys/append-preset-sections.test.ts` (f) + (g) — the section colour
  survives the preset round trip, and an unpinned section round-trips as `null` rather than as a
  dropped column. **Verified red first:** reverting `insertSections` to its pre-fix column list makes
  (f) fail with `expected null to be 'teal-deep'` while the other six specs stay green.

Suite:

- `pnpm exec tsc --noEmit` — clean
- `pnpm exec eslint src/components src/lib` — clean (0 errors, 0 warnings in this batch's files)
- `pnpm exec vitest run` — 1653 passed, 57 skipped (116 files)
- `pnpm test:integration` (isolated 5435 `db-test`) — 54 passed, 20 files
- `pnpm build` — clean

Migration `20260726_2_add_color_to_kosztorys_sections` is applied to the local docker DB (5433) and to
the 5435 test DB (via `test:integration`). **Prod is NOT migrated** — that is a human step
(`pnpm db:migrate:prod`), owed before the code that reads `kosztorys_sections.color` ships.
