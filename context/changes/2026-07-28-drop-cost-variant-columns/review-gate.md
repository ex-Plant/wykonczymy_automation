# Review-gate ledger — drop-cost-variant-columns (EX-575) · 2026-07-28

Scope: `68564aa3^..HEAD` — 53 files, +1195/−529. Commits `68564aa3` (p1) … `01ccb652` (epilogue).

**Checks run:** `/10x-impl-review`, `/code-review` (diff-scoped, read-only), `comment-noise-audit`
(diff-scoped, flag-only).
**Checks dropped:** `tailwind-v4-audit` — no styling or JSX in the diff (the one component file is a
hook). `feature-first-structure` / `module-cohesion-audit` / `structure-scatter-audit` — the slice adds
exactly one new file (a migration, in the canonical `src/migrations/`); everything else is deletion, so
there is no placement or scatter decision to audit.
**Step 0.5 (verification pass):** skipped — no browser/manual verification skill installed
(`verify-manual-checks` absent). Manual checks are registered in `context/foundation/manual-checks.md`
under `## EX-575` and are the archive's second blocker.

## Findings

- [x] 🟡 WARNING · fixed · `impl-review` · `context/reference/kosztorys-editor-domain-notes.md:178` · „Plan kosztu podwykonawcy = Σ pomiar × cena_wariantu_kosztu_pozycji" still read per-pozycja — the one Phase 6 contract item silently skipped; rewritten to Σ po etapach.
      test: no automated test · — a prose correction in a reference doc; nothing executes it.
- [x] 🟡 WARNING · fixed · `impl-review` · `context/reference/kosztorys-editor-domain-notes.md:401` · the kept „globalny przełącznik z/bez **znika**" bullet contradicted the new „zostaje" statement 35 lines below; re-tagged as the superseded proposal, pointing at „Co wdrożono".
      test: no automated test · — same, prose only.
- [x] 🟡 WARNING · fixed · `impl-review` + `code-review` · `src/lib/kosztorys/row-ops.ts:4` · `ToolPlaneT` import left dead by the `sectionDefaultCostVariant` removal; ESLint flagged it but the rule is a warning, so `pnpm lint` still exited 0. Removed.
      test: no automated test · — an unused type import; `tsc` + eslint are the guard, no runtime behavior to assert.
- [x] 🟡 WARNING · fixed · `impl-review` · `context/reference/kosztorys-editor-domain-notes.md:394` · „nie ma gdzie tego zapisać" read as a live gap inside a section retitled ROZSTRZYGNIĘTE; put in the past tense.
      test: no automated test · — prose only.
- [x] 🔵 OBSERVATION · fixed · `impl-review` + `code-review` · `context/domain/01-domain-distillation.md` (Price views row) · still asserted the coeff cascade „item override > section > global"; the section tier died with `20260724_1` and `effectiveCoeff` reads only the global. Narrowed to „item override, else global".
      test: no automated test · — a doc claim; the code it describes is unchanged and already covered.
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `plan.md:384-385` · Phase 5's verify commands (bare `vitest run <path>`) skip — the specs are DB-gated. Rows now record that they were run via the test-DB env.
- [x] 🔵 OBSERVATION · filed EX-632 · `impl-review` · `src/__tests__/lib/kosztorys/display-order.test.ts:290` · load-dependent deadlock flake, 1/23 files red under the full integration suite, 6/6 green in isolation. Pre-existing, touches neither dropped column, file not in this diff.
      test: test-driven-debugging · integration — recorded in EX-632 so the regression guard travels with the fix.
