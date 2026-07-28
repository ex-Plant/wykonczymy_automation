# Review-gate ledger — scalable-preset-section-picker (EX-618) · 2026-07-28

Scope: `b9259901..a3c37a73`, minus `68bd52be` (EX-579, foreign commit in the range).

Files under review:

- `src/components/kosztorys/editor/dialogs/add-sections-from-preset-dialog.tsx`
- `src/components/kosztorys/editor/dialogs/preset-picker-groups.ts`
- `src/hooks/use-search-filter.ts`
- `src/__tests__/components/kosztorys/preset-picker-groups.test.ts`

Pulled in by fixes: `src/lib/utils/polish-plural.ts` (new), `src/lib/export/invoice-zip.ts`,
`src/components/kosztorys/summary/settlement-plane-warning.tsx`, and the two new specs
`src/__tests__/hooks/use-search-filter.test.ts`, `src/__tests__/lib/utils/polish-plural.test.ts`.

**Checks run:** `/code-review`, `/10x-impl-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `comment-noise-audit`
(flag-only) — read-only fan-out; then `/simplify` serially. No Step 0.5 verification pass — this
slice's browser checks live in `context/foundation/manual-checks.md` and are non-blocking as of
2026-07-28.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review · `add-sections-from-preset-dialog.tsx:154` · the pane gate
      used `md:`, which in this repo is **1024px**, not 768 — so the whole 768–1023px band rendered a
      768px-wide dialog with a single pane and a back button. Moved all three gate sites to `sm:`
      (48rem/768px). Root cause is the repo's `@theme` breakpoint override in `src/styles/globals.css`;
      documented in `AGENTS.md` § Stack Notes so the next slice doesn't repeat it.
      test: no automated test · e2e — a CSS-breakpoint defect is only observable in a real browser;
      the width assertion is folded into EX-505.
- [x] 🔴 CRITICAL · fixed · code-review · `add-sections-from-preset-dialog.tsx:63` · the fetch had no
      `.catch()`, so a transport-level RPC rejection (which never resolves to `{success:false}`) left
      „Ładowanie szablonów…" spinning forever with no way out but closing the dialog. Added the catch
      **and** the missing in-flight cancellation (`stale` flag), so a close-then-reopen mid-load can no
      longer resolve into the reset state or toast at a dialog nobody is looking at. This exact hang was
      already fixed once in `use-snapshot-list.ts` — the picker was a copy that predated the fix, which
      is what EX-620 is for.
      test: no automated test · e2e — needs a failed server action at the transport layer; belongs with
      the picker E2E in EX-505, not a unit spec.
- [x] 🟡 WARNING · fixed · code-review · `add-sections-from-preset-dialog.tsx:154` · `h-[55vh]` forced
      the body to a fixed height regardless of content, so a two-szablon library left a large empty
      panel and — combined with the parent's `overflow-hidden` — a tall one could clip the footer.
      `max-h-[55vh]` makes both cases correct, and made the reviewers' disagreement about the clipping
      moot.
- [x] 🟡 WARNING · fixed · code-review · `add-sections-from-preset-dialog.tsx:213` · the right-pane
      header was one button doing two jobs, neutered above `sm` with `sm:pointer-events-none` — a
      control that is focusable and announced as a button but does nothing when activated. Split into a
      real back `<button>` (`sm:hidden`) and a plain `<p>` (`hidden sm:block`).
- [x] 🟡 WARNING · fixed · code-review · `add-sections-from-preset-dialog.tsx:227` · the mass-select and
      per-sekcja rows are toggles with no pressed state exposed — a screen reader announced only the
      label, so a ticked sekcja was indistinguishable from an unticked one. Added `aria-pressed`, plus
      `aria-current` on the active szablon row.
- [x] 🟡 WARNING · fixed · code-review · `add-sections-from-preset-dialog.tsx:197` · „3 sekcje" for any
      count — the Polish 3-way plural was missing. Routed through the new `pluralize`.
- [x] 🔵 OBSERVATION · fixed · code-review · `add-sections-from-preset-dialog.tsx:221` · the active
      szablon's name only rendered as the drill-in back-label, so above `sm` — with the left pane
      filtered and the highlighted row scrolled out of view — „Zaznacz wszystkie" gave no clue which
      szablon it would fill. Name now shows at every width.
- [x] 🔵 OBSERVATION · fixed · impl-review · `add-sections-from-preset-dialog.tsx:138` ·
      `allActiveSelected` was tracked in state alongside the selection `Set` it is fully derivable from
      — two sources for one fact. Derived instead.
- [x] 🔵 OBSERVATION · dismissed · impl-review · `add-sections-from-preset-dialog.tsx:57` ·
      `activeGroup` falls back to `groups[0]`, which is `undefined` for an empty library — flagged as a
      crash. Benign: the whole two-pane block sits behind `sections.length === 0`, so `groups` is
      non-empty everywhere `activeGroup` is read.
- [x] 🔵 OBSERVATION · dismissed · impl-review · `preset-picker-groups.ts` · grouping recomputed every
      render rather than memoized. Benign — React Compiler is enabled and this is exactly what it
      handles; a hand-written `useMemo` here is the anti-pattern (`AGENTS.md` § Stack Notes).
- [x] fixed · simplify (reuse) · `src/lib/utils/polish-plural.ts` · three hand-rolled copies of the
      Polish 1 / 2–4 / 5+ rule (`settlement-plane-warning.tsx`, `invoice-zip.ts`, and the new sekcja
      counter). Unified into one `pluralize(count, forms)`; `pluralForm` stays un-exported. Reaching
      into two files outside the diff to land it is fix-now by the gate's own rule, and `invoice-zip`'s
      existing 33-test spec is the regression guard.
- [x] fixed · simplify (efficiency) · `src/hooks/use-search-filter.ts` · `foldText` ran over every row's
      text on every keystroke — a five-stage normalize + regex chain, against 5000 client-side rows in
      the leads table. Haystacks are now folded once per dataset. The widening was verified safe across
      all seven `useSearchFilter` callers first.
- [x] fixed · simplify (altitude) · `src/hooks/use-search-filter.ts` · that memoization initially left
      `filterBySearch` exported and spec'd but off the production path — the spec guarded a copy of the
      logic rather than the logic. Recollapsed to one path: `foldHaystacks` + `filterBySearch`, both
      called by the hook and both exercised by the spec.
- [x] fixed · simplify (simplification) · `add-sections-from-preset-dialog.tsx:111` · `toggleGroup` took
      metas and mapped them to keys internally while every other selection path spoke keys. Now maps at
      the call site, so the whole selection surface is key-shaped.
- [x] fixed · comment-noise · `add-sections-from-preset-dialog.tsx`, `preset-picker-groups.ts`,
      `preset-picker-groups.test.ts` · comments restating the code they sat on (a `className` narrated
      in prose, a `describe` block re-described). Trimmed; the load-bearing _why_ comments (the `null`
      sentinel, the fetch-on-open seam, the reset-on-close rationale) kept.
- [x] fixed · feature-first-structure · `preset-picker-groups.ts` · pure derivation lifted out of the
      dialog into its own module beside it, with the spec that made it worth extracting. Placement
      confirmed correct — picker-specific, not cross-feature.
- [x] fixed · impl-review · `plan.md`, `change.md`, `manual-checks.md`, `AGENTS.md` · doc drift against
      what shipped: the `md:`→`sm:` correction recorded under Phase 3, the dropped cross-szablon sekcja
      search recorded as an owner reversal during planning, the Phase 3 resize check restated at 768px
      with an explicit both-panes-visible assertion, and the breakpoint override added to `AGENTS.md`.
- [x] dropped · module-cohesion · `add-sections-from-preset-dialog.tsx` · the file holds the component
      plus four small handlers (~270 lines). Real, but splitting one cohesive dialog into a hook file
      buys nothing here — the same judgement already made for `use-kosztorys-editor` under EX-515.
- [x] dropped · comment-noise · `use-search-filter.ts` · wording nits on comments that survived the
      trim. Not worth the churn.
- [x] filed EX-619 · deferred · code-review · `add-sections-from-preset-dialog.tsx:180` · drilling in
      applies `display:none` to the pane holding the just-activated button, so focus falls to `<body>`
      and the next Tab restarts from the top of the dialog. A regression against the cmdk version. Out
      of scope here: needs focus refs plus browser verification.
      test: no automated test · e2e — focus-after-visibility-toggle is browser-only; disposition
      recorded in EX-619 so the guard travels with the fix.
- [x] filed EX-620 · deferred · simplify (reuse) · `add-sections-from-preset-dialog.tsx:63` vs
      `use-snapshot-list.ts` · the fetch-on-open lifecycle is duplicated piece for piece, and had already
      diverged (that's the missing `.catch()` above). Extraction rewrites a hook the versions drawer
      depends on — its own review.
- [x] filed EX-621 · deferred · simplify (altitude) · `src/components/ui/search-filter-input.tsx:64` ·
      the primitive bakes a toolbar width in, so a full-width caller must cancel both the base and the
      `lg:` variant — hence `inputClassName="w-full lg:w-full"`, which reads as a typo. Changes a shared
      `ui/` primitive under seven call sites with no visual coverage.
- [x] filed EX-622 · deferred · simplify (efficiency) · `src/lib/db/presets.ts:96` ·
      `listPresetSections` selects every szablon's full jsonb payload and walks every item just to count
      per sekcja — O(payload bytes) for an O(sections) result. Pre-existing and cached; EX-618's plan
      already named it as out of scope.
      test: no automated test · integration — recorded in EX-622.
- [x] filed EX-623 · deferred · structure-scatter · `src/__tests__/components/kosztorys/` · this slice's
      spec landed in a third competing home for component-sourced specs. Nothing broken (discovery greps
      the whole tree); resolving it means moving other slices' specs, so it isn't this slice's edit.
- [x] filed EX-624 · deferred · tailwind-v4-audit · `ui/dialog.tsx:55`, `ui/calendar.tsx:40` · vendored
      shadcn components carry stock-scale `sm:`/`md:` assumptions that mean something else here — the
      same class of defect as the CRITICAL above, still latent. Both degrade to a legible narrow layout,
      so not urgent, and fixing shared primitives blind is not a gate-time edit.
- [x] filed EX-505 · deferred · impl-review · picker E2E · the rebuild's two genuinely new behaviours —
      cumulative selection surviving a szablon switch, and selection surviving a filter that hides the
      selected szablon — are observable only in a browser. Appended as scenarios 5–6 to the existing
      `e2e-backlog` issue rather than opening a second one for the same flow.
      test: no automated test · e2e — filed as EX-505.

## Simplify pass

Ran `/simplify` (4 cleanup agents: reuse / simplification / efficiency / altitude) — 5 applied,
0 proposed, 3 deferred-and-filed (EX-620, EX-621, EX-622); each folded into `## Findings` above
tagged `simplify`. No separate report file — this ledger is the single record.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors, 86 warnings, all pre-existing in `src/migrations/**`.
- `pnpm exec vitest run` over the four touched spec files — 4 files, 49 tests passed
  (`preset-picker-groups` 7, `use-search-filter` 5, `polish-plural` 4, `invoice-zip` 33).
- Specs authored **after** `/simplify`, per the gate's ordering: `use-search-filter.test.ts` (5, the
  diacritic fold), `polish-plural.test.ts` (4, incl. the 12–14 teens trap), plus 2 cases added to
  `preset-picker-groups.test.ts` (group name taken from its metas; a szablon whose metas arrive
  non-consecutively).
- Full suite (`test:e2e` + `build`) — not run. E2E is non-blocking for Done as of 2026-07-28, and
  this slice's browser coverage is filed as EX-505.
