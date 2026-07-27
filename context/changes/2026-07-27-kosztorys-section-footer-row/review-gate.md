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

- [x] 🟡 WARNING · fixed · impl-review + code-review + feature-first + module-cohesion ·
      `src/components/kosztorys/editor/use-kosztorys-editor.ts:398,407,435` · `stageQtyTotals`,
      `plannedQtyTotal` and `remainingTotals` went dead when `columnTotalsForRows` absorbed them, but
      were still computed every render and still returned — a second implementation of „Pozostało" and
      the etap axis, free to drift from the live one. All four reviewers flagged it. Deleted; gated on
      typecheck, not grep.
      test: no automated test — dead-code removal, the existing specs already pin the surviving
      definition and typecheck proves nothing read the deleted ones.

- [x] 🟡 WARNING · fixed · impl-review · `plan.md:83,209,412` · the plan was never revised after the
      owner widened "only the columns we can total" to "everything computable": `## What We're NOT
    Doing` still claims `remaining` / `plannedQty` / `stageQtySum` / the etap axis render blank, the
      Phase-1 §5 contract table still specifies a six-column `sectionFooter` memo in the body, and the
      three post-epilogue commits carry no Progress entry.

- [x] 🟡 WARNING · deferred + filed **EX-610** · code-review · `e2e/kosztorys-section-headers.spec.ts:58`
      · the slice deleted the one browser-level assertion that a band renders a section's money
      (`toContainText(formatNet(section.net))`) and replaced it with nothing — no spec at any layer
      asserts a footer figure lands under the _right column_, which is the whole point of the slice.
      Unit specs can't see column identity. EX-610 already owns the browser-level column-alignment
      claim; its description now names this specific lost assertion.
      test: e2e — the risk is column identity, only reachable in a browser; carried in EX-610.

- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/settlement.ts:404` · inside one function
      `remainingGross` accumulated `toGross(rowRemaining, row.vatRate)` per row while the other five
      gross figures grossed off the flat `vatRate` parameter. Identical today (`treeToRows` stamps
      `tree.vatRate` on every row), but the two would diverge the moment a per-row rate landed and the
      footer's own columns would stop reconciling with each other. Unified on the parameter.
      test: no automated test — provably identical arithmetic today; the existing Σ-check spec covers
      the column, and a spec for a divergence that cannot occur would assert the implementation.

- [x] 🔵 OBSERVATION · fixed · impl-review + comment-noise + module-cohesion ·
      `src/lib/kosztorys/settlement.ts:357` · `columnTotalsForRows` was inserted between
      `emptySectionIds`' JSDoc and `emptySectionIds` itself, so a correct comment documented the wrong
      function in every IDE hover. Subsumed by the extraction below.

- [x] 🔵 OBSERVATION · fixed · module-cohesion · `src/lib/kosztorys/settlement.ts:375` ·
      `columnTotalsForRows` keys its result by the _grid's_ column ids and grosses per column, giving
      `settlement.ts` a second reason to change (a column rename) on top of its first (settlement
      math) — and pushing it past 400 LOC in this slice. Extracted to
      `src/lib/kosztorys/column-totals.ts`, beside `column-config.ts` where that vocabulary already
      lives. (`feature-first-structure` judged `settlement.ts` acceptable; the cohesion argument is
      the stronger one and the move is mechanical.)

- [x] 🔵 OBSERVATION · fixed · structure-scatter + module-cohesion ·
      `src/lib/kosztorys/section-header-rows.ts` · the module emits _both_ bands now — half its logic is
      `closeOpenSection` / `footered` — but its name and its export still say "header", so the next
      band-kind change has no signal pointing here and plausibly starts a second home. Renamed to
      `section-band-rows.ts` / `buildSectionBandRows` (two call sites + its spec).

- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/.../cells/section-footer-cell.tsx:14` ·
      `CAPTION_COLUMN_ID = 'description'` was a third copy of the same literal (`LABEL_COLUMN_ID` in
      `kosztorys-synthetic-rows.tsx`, and again in `sectionHeaderSlot`). Hoisted to one exported
      constant, `IDENTITY_COLUMN_ID` in `constants.ts`.

- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/lib/kosztorys/column-totals.test.ts` ·
      under a rabat globalny the footers sum to a „Razem" visibly larger than the panel's do-zapłaty
      figure. Unchanged behaviour, but the slice repeats that basis in N+1 places instead of 1 and
      nothing recorded it as intended. Writing the spec corrected my own reading of the rule: the
      global rabat does not merely go unsubtracted here — it also SUPPRESSES each row's own rabat
      (`calc.ts:49` `globalDiscountActive`), so these columns show the executed value with neither
      applied. The spec now pins that, and the first draft of it failed red against my wrong premise.
      test: TDD · unit — the basis is pure math on the tree; a spec is the cheapest place to state it.

- [x] 🔵 OBSERVATION · fixed · code-review + impl-review · `src/lib/kosztorys/section-band-rows.ts:52` ·
      the `footered` guard means a section arriving in three or more blocks emits its band pair for the
      first block only; the 2-block case was pinned, the 3-block case was not. Spec extended.
      test: TDD · unit — bounded degradation, cheapest to document as a spec rather than prose.

- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/.../cells/section-header-cell.tsx:8` ·
      `SectionHeaderFigureT` survived Phase 2 as a single-field wrapper around one integer — a type, an
      import and a memo shape for `{ itemCount }`. `plan.md:294` offered the plain-count-map
      alternative; collapsed to `Map<number, number>`.

- [x] 🔵 OBSERVATION · fixed · tailwind-v4-audit · `src/styles/globals.css:397,405` · the footer's top
      rule hardcodes `1px` next to a tokenised twin (`--section-divider-width: 2px`), so retuning the
      section chrome means editing one token and two literals. Added `--section-footer-divider-width`.

- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/.../use-kosztorys-editor.ts:411` ·
      `sectionColumnTotals` re-runs `stageTotalsForView` + a per-stage `rows.reduce` once per section,
      roughly doubling the per-edit totals work the plan predicted. Likely fine at ~1000 items, but
      unmeasured since the widening. Added as a manual check against the `INV=7` perf dataset rather
      than a speculative optimisation.

- [x] fixed · comment-noise · 3 delete + 6 trim across the slice's new comments — the dominant pattern
      being `columnTotalsForRows`' Σ-by-construction rationale re-narrated at all three call sites, plus
      one vanished-state comment (`section-header-cell.tsx:23`, "the money moved to the closing footer
      band") and one misworded CSS comment ("only the rule above it is thinner" reads as the
      neighbouring CSS rule, means this band's own top border).

- [x] dropped · code-review · `src/components/.../section-footer-cell.tsx:14` · hiding the „Opis" column
      strips the footer of its caption, leaving an anonymous strip of numbers. Real, but the header band
      already loses its name _and_ its collapse chevron the same way — a pre-existing degradation of the
      whole band pair, not something this slice introduced or should fix in isolation.

- [x] dismissed · code-review + structure-scatter · `kosztorys-editor-body.tsx:203` · the footer renders
      at `ITEM_ROW_HEIGHT` (32) while the header gets `SECTION_BAND_ROW_HEIGHT` (52). Deliberate: the
      footer is a row of figures under their columns, not a band of chrome — matching heights would put
      52px of empty wash under every section. The CSS comment that made this read as an oversight was
      the actual defect, and is fixed above.

- [x] dismissed · feature-first · `section-footer-cell.tsx` vs `section-header-cell.tsx` · the siblings
      disagree on contract shape (the header takes a precomputed `slot`, the footer takes the raw
      `columnId`). Not an inconsistency to unify: the header has two states and can be reduced to an
      enum, the footer maps every column id to its own figure and genuinely needs the id.

- [x] dropped · tailwind-v4-audit · repo has no Tailwind-aware ESLint plugin, so unregistered classes and
      non-canonical `var()` syntax are editor-only and invisible to CI. Real and repo-wide, but wiring a
      lint plugin is its own change with its own churn — not this slice's, and not worth a ticket the
      author didn't ask for.

- [x] fixed · reuse-scan · `use-kosztorys-editor.ts:401` · `sectionColumnTotals` hand-rolled a
      bucket-push group-by that already exists as `groupBySection` (`row-ops.ts:159`, module-private).
      Exported it and reused it — the repo's convention is domain-specific groupers, so no generic
      `groupBy` was introduced.

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
  parallel session's in-flight files.
- `pnpm test:e2e` — not run: the browser claim for this slice is deferred to **EX-610** (`e2e-backlog`),
  so there is nothing new for the suite to prove and the 5435 container start buys no signal.
- `pnpm build` — not run (no build-surface change; typecheck is blocked by the above regardless).