- [x] 🔵 OBSERVATION · fixed · `impl-review` + `comment-noise` · `src/lib/kosztorys/snapshot-format.ts:14` · the precedent sentence named `costVariant`, an identifier that exists nowhere else in `src/` — and was the sole reason the grep wasn't clean. Trimmed to a bare `20260724_1` cite; the rule and the asymmetry stay.
- [x] 🔵 OBSERVATION · fixed · `impl-review` + `comment-noise` · `src/components/kosztorys/editor/use-kosztorys-editor.ts:890` · the trim left „so they share one pathway", which the next line already says. Clause deleted, the real constraint kept.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `context/changes/2026-07-28-drop-cost-variant-columns/change.md:4` · `status: implemented` vs the plan's `done` — deliberate: the slice is in review, not shipped. Flips at archive.
- [x] fixed · `comment-noise` · `src/migrations/20260728_0_drop_kosztorys_cost_variant.ts:4` · „39 minutes after the columns were born" is decoration; the sha is the evidence. Compressed.
- [x] fixed · `comment-noise` · `src/lib/kosztorys/types.ts:88` · „One carrier only" is a grep-able enumeration that rots on the next carrier; cut, keeping the etap-not-pozycja design guard.
- [x] fixed · `comment-noise` · `src/collections/kosztorys-items.ts:6` · „markup coefficient (section/investment)" — the section tier was dropped by `20260724_1` and this slice edited the comment without fixing it. Now „(investment)".
- [x] fixed · `simplify` · `src/lib/kosztorys/constants.ts:42` · `NEW_SECTION_DEFAULTS` (one key, vacuous `satisfies`) → `DEFAULT_SECTION_NAME`, matching its `DEFAULT_UNIT` siblings; call sites followed.
- [x] fixed · `simplify` + `reuse-scan` · `src/components/kosztorys/editor/use-kosztorys-editor.ts:542` · three `buildBlankRow` call sites re-spelled the same five tree-derived fields; extracted `makeBlankRow(identity)`, ~15 lines out.
- [x] fixed · `simplify` · `src/lib/kosztorys/create-section.ts:21` · dead optional `name?` param — no call site passes it.
- [x] fixed · `simplify` · `src/components/kosztorys/editor/use-kosztorys-editor.ts:52,67` · dead imports `rowRemainingForView`, `toGross`.
- [x] dropped · `simplify` · `src/lib/kosztorys/types.ts:56` · `ItemPatchT`'s `Pick` now equals its `Omit` — kept as an allowlist on purpose: under `Omit` a future column becomes patchable in the type while zod strips it at the boundary.
- [x] dropped · `simplify` · `src/lib/actions/kosztorys.ts:29` · `stagePlaneSchema` now single-use — the alias carries the „derived from `TOOL_PLANES`" rationale, worth more than the inline.
- [x] dropped · `simplify` · `src/lib/kosztorys/settlement.ts:6,10` · three unused imports — real, but in a file this slice never touched; not worth widening the diff.
- [x] dismissed · `simplify` · `use-kosztorys-editor.ts:889`, `v2-rows.ts:19`, `constants.ts:14` · `SECTION_ROW_FIELDS` still has two members, `ITEM_FIELDS satisfies` still binds 12 keys, `TOOL_PLANES` is still a live two-member union — none went vacuous.

## Simplify pass

Ran `/simplify` (+ `primitive-reuse-scan`, diff-scoped) — 4 applied, 3 dropped, 4 dismissed, 0 proposed;
each finding folded into `## Findings` above (tagged `simplify` / `reuse-scan`).
Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.NjFbKnPMsc.md`

## Tests & suite

No new tests owed: every finding was prose, a dead import, or an internal refactor with no behavior
change — nothing named a risk `context/foundation/test-plan.md` doesn't already carry, and the slice
has no browser-level surface (pure deletion + internal refactor), so no E2E is owed.

Fast legs only (user's call — integration + build deferred):

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors, 84 warnings (down from 87; the three removed dead imports).
- `pnpm test` — 114 files / 1875 tests passed, 25 files / 70 tests skipped (DB-gated).
- `pnpm test:integration` — deferred by user. Last full run (Phase 4) was 23/23 green; the review's
  own re-run hit the EX-632 flake, unrelated to this slice.
- `pnpm build` — deferred by user.
