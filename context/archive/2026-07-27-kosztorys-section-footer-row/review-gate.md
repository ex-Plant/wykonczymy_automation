# Review-gate ledger — kosztorys-section-footer-row · 2026-07-27

Slice commits: `addaabb5`, `1540972e`, `0cb5dfa0`, `7ba569f6`, `8223119e`, `044745bd`
(the branch also carries parallel agents' commits — the review is scoped to these six).

Fan-out: `10x-impl-review`, `code-review`, `tailwind-v4-audit`, `comment-noise-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`.

## Findings

<!-- [box] · [severity, bug-finding checks only] · disposition · source · file:line · what — why -->

- [x] 🟡 WARNING · deferred + filed **EX-611** · code-review · `e2e/kosztorys-section-headers.spec.ts:38` · `itemOrdinals()`
      reads `.dsg-cell-gutter` text, but the gutter has rendered empty since `150439e5` replaced it with
      `SECTION_RAIL_GUTTER` — so the collapse spec's ordinal assertions can never pass, and
      `buildSectionBandRows`' `ordinalByRowId` return has no production consumer at all. Pre-existing,
      and deciding whether row ordinals are still a feature is a product call, not a review fix.
      test: no automated test — the deferral IS the missing-coverage finding; box checks on filing.

- [x] 🟡 WARNING · deferred + filed **EX-610** · code-review · `e2e/kosztorys-section-headers.spec.ts:58`
      · the slice deleted the one browser-level assertion that a band renders a section's money
      (`toContainText(formatNet(section.net))`) and replaced it with nothing — no spec at any layer
      asserts a footer figure lands under the _right column_, which is the whole point of the slice.
      Unit specs can't see column identity. EX-610 already owns the browser-level column-alignment
      claim; its description now names this specific lost assertion.
      test: e2e — the risk is column identity, only reachable in a browser; carried in EX-610.

- [x] dropped · code-review · `src/components/.../section-footer-cell.tsx:14` · hiding the „Opis" column
      strips the footer of its caption, leaving an anonymous strip of numbers. Real, but the header band
      already loses its name _and_ its collapse chevron the same way — a pre-existing degradation of the
      whole band pair, not something this slice introduced or should fix in isolation.

- [x] dismissed · code-review + structure-scatter · `kosztorys-editor-body.tsx:203` · the footer renders
      at `ITEM_ROW_HEIGHT` (32) while the header gets `SECTION_BAND_ROW_HEIGHT` (52). Deliberate: the
      footer is a row of figures under their columns, not a band of chrome — matching heights would put
      52px of empty wash under every section. The CSS comment that made this read as an oversight was
      the actual defect, and was reworded in this gate.

- [x] dismissed · feature-first · `section-footer-cell.tsx` vs `section-header-cell.tsx` · the siblings
      disagree on contract shape (the header takes a precomputed `slot`, the footer takes the raw
      `columnId`). Not an inconsistency to unify: the header has two states and can be reduced to an
      enum, the footer maps every column id to its own figure and genuinely needs the id.

- [x] dropped · tailwind-v4-audit · repo has no Tailwind-aware ESLint plugin, so unregistered classes and
      non-canonical `var()` syntax are editor-only and invisible to CI. Real and repo-wide, but wiring a
      lint plugin is its own change with its own churn — not this slice's, and not worth a ticket the
      author didn't ask for.

- [x] dismissed · reuse-scan · `kosztorys-editor-body.tsx:110` · flagged as re-deriving
      sectionId→itemCount that `sectionItemCounts` (`delete-policy.ts:20`) already returns. Not a
      duplication: `subtotals` has already computed `itemCount`, so the body is projecting an existing
      field, not recomputing it — swapping in `sectionItemCounts` would ADD a pass over `rows`.

- [x] dropped · reuse-scan · `section-footer-cell.tsx:36` vs `kosztorys-synthetic-rows.tsx:31` · the
      band figure cell and the „Razem" cell share a class string bar bg/border/text-size; extraction
      saves ~3 lines. Same for the `<div className="size-full" />` blank cell written twice.

- [x] dropped · reuse-scan · `constants.ts` · `IDENTITY_COLUMN_ID` sits in `constants.ts` while the
      other column-id constants live in `column-config.ts`. Cycle-safe to move, but `constants.ts` is
      where cross-module single-sources already live and the move buys nothing.

- [x] dismissed · reuse-scan · `section-footer-cell.tsx` · money routes through the existing
      `formatNet`, and the caption `<div>` can't reuse `ReadOnlyCellText` (width-only by design; a band
      cell needs `size-full`). No hand-rolled primitive introduced.

- [x] 🔵 OBSERVATION · deferred + filed **EX-612** · reuse-scan · `src/lib/kosztorys/column-totals.ts:75` · the per-stage
      loop runs `rows.reduce(...)` inside it, making the etap-qty axis O(stages × rows) while the rest
      of the function is one pass — and `stageTotalsForView` on the line above already walks the same
      rows. Compounds with the per-section call. Not fixed here: the honest fix folds the qty sum into
      `stageTotalsForView`'s existing walk, which is a shape change to a shared settlement primitive —
      review-worthy on its own, and speculative until the `INV=7` measurement below says it matters.
      test: no automated test — a perf shape change; the manual `INV=7` check is the signal.

## Simplify pass

Ran the mutating pass directly against the triage (rather than a second `/simplify` sweep, which would
have re-derived the same list the seven-agent fan-out already produced) plus `primitive-reuse-scan` —
**25 findings: 14 fixed, 3 filed (EX-610 / EX-611 / EX-612), 4 dropped, 4 dismissed — 0 open.**
Every one is a checkbox in `## Findings` above.

## Tests & suite

No new specs owed at Step 3: the two behaviour claims this gate surfaced (the rabat-globalny basis, the
three-block band degradation) were authored during the mutating pass, and the remaining gap is
browser-level column identity, which unit specs cannot see — filed as **EX-610**.

- `pnpm test` — **1815 passed, 62 skipped (131 files)**. Green.
- `pnpm lint` — 0 errors, 85 warnings, all pre-existing (`db` unused in migration `down()` stubs).
- `pnpm typecheck` — **fails, and not on this slice**: two TS7053s in
  `src/lib/kosztorys/subcontractor-price-edit.ts:39-40`, from the **parallel EX-609 agent's uncommitted
  work** (`subcontractor-columns.tsx` + its spec are dirty in the shared tree and widen the row generic
  passed into `ViewPricingT`). Typecheck was clean on this slice's files immediately after the mutating
  pass; none of the 16 files this gate touched appear in the errors. Not fixed here — never mutate a
  parallel session's in-flight files. **Re-checked at archive (2026-08-10): both errors are gone** —
  EX-609 shipped and its files are committed, and no error touches this slice.
- `pnpm test:e2e` — not run: the browser claim for this slice is deferred to **EX-610** (`e2e-backlog`),
  so there is nothing new for the suite to prove and the 5435 container start buys no signal.
- `pnpm build` — not run (no build-surface change; typecheck is blocked by the above regardless).
