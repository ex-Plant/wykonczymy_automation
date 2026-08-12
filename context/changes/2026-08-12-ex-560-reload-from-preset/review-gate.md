# Review-gate ledger — ex-560-reload-from-preset · 2026-08-12

Scope: `d0bed5d7~1..HEAD` — 8 code files, 504 insertions.
Step 0.5 (verification pass) skipped: no `verify-manual-checks` skill in this install.
Fan-out: impl-review · code-review · tailwind-v4-audit · comment-noise-audit · feature-first-structure · module-cohesion-audit · structure-scatter-audit.

## Findings

- [x] 🟡 WARNING · fixed (owner ruling: clear it) · `code-review` · `calc.ts:191` + `restore-kosztorys.ts:38` · a surviving rabat globalny against a preset's zeroed przedmiar rendered „do zapłaty" negative — `globalDiscountAmount` is deliberately unclamped and the reload deliberately kept the discount. The reload now clears it (`restoreKosztorys` gained `clearGlobalDiscount`, passed only on this path); dialog copy says so, including that restoring the pre-reload point does not bring the rabat back (it lives outside the snapshot payload)
      test: TDD · integration — „zeroes the rabat globalny, which would otherwise outlive the work it discounts"
- [x] 🟡 WARNING · fixed (owner ruling: name it) · `code-review` + `impl-review F5` · `kosztorys-presets.ts:148` · restore points were all labelled „Przed wczytaniem szablonu", so five szablon swaps left five indistinguishable rows. The label now carries the szablon's name — `getPreset` returns it. Left uncapped by ruling: a manual row surviving the cap is the feature
      test: TDD · integration — the spec's snapshot lookup keys off the szablon-named label
- [x] 🔵 OBSERVATION · filed EX-674 · `impl-review F7` · the browser-level E2E this slice owes — `e2e-backlog`, project Wykonczymy, carries the risk, the five steps and its test disposition
- [x] 🟡 WARNING · fixed · `code-review` · `reload-from-preset-dialog.tsx:60-76` · `handleConfirm` awaited the action bare; a transport-level rejection after the commit fired no toast, never called `onReloaded()`, and left the grid rendering rows that no longer exist. Now try/catch: Polish toast AND `onReloaded()` regardless, so the tree re-reads either way
      test: no automated test — a dropped RSC response isn't provokable below the browser; EX-674 covers the flow
- [x] ⚠️ WARNING · fixed · `impl-review F1` · `kosztorys-presets.test.ts` · the fixture's absurd coefficients were never asserted, only `vat_rate`. The investment now carries its own coefficients and the spec asserts all three settings
      test: TDD · integration — the assertion IS the fix
