# Review-gate ledger — ex-560-reload-from-preset · 2026-08-12

Scope: `d0bed5d7~1..HEAD` — 8 code files, 504 insertions.
Step 0.5 (verification pass) skipped: no `verify-manual-checks` skill in this install.
Fan-out: impl-review · code-review · tailwind-v4-audit · comment-noise-audit · feature-first-structure · module-cohesion-audit · structure-scatter-audit.

## Findings

Trimmed at archive (2026-08-12): the 15 `fixed` findings are gone — a fixed finding's durable
record is its commit, so what survives here is the negative space git cannot hold. Pre-trim
tally: 15 fixed, 1 filed, 5 dropped, 3 dismissed, 1 skipped · 0 open. The two owner rulings
carried by fixed findings (clear the rabat, name the restore point) moved to `change.md`.

- [x] 🔵 OBSERVATION · filed EX-674 · `impl-review F7` · the browser-level E2E this slice owes — `e2e-backlog`, project Wykonczymy, carries the risk, the five steps and its test disposition
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

Archived 2026-08-12 with every finding box checked. The EX-560 manual checks in
`context/foundation/manual-checks.md` are still unticked — non-blocking by the 2026-07-28 ruling, but
they remain owed; tick them there, not here.
