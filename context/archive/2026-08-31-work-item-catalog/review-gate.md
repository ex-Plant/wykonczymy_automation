# Review-gate ledger — work-item-catalog · 2026-08-31

Scope: commits `4a296fda`..`dc87e269` (14 commits, 54 files) — the „Katalog prac" slice.
Checks run: `/10x-impl-review`, `/code-review` (read-only, diff-scoped), `tailwind-v4-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`,
`comment-noise-audit` (flag-only).
Step 0.5 (browser verification pass) **skipped** — standing rule: never drive Playwright / E2E unprompted.

Verification run by the impl-review agent: 73 pure unit tests pass, 16 DB-backed action tests pass
against the 5435 test DB, `pnpm typecheck` clean, `pnpm lint` clean in slice files.

## Findings

- [x] 🟡 WARNING · dropped · impl-review · `src/lib/actions/work-catalogue.ts:61,89` · two concurrent
      creates on one `matchKey` race past the pre-check and surface Postgres 23505 raw. Five users, one
      cennik — the collision needs two managers typing the same praca in the same second, and the
      outcome either way is an error toast.
- [x] 🔵 fixed · code-review + impl-review · `build-catalogue-comparison.ts:88` · `closestDescription`
      re-folded and re-bigrammed the whole cennik per missing praca (10^5–10^6 allocations at the
      1000-row scale this repo plans for). Fix: fold + bigram the cennik once, outside the loop.
- [x] 🔵 fixed · impl-review · `src/lib/actions/work-catalogue.ts:129` · the wire could send `[5,5,5]`
      and append one praca three times (the length check passes because `listCatalogueItemsByIds`
      flatMaps over the REQUESTED ids). Fix: dedupe before the existence check.
- [x] skipped · impl-review(F4) · commit `64722e73` swept a parallel agent's `form-stores.ts` hunk, so it
      cannot typecheck in isolation and poisons bisect. Not rewritten: the branch tip is green and the
      working tree is shared with that agent right now. Recorded instead.
- [x] skipped · structure(F6) + impl-review(F7) · three reads live in `lib/actions/work-catalogue.ts`
      where AGENTS.md says `lib/queries`. The slice followed the repo's dominant precedent
      (`kosztorys-presets.ts`); moving three functions would deepen the inconsistency. Rule-vs-practice,
      owner's call — surfaced, not moved.
- [x] skipped · cohesion(C3) · `lib/actions/work-catalogue.ts` carries two caller groups (katalog CRUD /
      kosztorys↔katalog traffic). Real seam, 260 LOC, and a split moves `'use server'` entry points
      across six client files for readability alone. Recorded so the next addition lands on the right side.
- [x] dropped · structure(F4) · move `fold`/`foldDescription` out of `sheet-import/` to a shared home.
      One exported symbol shared by two kosztorys sub-features is not scatter; the move churns
      `sheet-import` for no reader gain.
- [x] dismissed · structure(S3) · append-orchestrator pair split across `lib/kosztorys/` and
      `work-catalogue/` — the sub-feature dir is the better structure; the audit itself proposed leaving it.
- [x] dropped · structure(J1) · `editor/dialogs/` is 30 flat files across 4 kinds. Pre-existing; each of
      the slice's four landed by the folder's own rules. Subdividing is a repo-level move, not a slice cleanup.
- [x] dropped · code-review · `createCatalogueItemAction` asks „does this klucz exist?" via `payload.find`
      while the module also imports the raw-SQL `findCatalogueItemByKey`. Unifying means widening the
      helper with an `id != n` exclusion for one caller.
- [x] dismissed · code-review · `lib/db/presets.ts` lost `import 'server-only'` so the seed runs under tsx
      — the precedent it cites is real (11 of 20 `lib/db` files skip it) and it is documented at the site.
- [x] dismissed · code-review · a value typed <500 ms before „Zapisz do katalogu…" may not be flushed, so
      the katalog freezes the pre-edit price. Every DB-reading editor window behaves this way and there is
      no flush primitive on the save lanes to reuse.