- [x] ⚠️ WARNING · fixed · `impl-review F3` · `reload-from-preset-dialog.tsx:95` · the flat szablon list re-introduced the defect EX-618 removed. Now `SearchFilterInput` + `useSearchFilter`, same as the sibling picker
- [x] ⚠️ WARNING · fixed · `impl-review F2` + `module-cohesion` + `structure-scatter` · the fetch-on-open effect is now `use-preset-sections.ts` (one hook, both dialogs); `sekcjeNoun` / `praceNoun` / `getPresetName` moved to `preset-picker-groups.ts`
- [x] fixed · `feature-first-structure` + `module-cohesion` · new `src/lib/kosztorys/replace-tree-with-snapshot.ts` · the transactional snapshot-then-restore composition existed twice inline in the action layer with near-identical rationale comments; both `reloadFromPresetAction` and `applyKosztorysImport` now call the module, and the rationale lives in one place
- [x] fixed · `code-review` · `restore-kosztorys.ts:28` · the settings write looked like a deletable no-op; it is the `updatedAt` revision bump `useRestoreRemount` latches on. Comment records the coupling
- [x] fixed · `impl-review F4` · the inaccurate "no-op" claim is gone with the extraction — the module states the rule positively (settings are never taken from the incoming tree)
- [x] fixed · `comment-noise` · three restating opening clauses trimmed (`kosztorys-presets.ts`, the dialog, the spec's `seedLiveTree`)
- [x] fixed · `comment-noise` · `kosztorys-presets.test.ts:8` · blank line inserted so the file header no longer reads as a comment on `authState`
- [x] fixed · `impl-review F6` · `plan.md:34` · the Current State row now records that Phase 3 superseded the `<Select>` and why
- [x] fixed · `impl-review F8` · `manual-checks.md` · duplicate restore-point bullet dropped; the section also gained the search-filter and rabat checks
- [x] fixed · `tailwind` · the picker caps at `55vh`, matching the sibling dialog
- [x] fixed · `code-review` test gap · `kosztorys-presets.test.ts` · new case „rolls the pre-reload snapshot back when the insert itself throws" — a second fixture szablon with a duplicate stage `ordinal` trips `kosztorys_stages_investment_ordinal_unique` INSIDE the transaction; asserts the tree, etapy, postęp and the whole snapshot table are unchanged. Verified red-adjacent: the run log shows the unique violation reaching `[ACTION_ERROR]`
      test: TDD · integration — authored
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `kosztorys-presets.ts:182` · `serializeKosztorys` can throw an English `Investment N not found` into the Polish toast — unreachable: `investmentId` comes from the editor context of an investment being rendered
- [x] 🔵 OBSERVATION · dropped · `code-review` · `kosztorys-presets.ts:199` · the toast reports payload counts, not inserted counts — diverges only for a preset with dangling `sectionId`s, which nothing in this app writes; impl-review independently dropped it
- [x] 🔵 OBSERVATION · skipped · `code-review` · `kosztorys-presets.ts:182` · the pre-wipe read runs on the pool handle, not the tx handle — pattern-level, identical in `applyKosztorysImport`; tightening means threading `req` through `buildKosztorysTree` and deserves its own review
- [x] 🔵 OBSERVATION · dropped · `code-review` · `reload-from-preset-dialog.tsx:127` · „Zniknie" counts come from the server `tree`, not the live grid — the debounce window is short and the count is informational ahead of a reversible wipe
- [x] 🔵 OBSERVATION · dropped · `code-review` · `reload-from-preset-dialog.tsx:135` · Escape dismisses the dialog mid-write — repo-wide dialog behaviour, and the pre-reload snapshot makes the outcome recoverable
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/lib/db/presets.ts:120` · a preset with an empty `sections` array never appears in the picker — a szablon that wipes to blank is not a case the owner has asked for
- [x] 🔵 OBSERVATION · dropped · `code-review` · `reload-from-preset-dialog.tsx:33` · `new Set()` allocated per render for a parameter this picker doesn't read — React Compiler territory, cosmetic
- [x] dismissed · `tailwind` · `reload-from-preset-dialog.tsx:108` · `max-h-[45vh]` arbitrary value — Tailwind ships no viewport-height scale and the repo has three identical precedents
- [x] dismissed · `module-cohesion` · `kosztorys-presets.ts` · scanner flagged "6 exports / mixes kinds" — the one type is the action's own return contract and the five actions share one reason to change (preset semantics)

## Simplify pass

Not dispatched as a separate agent: the fan-out's three structure audits plus comment-noise already
enumerated every reuse/dedup/comment finding on a 10-file diff, and all of them were applied inline
above (`replace-tree-with-snapshot.ts`, `use-preset-sections.ts`, the shared nouns). A second pass
over the same diff would have re-derived the same list. No proposals held back.

## Tests & suite

- `pnpm typecheck` — clean
- `pnpm lint` — 0 errors (81 pre-existing warnings, all in migrations/untouched files)
- `pnpm test` — 2107 passed, 98 skipped
- `pnpm test:integration` (31 DB specs @ 5435) — 95 passed, including the reload spec's 6 cases
- `pnpm build` — clean
- E2E — filed as EX-674 (`e2e-backlog`), not authored

## Archive status

**Not archivable.** Every finding box is checked, but the EX-560 manual checks in
`context/foundation/manual-checks.md` are all unticked, so the slice stays `in review`.
