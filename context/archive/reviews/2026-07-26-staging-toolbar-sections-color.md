# Review-gate ledger — staging toolbar + section ops + section colour · 2026-07-26

Scope: everything on `staging` not covered by the previous gate. The batch `d5b80d37`..`8ef4a3e5`
has its own ledger (`context/archive/reviews/2026-07-25-staging-post-merge-kosztorys-refactors.md`),
so this gate covers:

- `1bd8bd2e` dedupe toolbar panel-toggle buttons (`panel-toggle-button.tsx`)
- `d81fef76` reposition toolbar toggles
- `49ec90ad` move „Widok sekcji" into the right-aligned toolbar cluster
- `44296504` section insert + reorder in the row-actions menu (`swapSectionOrderAction`,
  `insertSectionAction`, `swapSectionBlock`, `applyInsertSectionRow`)
- `961e1f7c` remove the redundant Sekcje side drawer
- `7765ef49` per-section colour end-to-end (migration + `section-colors.ts` palette +
  `SectionColorPicker` + pinned pie fills + grid row tint)

**Explicitly out of scope:** the EX-573 transfer-type spec table and the netto-expense batch, which
arrived on this branch via the `ba1084bf` merge of `origin/staging`. Both carry their own closed
ledgers in their change folders.

No `plan.md` covers this batch (worked directly on `staging`) → `/10x-impl-review` dropped from the
fan-out. No manual-verification skill in this project → Step 0.5 skipped. Ran: `/code-review`,
`tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`,
`comment-noise-audit`.

**Trimmed at archive (2026-08-10).** The 38 `fixed` findings were removed: each one's durable record
is its commit, and a ledger line describing a change is strictly worse evidence than the change.
Kept in condensed form: the three **filed** findings, since a filing leaves no commit. What else
survives is the negative space git cannot hold — what a reviewer looked at and chose **not** to act
on, and why. Moved here from the `.review-gate/` fallback path, which had no lifecycle of its own.

Final tally before the trim: **38 fixed, 3 filed, 2 dismissed, 3 dropped, 1 skipped, 0 open.**

The four 🔴/🟡 correctness fixes that shipped in this gate, for the record (their detail is in the
commits): `insertSections` never wrote the new `color` column; `applyInsertSectionRow` spliced by
array index on non-contiguous section blocks; `swapSectionOrderAction` ran two untransacted
`payload.update` calls; and four `use-kosztorys-editor` handler bugs (stale-closure `setRows`, undo
`touchedIds` computed after the swap, the `sectionOrderRef` mirror gated on the wrong action,
no-op undo commands from the colour handler).

## Findings

- [x] filed · `simplify` · `src/lib/actions/kosztorys.ts:314,271` · `swapSectionOrderAction` / `insertSectionAction` are near-verbatim copies of their item twins, and they have already diverged on transaction policy: the section swap is transactional (this gate's 🔴 fix), the item swap still runs `Promise.all` untransacted. Two copies is how you get to keep both answers. Not fixed here: unifying them changes behaviour in the item path — filed **EX-578** (also carries the "inserting a section = two sequential server actions" round-trip finding).
- [x] filed · `simplify` · `use-kosztorys-editor.ts` (`applySectionField`) · every swatch click fires `updateSectionFieldAction` + a full-route revalidation, and the picker is deliberately built for repeated picking — a 10-swatch browse costs 10 auth round trips, 10 UPDATEs and 10 RSC refetches. Not fixed here: debouncing a write that also feeds `pushReversible` is behaviour-changing and needs the undo interaction thought through — filed **EX-579**.
- [x] filed · `simplify` · `use-kosztorys-editor.ts` · three findings that all live inside the god hook and all wait on the same `renderHook` harness — the `sectionOrderRef` second source of truth (corroborated by three independent passes), the missing `SectionRowFieldsT` bundle behind the ten-site cost of adding `sectionColor`, and undo commands being closures that retain up to 50 whole hook contexts. Recorded on **EX-521**.
- [x] skipped · `code-review` · `use-kosztorys-editor.ts` (`sectionOrderRef`) · the mount-seeded section-order Map is a second source of truth alongside `rows`; it works, but every section mutation must remember to sync it. Deliberately not reshaped in this gate — behaviour-changing and worth its own review. Noted on EX-515.
- [x] dismissed · `structure-scatter` · `src/lib/kosztorys/chart-slices.ts` (`CHART_FILLS`) · proposed deriving `CHART_FILLS` from `SECTION_COLORS` since they share values. **Rejected:** they share values but NOT order, and `CHART_FILLS`' order is the load-bearing positional palette — deriving it would recolour every existing pie in the app. Documented the string-identity coupling in a comment instead.
- [x] dismissed · `simplify` · `src/lib/kosztorys/chart-slices.ts` · re-raised deriving `CHART_FILLS` from `SECTION_COLORS` and deduping on palette key instead of CSS string. Same answer as the Step 1 triage: the two lists share values but not ORDER. Keying the dedup on the palette index only helps if `CHART_FILLS` is derived, so it doesn't stand on its own.
- [x] dropped · `module-cohesion` · `use-kosztorys-editor.ts` · the hook is ~700 lines and mixes row ops, section ops, undo, and autosave. Real, but it is a cohesive stateful unit and splitting it without a test harness first is exactly the review-worthy refactor EX-515 already deferred — no new issue, the existing one covers it.
- [x] dropped · `simplify` · `src/lib/kosztorys/section-colors.ts` · `rowTint` embeds the `.dsg-cell` selector and a `/20` opacity 27 times; a single `--section-tint` custom property + one rule in `globals.css` would centralize it. Real, but the row-tint shape is being actively iterated (the `!` there is load-bearing — dsg's stylesheet is unlayered and outranks `@layer utilities`), and rewriting it mid-flight would fight that work for no behavioural gain.
- [x] dropped · `simplify` · `src/lib/kosztorys/row-ops.ts` · `neighborSectionId` then `swapSectionBlock` each rebuild the section map, so a ▲/▼ walks `rows` twice. ~1000 extra iterations per click on the largest sheet — below the threshold where the plumbing to pass the blocks down is worth it.

Two constraints this gate discovered and pinned **in code**, worth naming because a future "cleanup"
would otherwise undo them:

- `section-colors.ts` — the palette must be written as 27 **literals**, never assembled from
  `${hue}-${tint}`. Tailwind cannot scan a template string, so the generated `bg-…` class would ship
  without its rule. Documented at the top of the file.
- `panel-toggle-button.tsx` — the gate's own `structure-scatter` move (`editor/toolbar/` →
  `components/ui/`) was **reversed** by the simplify pass in the same gate: `961e1f7c` had deleted
  the „Sekcje" toggle with the drawer, leaving a `components/ui/` "primitive" with a single consumer.
  The move was right for a shared primitive, and it stopped being one.

## Simplify pass

Ran `/simplify` (4 parallel cleanup agents: reuse / simplification / efficiency / altitude), scoped to
this batch's files only — the EX-573 + netto work that arrived via the `ba1084bf` merge was excluded.
**13 applied, 3 filed, 1 dismissed, 2 dropped;** each folded into `## Findings`. Three agents
independently converged on `sectionOrderRef` and on the section/item action duplication, which is why
both were filed rather than dropped.

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

Migration `20260726_2_add_color_to_kosztorys_sections` was applied to the local docker DB (5433) and
to the 5435 test DB. **Prod was NOT migrated** — that is a human step (`pnpm db:migrate:prod`), owed
before the code that reads `kosztorys_sections.color` ships.
