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

Fixed findings were trimmed at archive (their fix is now just the code, in `f5616d32`); the two
🔴 CRITICALs are summarised on EX-618 for anyone reading the card rather than the diff. What remains
below is every finding that still carries a _decision_ — dismissed, dropped, or filed.

- [x] 🔴 CRITICAL · **dismissed in error, then fixed** · impl-review ·
      `add-sections-from-preset-dialog.tsx:138` · `activeGroup` falls back to `groups[0]`, which is
      `undefined` while `sections` is still `null`. Dismissed at the gate as benign — "the two-pane
      block sits behind `sections.length === 0`" — which held for the JSX but **not** for
      `allActiveSelected`, because the gate's own state→derived fix had moved that read _above_ the
      guard. The dialog crashed on every open; caught in the browser right after archive. Derivation
      extracted to `preset-picker-groups.ts` as `isGroupFullySelected(group | undefined)`.
      test: test-driven-debugging · unit — red on `isGroupFullySelected(undefined)` first, now the
      regression guard (`preset-picker-groups.test.ts`).
      **Lesson:** converting state to a derived value re-anchors the read to the top of the component
      body, above every guard the state was implicitly safe behind. `groups[0]` types as
      `PresetGroupT`, not `| undefined`, so `tsc` cannot catch it —
      `noUncheckedIndexedAccess` would have.
- [x] 🔵 OBSERVATION · dismissed · impl-review · `preset-picker-groups.ts` · grouping recomputed every
      render rather than memoized. Benign — React Compiler is enabled and this is exactly what it
      handles; a hand-written `useMemo` here is the anti-pattern (`AGENTS.md` § Stack Notes).
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
