# Review-gate ledger — filtry-problemy (cały branch vs `staging`) · 2026-08-17

Scope: the whole `staging`-relative diff of this branch, which carries **three** workstreams — a
parallel agent committed onto it:

- **A. filtry-problemy** — the row + stage problem registry, the „Problemy" trigger, the row latch,
  the plane switch on pick, keyboard in the subcontractor cells
- **B. investor rename** — „klient" → „inwestor", `/podglad-klienta` → `/podglad-inwestora`
- **C. sheet import** — coefficient/rate resolution from the cennik, `DEFAULT_COEFFS.ownTools`
  0.55 → 0.5525, deletion of the `kosztorys-bialostocka` fixture + `seed-investment-from-sheet.ts`

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only) — 8 reports, all
triaged in the main thread.

## Findings

_Findings zamknięte jako `fixed` usunięto przy archiwizacji (2026-08-18): trwałym zapisem
poprawki jest jej commit, a to, czego git nie utrzyma, to decyzje o niezrobieniu. Tally przed
cięciem: 6 skipped, 3 dismissed, 20 fixed, 5 dropped, 1 ? · 0 open._

- [x] skipped · code-review · `src/lib/kosztorys/row-conditions.ts` · `conditionCounts` runs one full
      pass per condition on every keystroke — at 1000+ pozycji that is thousands of predicate calls per
      edit; the fix inverts the loop and reshapes a public function + its spec, so it is its own
      review. Re-raised and re-skipped at the `kosztorys-filters-visible-and-extended` gate
      (2026-08-18), where the registry grew six more entries and widened it further.
      **Still unfiled — the Linear workspace is at its free-issue cap (retried 2026-08-18).** This
      ledger is the record until an issue can be opened; the direction is one pass over the pozycje
      with the registry loop inside, accumulating `id → count`. Measure before/after on the perf
      dataset (`INV=7 … perf-seed-kosztorys.ts`) — this is the path EX-496 was reverted over.
- [x] skipped · module-cohesion · 7 module-split proposals across the import + editor trees — real,
      each is a mechanical move plus an import sweep, none is urgent, and doing seven at once inside a
      review gate would bury the behaviour fixes above. **Still unfiled — Linear free-issue cap
      (retried 2026-08-18);** EX-521 owns the editor half of this arc, so the splits under
      `components/kosztorys/editor/**` belong to it rather than to a new issue.
- [x] dismissed · simplify · `use-kosztorys-view-state.ts` · `divergenceFilterEngaged` was read as
      naming its first caller rather than what it does, with a rename to `revealsColumns` proposed.
      **Superseded 2026-08-18 (EX-713/EX-714):** the generic mechanism landed under exactly that name
      — `revealsColumns` on the registry entry, `columnsRevealedBy` / `revealedColumnIds` in the
      editor — and `divergenceFilterEngaged` turned out not to be an instance of it. `revealsColumns`
      unhides a column past the picker; the „Pozostało do rozliczenia" column is _constructed_ only
      while that diagnostic is pressed, and only on the client plane. The flag means what it says.
- [x] dismissed · comment-noise · `kosztorys-problems-menu.tsx:30` · the „one problem at a time"
      rationale was flagged as duplicated — it is stated once in the menu's own doc comment; the
      neighbouring comment in `use-engaged-conditions.ts` explains a different thing (why the group is
      a parameter), so there is nothing to merge.
- [x] dropped · code-review · `DEFAULT_COEFFS.ownTools` 0.5525 vs the DB column default 0.55 · real
      divergence, no reachable path that reads the column default — every write goes through the
      constant.
- [x] dropped · code-review · no redirect from the old `/podglad-klienta` · bounded to an owner's own
      bookmark; the rename shipped before any client link was ever sent.
- [x] dismissed · code-review · `sheet-coeffs.ts` · `mode()` adopts a cennik mnożnik with no sample
      floor and no tie signal. Filed EX-705, then **ruled away by the owner (2026-08-17) and the issue
      cancelled**: there are in practice no sheets without prace, so the thin-sample case has no way to
      occur, and in 99% of sheets one mnożnik covers everything — a tie needs exactly equal counts,
      while a dominant mnożnik is precisely what „most common wins" already returns. Behaviour unchanged.
- [x] skipped · simplify · `use-condition-row-latch.ts` · folding the caller's `latch.ids.add(row.id)`
      into a hook-owned `retain()` would hand the memo a new closure every render, and the latch
      object's identity IS the documented reset signal — the current null-when-disabled return already
      makes half-honouring untypeable.
- [x] skipped · simplify · `row-conditions.ts` / `stage-conditions.ts` · a factory generating the price
      conditions per plane would turn eight literal ids into template strings; the ids are the one thing
      in this feature that is grepped from four places.
- [x] skipped · simplify · `resolve-rates.ts` · the repeated `RateResolutionT` object literal reads as
      the shape it returns; a builder would hide which branch decides what.
- [x] skipped · simplify · `editable-cell-input.tsx` · making `focus` required would force every
      mouse-only caller to opt out explicitly — the optional prop IS the two supported modes.
- [x] dropped · simplify · `build-import-plan.ts:190` · the twin `parsed.items.map` blocks feeding
      `sheetCoeffs` — every collapse tried came out longer than the two it replaced.
- [x] dropped · simplify · `round6` in `src/lib/utils/` rather than `src/lib/kosztorys/` · its sibling
      `round-to-cents.ts` is equally kosztorys-heavy and lives in utils; moving one of the pair is the
      scatter, not the fix.
- [x] dropped · simplify · `cell-select-menu.tsx` open-state union, the `sheet-import-dialog.tsx`
      ternary pair, the `formatCoeff`/`formatQty` shared body, the `conditionPlane` export narrowing —
      cosmetic, not worth the churn.

## Simplify pass

Ran `/simplify` over the whole `staging`-relative diff — 4 cleanup agents (reuse / simplification /
efficiency / altitude) in parallel, then applied serially: **6 applied, 4 skipped, 5 dropped, 1 left
open**. Every one is folded into `## Findings` above tagged `simplify`; no separate report file.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm test` — 2390 passed / 130 skipped (167 files). The skips are the DB-backed specs, which run
  under `pnpm test:integration` against the 5435 container.
- `pnpm build` — green (generate:importmap + generate:types + next build).
- `pnpm lint` — 3 errors, **all outside this diff and all pre-existing on `staging`**:
  `src/hooks/use-latest-request.ts:15` (React Compiler „Cannot access refs during render", last
  touched by `8e47fb80` on `staging`) and two `no-undef` on the stray root-level `test.js`. Not fixed
  here: neither file is in the branch's diff and the first is a behaviour-adjacent shared hook.
- `pnpm test:e2e` — **not run.** ~1h per run and it is never run unprompted; the browser-level
  obligations for this slice are the manual checks below.

## Archive status

**Archived 2026-08-18.** The two blockers recorded above resolved differently than expected:

1. The three open findings reached terminal states without Linear: one was superseded by the
   `revealsColumns` mechanism shipped in EX-713/EX-714 (dismissed), and two remain deliberately
   skipped with their direction written into this ledger — the workspace is still at its free-issue
   cap, so this file is their record until an issue can be opened.
2. Manual checks stopped being an archive blocker (`0b8898b9`) — `context/foundation/manual-checks.md`
   is a registry of open verification work, not a gate. The fazy 5–7 boxes stay there, unticked.