- [x] dismissed · code-review · `preview` never reset on close. Unreachable: the dialog is mounted per row
      only while open.

- [x] skipped · simplify(reuse+altitude+simplification) · `use-kosztorys-editor.ts:941,963` ·
      `handleAppendedCatalogueItems` copies `handleAppendedSections`' whole 9-key `treeToRows` argument
      plus its `prevById` loop, so a tenth field must be added twice. Real, and NOT fixed here: that
      file carries the parallel row-height agent's uncommitted work, so any edit is either uncommittable
      or sweeps their hunks — the exact mistake `64722e73` already made. Hand to whoever lands that file.
- [x] skipped · simplify(efficiency) · `use-kosztorys-editor.ts:985` · `appended.reduce(applyAddItem, rs)`
      rescans and rebuilds the whole array per appended praca — O(k×n) where one insertion-point lookup
      plus one splice would do. Same file hold as above, and thin on merit: 20 pozycji into a 1000-row
      rozpiska is ~20k comparisons, once, on a click.
- [x] dropped · simplify(reuse+altitude+simplification) · three local `asPricing`/`asPlanePricing`
      adapters across the work-catalogue folder. It is a 5-key object literal, not logic, and
      `toViewPricing(item, { wToolsCoeff: 0, ownToolsCoeff: 0 })` is no shorter than the literal it
      replaces — the parameters ARE the code. Three more copies predate the slice in `sheet-import/`,
      so deduping only the new ones would not even make the folder consistent.
- [x] dropped · simplify(simplification) · `save-item-to-catalogue-dialog.tsx:53` inlines the same
      stale-latch as the two list hooks. Left out of `useListOnOpen`: its payload is one object rather
      than a list, its failure CLOSES the dialog instead of showing an empty state, and its fetcher is
      parameterised by `itemId` — folding it in would need a fallback value, an onFail hook and a
      fetcher ref, i.e. more machinery than the ten lines it hides.

## Simplify pass

Ran the four cleanup agents (reuse / simplification / efficiency / altitude) over the slice, fenced
off from the parallel row-height work in the tree — 6 findings after dedup (three agents converged on
the `handleAppended*` twins): 2 fixed, 2 skipped, 2 dropped, each folded into `## Findings` above
tagged `simplify`. No separate report file — this ledger is the record.

After the fixes: `pnpm typecheck` clean, `eslint` clean on the touched files, 17 DB-backed action
tests green against the 5435 test DB.

## Tests & suite

- **Nowe testy tej bramki (po `/simplify`, zgodnie z kolejnością):** `combobox-commit.test.ts` (4),
  `work-catalogue-item-schema.test.ts` (6), plus regresja „odmawia zapisu pracy bez j.m." dopięta do
  `work-catalogue-save.test.ts`.
- **Unit / pure:** `src/__tests__/lib/kosztorys/work-catalogue` + `src/__tests__/components/**` — zielone.
- **DB-backed (5435 `wykonczymy-test`):** `work-catalogue{,-save,-insert}.test.ts` — 17 zielonych,
  przebiegnięte ponownie PO zmianach z `/simplify`.
- **E2E:** nieautorskie w tej bramce — cała powierzchnia zmiany jest przeglądarkowa, a standing rule
  zabrania uruchamiania Playwrighta bez prośby. Odłożone jako **EX-756** (label `e2e-backlog`),
  z pięcioma ryzykami i dyspozycją testową w treści.
- **Whole-tree gate (po `/simplify`):** `pnpm typecheck` czysty · `pnpm lint` czysty ·
  `pnpm test` 3113 zielonych / 0 czerwonych (193 pominięte to speki wymagające bazy, puszczone
  osobno przeciw 5435) · `pnpm build` przechodzi.

_Trimmed at archive (2026-09-02): 19 `fixed` finding(s) removed — a fixed finding's durable record is its commit; what survives is the negative space git cannot hold. Pre-trim tally: 19 fixed, 17 other, 0 open._
