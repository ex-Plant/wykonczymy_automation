# Review-gate ledger — marza-prognoza-rzeczywista (EX-649) · 2026-08-18

Scope: the slice's own commits on `filtry-problemy` — `3d3710cf`, `30791066`, `e0d48789`,
`e42befed`, `2601c449`, `959c4b56`, `91e96a89`, `25112ba1` (40 files).

Step 0.5 (browser verification pass) skipped — no `verify-manual-checks` skill installed; the
owner is dogfooding this slice by hand in parallel and `context/foundation/manual-checks.md`
`## EX-649` carries the checklist.

**Linear is at its free-issue limit** (`save_issue` → 400 "exceeded the free issue limit"), so no
finding below could be filed. Findings that would otherwise have been filed are recorded as
`skipped` with their full rationale here instead — this ledger is their only home until the
workspace can take new issues.

## Findings

- [ ] deferred · gate-step-3 · browser-level E2E for the „Marża" tab — the slice adds a persisted
      figure/plane toggle, a null-margin withheld state and two new listing columns, none of which
      any spec exercises through the browser. Owed as an `e2e-backlog` issue; **cannot be filed**
      (Linear free-issue limit), so the box stays open and blocks archive by design.
      test: no automated test yet · e2e — the obligation itself

- [x] skipped · simplify(altitude) · `src/components/kosztorys/summary/allowed-summary-views.ts:22` ·
      the view gate is a **third** parallel enumeration of `SummaryViewT` — after the union +
      `VALID_VIEWS` (`hooks/use-summary-view.ts:8,13`) and the label table `SUMMARY_VIEW_OPTIONS`
      (`summary-panel-content.tsx:39`) — and this slice added it, as an `if (value === …)` ladder
      standing in for a property of the value. A sixth owner-only view added later leaks silently to
      the client share if someone forgets this file; nothing fails loudly. Deeper form: one
      descriptor table `{ value, label, gate? }` next to `SummaryViewT`, with `allowedSummaryViews`
      filtering on `gate`, `viewOptions` reading its labels and `VALID_VIEWS` being its keys.
      Bounded — three files, ~30 lines, no behaviour change. **Not applied**: the descriptor table
      spans three modules across a `'use client'` boundary and would restructure a file this slice
      only lightly touched — a review-worthy refactor rather than a cleanup. The concrete half of the
      finding (drop the unused export, drop the tautological specs) WAS applied, below.
- [x] fixed · simplify(altitude) · `src/hooks/use-draft.ts:19` · the slice extracted this
      render-time-reset primitive but left the one pre-existing instance duplicated:
      `column-order-dialog.tsx:30,54` keeps a hand-copied version because it needs `sameKeys` rather
      than identity. So the repo now has the general mechanism **and** a special case that cannot
      reach it — generalized one notch short of the case that was already there. Deeper form:
      `useDraft<T>(source, isSame = Object.is)`; the two new dialogs are untouched, the dialog passes
      `sameKeys` and deletes its copy. Applied exactly as described; the docblock paragraph that
      named this dialog as the reason it _couldn't_ call in was rewritten.

- [x] fixed · simplify(efficiency) · `src/components/kosztorys/editor/use-kosztorys-editor.ts:341` ·
      `marginForecastByPlane` is folded even where the „Marża" tab can never be reached —
      `allowedSummaryViews` returns `margin: false` under `preview` and for a withheld
      `financials`/`subcontractorDue`, so every client-share and MANAGER render pays 2–4 full row
      folds for a value nobody can display. Every other whole-row fold in this file already
      short-circuits on `preview`. Fix: return `undefined` when `preview` — the prop is already
      optional and the tab already handles its absence.
- [x] fixed · simplify(efficiency) · `src/components/investments/investment-summary-panel.tsx:65` ·
      `subcontractorDueByPlane` runs unconditionally and the result is then discarded for a MANAGER
      one line later by the `canSeeMargin` gate this gate added — so a reader without margin access
      still pays a stages×rows fold (~10k `viewPrice` calls on a 1000-row kosztorys) per render.
      Fix: move the gate above the fold rather than around its result.
- [x] fixed · simplify(efficiency) · `src/components/investments/investment-summary-panel.tsx:65` ·
      this host serializes the whole `SubcontractorDueByPlaneT` — `byStage` and `byWorker` maps
      included — into the flight payload, but `INVESTMENT_PANEL_VIEWS` omits `'subcontractors'` and
      the panel reads only `.combined` / `.hasUnconfirmedPlane`. Fix: pass the two scalars, i.e. the
      `SubcontractorSettlementT` shape the tab already takes; the full object stays with the editor
      host that needs the maps.
- [x] fixed · simplify(efficiency) · `src/lib/kosztorys/margin-forecast.ts:28` ·
      `clientNet` is folded twice because the two-plane memo calls `marginForecast` once per plane,
      while the client half is plane-invariant by construction (the doc comment says so). On a
      1000-row kosztorys that is 4 per-row price passes and 2 traversals where 3 and 1 would do,
      re-run on every cell edit. Fix: one traversal accumulating `clientNet`, `wToolsNet` and
      `ownToolsNet` together.
- [x] skipped · simplify(efficiency) · `src/lib/queries/balances.ts:115` ·
      `selectKosztorysSubcontractorDue` is a **second full scan** of the same three tables
      `selectKosztorysClientTotals` already scans — same joins, same `GROUP BY investment_id`, same
      tag set, same consumer — so the listing now pays two Neon round-trips and two folds over the
      same rows on every cache miss, i.e. after every debounced editor autosave.
      `kosztorys-client-totals.ts`'s own comment argues round-trip count is the Neon cost driver, and
      this slice doubles it. The fix (one CTE emitting both figure sets behind a single
      `unstable_cache` entry) is a review-worthy refactor of a cached hot path that both the golden
      master and the parity spec sit on — deliberately not folded into this slice's gate. **Would
      have been filed**; Linear is at its free-issue limit.

- [x] fixed · simplify · `src/types/table-rows.ts` + `src/components/tables/investments.tsx:73` ·
      the withheld margin is spelled `null` in the row type and `undefined` in the column, and the
      slice pays an accessor lambda plus a three-line comment to translate between them — while the
      project's own TS rule already picks `undefined`. Fix: `marginV2?: number` on the row type,
      `?? undefined` once in `shape-investments.ts`, column back to `col.accessor('marginV2', …)`.
      `marginV2()` keeps returning `null`, so its contract is untouched.
- [x] fixed · simplify · `summary-margin-tab.tsx:120` · one 126-line ternary holds two tables
      that share nothing but the wrapper `<div>`. Fix: two local components in the same file
      (`ForecastTable` / `ActualMarginTable`), each constant block sitting next to the only branch
      that reads it. Applied as two sibling files (`tabs/margin-forecast-table.tsx`,
      `tabs/margin-actual-table.tsx`) rather than local components — the repo's one-component-per-file
      rule — plus `tabs/margin-table-cols.ts` for the one constant both share. The tab is now 68
      lines and holds only the toggle and the branch.
- [x] fixed · simplify · `summary-margin-tab.tsx:34,61,63` · three shapes for module-scope copy in
      one file: `HINTS` is a 2-key map read once per key, while `OVERPAID_LABEL`/`WITHHELD_LABEL` are
      one-word literals hoisted for a single use each. Fix: inline the two labels, flatten `HINTS`
      into flat consts like the file's other five. The multi-sentence descriptions keep their hoist.
- [x] fixed · simplify · `summary-panel-content.tsx:280` + `blocks/subcontractor-summary.tsx:35` ·
      `showBreakdown` is a prop no caller varies — the only call site passes `showTransactionLists`
      to both it and `showTransactions`, and the comment beside it concedes they are one signal. Fix:
      delete the prop, let its two uses read `showTransactions`.
- [x] fixed · simplify · `summary-panel-content.tsx:200` · `isSubcontractorView` is bound once and
      read 68 lines later, feeding a single condition. Fix: inline it.
- [x] fixed · simplify · `hooks/use-margin-reading.ts:17` vs `summary-margin-tab.tsx:29` ·
      `MarginFigureT`'s members are listed twice (`FIGURES` and `FIGURE_OPTIONS`); a third reading
      means editing both with nothing forcing it. Fix: own `FIGURE_OPTIONS` in the hook file and
      derive `FIGURES` from it.
- [x] fixed · simplify · `allowed-summary-views.ts:1` · the exported `ViewDisclosureT` is
      referenced nowhere but its own signature, and two of its five specs assert
      `Array.prototype.filter`'s contract rather than this rule. Fix: inline the param type, drop the
      export, keep the three specs that pin an actual rule. Applied; the descriptor-table half was
      skipped above, so this stands on its own.
- [x] fixed · simplify · `src/__tests__/financial-golden-master-db.test.ts:225` · two
      `new Map<number, Awaited<ReturnType<typeof …>>[number]>()` declarations plus imperative
      `for … .set()` loops, where the row types are already exported. Fix: build each Map from
      `rows.map((row) => [row.investmentId, row])` — two lines, fully inferred.
- [x] fixed · simplify · `src/__tests__/lib/kosztorys/margin-forecast.test.ts:57` · the rabat trio
      re-asserts one level up exactly what this same diff pinned at the source in
      `kosztorys-calc.test.ts:203`. Fix: keep one case as an integration smoke, delete the other two.
- [x] fixed · simplify · `src/__tests__/lib/kosztorys/margin-v2.test.ts:40` · two specs exercise
      the single `if (hasUnconfirmedPlane) return null` guard, which cannot read `due` at all. Fix:
      one spec, or `it.each([600, 0])` if „the amount is irrelevant" is worth stating.
- [x] fixed · simplify(reuse) · whole diff · the reuse agent died on an API session limit
      (`resets 1:20pm`) and was re-dispatched; it completed. Its findings are the four below.
- [x] fixed · simplify(reuse) · `src/lib/kosztorys/subcontractor-due.ts` · the zero-settlement
      literal `{ due: 0, hasUnconfirmedPlane: false }` was retyped at three call sites and the
      `SubcontractorDueByPlaneT` → `SubcontractorSettlementT` narrowing at three more. Both are now
      exports — `NOTHING_DUE` and `toSettlement(byPlane)` — and every call site routes through them
      (`shape-investments.ts`, `summary-panel-content.tsx`, `investment-render-parity-db.test.ts`,
      `financial-golden-master-db.test.ts`). A future field on `SubcontractorSettlementT` can no
      longer be missed by one copy.
- [x] fixed · simplify(reuse) · `src/lib/queries/balances.ts:91,115` · the two kosztorys folds were
      the same query→fold→log block twice, down to the `String(investmentId)` keying. Extracted
      `cachedInvestmentMap(cacheKey, label, select, tags)`; both now read as four arguments. A third
      per-investment aggregate gets the shape for free.
- [x] dismissed · simplify(reuse) · `src/__tests__/investment-render-parity-db.test.ts:107` · a third
      copy of that same fold lives in the parity spec. Left alone deliberately: routing it through
      `fetchKosztorysClientTotals` would put `unstable_cache` inside a spec whose whole job is to read
      the DB fresh and compare two render paths — it could then pass against a stale entry.
- [x] dropped · simplify(reuse) · `summary-margin-tab.tsx` „Rozliczenie z ekipą" · a third rendering
      of należne / zaliczki / pozostało, and a third vocabulary for the overpaid case („Nadpłata"
      here vs „nadpłacone" and „Wypłacono więcej niż wykonano" elsewhere). The `RemainingCell` lift
      would be a UI restructure, and the shorter label is a deliberate reading in a narrow column —
      not worth the churn. The vocabulary overlap is raised for the owner in the close-out instead.

- [x] 🔴 CRITICAL · fixed · impl-review · `src/__tests__/investment-render-parity-db.test.ts:147` ·
      the parity spec was RED on ~50 investments: `25112ba1` moved the listing's marża to the
      transactions plane while the spec's right-hand side stayed on the rebased object. Fixed by
      splitting the two planes in the spec — `transactionFin` (raw `deriveFinancials`, exactly what
      `inwestycje/[id]/page.tsx` feeds v1) vs `detailFin` (rebased through `readingFromKosztorys`) —
      and adding compare rows for `bilans v1`, `marża v1`, `robocizna v1`.
      test: test-driven-debugging · integration — the spec IS the guard; it now compares each column
      against its own plane, which is what let a 235 908,25 zł drift stay green.
- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/db/kosztorys-subcontractor-due.ts` ·
      `stage_progress` carries no investment column, so the fold joined items by id alone: a row
      pairing an etap and an item from two different investments would be priced into one of them at
      the other's coefficients. Scoped the join explicitly with
      `ki.investment_id = ks.investment_id`.
      test: no automated test · integration — the malformed row cannot be produced through the app
      (progress rows are always written against the investment's own tree), so the fixture would
      have to fabricate an impossible row via raw SQL. The fix is a defensive scope, not a repro of
      an observed defect.
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/summary/tabs/summary-margin-tab.tsx:103` ·
      float residue flipped a sign branch: `due` folds through fractional plane coefficients while
      `totalPayouts` is a raw Postgres SUM, so a crew paid exactly what it is owed — the commonest
      case — landed ~1e-13 negative and rendered red as „Nadpłata 0,00". Wrapped in `roundToCents`
      before the sign is read.
      test: no automated test · unit — the component has no test harness in this repo (React-free
      logic lives in `lib/`, which is why `renderHook` was never needed); covered by manual check
      EX-649/„ekipa wypłacona co do grosza" and by the deferred E2E above.
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/summary/tabs/summary-margin-tab.tsx:212` ·
      the „Rozliczenie z ekipą" block rendered even when `hasUnconfirmedPlane` withheld the margin
      above it. With an etap holding executed work and no rozliczenie, `due` is short by an unknown
      amount, so the block named an overpayment that does not exist. Gated on the same condition as
      the margin.
      test: no automated test · e2e — same reason as above; folded into the deferred E2E.
- [x] 🟡 WARNING · fixed · code-review · `src/components/tables/investments.tsx` · `marginV2`
      returns `null` for a withheld margin, and TanStack's `sortUndefined` handles `undefined` only —
      `null` fell through the numeric comparator and sorted as 0, scattering withheld rows among the
      genuine near-zero margins, i.e. exactly the reading the `null` exists to prevent. Accessor now
      maps `null → undefined` with `sortUndefined: 'last'`; the cell tests `=== undefined`.
      test: no automated test · e2e — table-level sorting behaviour; folded into the deferred E2E.
- [x] 🟡 WARNING · fixed · code-review · `src/components/tables/investments.tsx` · the „Różnica"
      column subtracted two independent float folds, so a fully migrated investment landed a
      sub-grosz apart rather than exactly equal and the „no drift" dash never appeared. Wrapped in
      `roundToCents`.
      test: no automated test · unit — same harness gap; manual check EX-649/„Różnica pokazuje
      myślnik".
- [x] 🟡 WARNING · fixed · code-review · `src/components/investments/investment-summary-panel.tsx` ·
      `subcontractorDue` reached the RSC payload for a MANAGER even though the panel hides it. The
      crew's per-plane cost is company-plane money, so it is now gated exactly like `financials` —
      off the wire, not merely off the screen.
      test: no automated test · integration — no role-scoped RSC-payload spec exists at this layer;
      the gate mirrors the adjacent `canSeeMargin` guard it was verified against.
- [x] 🟡 WARNING · skipped · code-review · `src/components/tables/investments.tsx` · the new
      Robocizna v1 / Robocizna v2 / Różnica columns sit **outside** the `isAdminOrOwner` gate that
      Marża and Wypłaty sit behind, so a MANAGER sees them. Deliberately **not** auto-applied: this
      changes what a user MAY see, and such a finding is surfaced for the owner's call rather than
      silently flipped. Raised in the close-out.
      test: no automated test · integration — owed with the decision, not before it.
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/tables/investment-data-table.tsx:56` ·
      "column visibility is not persisted" — false positive. `data-table.tsx` reads and writes it
      through `readVisibility`/`writeVisibility` keyed by `storageKey`, and this table passes
      `storageKey="investments"`.
- [x] 🟡 WARNING · fixed · impl-review · `AGENTS.md` · the „`LABOR_COST` and `RABAT` are no longer
      bookable (EX-555)" rule was left standing while the slice re-added both types to the transfer
      dialog — i.e. the rule file stated the opposite of the code. Rewritten as "bookable again,
      temporarily (EX-649, reversing EX-555 — EX-712 closes it)" with the rationale and the exit
      condition; `context/foundation/investment-financials-and-discount.md` corrected the same way,
      adding that v2 is structurally immune because `readingFromKosztorys` **replaces** rather than
      adds.
- [x] 🟡 WARNING · fixed · impl-review · `context/changes/…/change.md` · plan deviation unrecorded —
      the EX-555 reversal was not in the plan. Now recorded under „Odstępstwa od planu" with its
      EX-712 exit condition.
- [x] 🟡 WARNING · fixed · impl-review · `context/changes/…/change.md` · plan deviation unrecorded —
      the „Rozliczenie z ekipą" block overturns plan decision 5 (wypłaty were to stay off this
      screen). Recorded, with the note that decision 5 still holds for the **formula**: wypłaty are
      still not a cost of the margin.
- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/manual-checks.md` · the `## EX-649`
      section was written three commits before the shipped UI and described a plane **toggle** that
      is now a „Bez narzędzi" **checkbox**, with none of the listing columns. Replaced with 22
      checks covering the checkbox, the v1/v2 column names, Robocizna/Różnica, the withheld crew
      block, the exactly-paid crew, the `sortUndefined` ordering, the dash-not-0,00 case and the
      restored dialog types.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/constants/transfers.ts` · re-adding the two types
      broke the array's own stated „sorted by Polish label" invariant. Reordered
      (`Korekta` < `Koszty robocizny`) and `src/__tests__/transfer-constants.test.ts` updated to
      match — 308 tests green.
      test: TDD · unit — the existing ordering spec is the guard; it was updated, not weakened.
- [x] 🟡 WARNING · fixed · impl-review · `summary-margin-tab.tsx:40` · `FORECAST_DESCRIPTION` was
      missing the consequence the plan requires it to state — that where materiał is priced into the
      client's rate, przedmiar carries its revenue but none of its cost, so the forecast is a margin
      _before_ material and sits structurally above the actual one even at full execution. Added.

- [x] fixed · module-cohesion · `src/lib/kosztorys/subcontractor-due.ts` · `SubcontractorSettlementT`
      was declared in a consumer (`summary-margin-tab.tsx`) rather than at its producer. Moved with
      its docblock; four import sites repointed (`summary-margin-tab`, `queries/balances`,
      `queries/shape-investments`, `db/kosztorys-subcontractor-due`).
- [x] fixed · code-review · `src/lib/kosztorys/margin-v2.ts` · `marginV2(f, …)` single-letter
      parameter renamed to `financials`, body expanded; the restating JSDoc lead sentence trimmed.
- [x] fixed · comment-noise · `summary-margin-tab.tsx` · four commented-out `HINTS` entries deleted.
- [x] fixed · comment-noise · `summary-margin-tab.tsx` · the „two descriptions" meta comment and the
      duplicated `subcontractor` prop comment deleted — both restated the code beneath them.
- [x] fixed · copy · `summary-margin-tab.tsx:49` · „i strata." → „i stratę." (wrong case).
- [x] skipped · structure-scatter · `src/components/kosztorys/summary/` · the directory root has
      become a junk drawer — panel shell, tab content, blocks, tables, grid primitives and hooks all
      sit beside coherent subfolders that some of them belong in. Review-worthy refactor of a
      directory this slice only added to; **would have been filed** but Linear is at its free-issue
      limit.
- [x] skipped · module-cohesion · `src/components/kosztorys/summary/summary-panel-content.tsx` ·
      `show*` flag sprawl — two hosts (editor / investment page) render different subsets of one
      component. Should collapse into two compositions or one explicit variant prop. Same reason as
      above.
- [x] skipped · module-cohesion · `summary-margin-tab.tsx` · the forecast and actual branches share
      only the toggle above them — different tables, descriptions and inputs. Worth splitting into
      two components with the tab as the switch. Same reason as above.
- [x] dropped · feature-first · `src/components/kosztorys/summary/hooks/use-margin-reading.ts` · two
      hooks in one file. They are one concern (the tab's persisted reading state) and share the key
      family and its rationale comment; splitting would duplicate that comment for no gain.
- [x] dismissed · feature-first · `src/components/kosztorys/summary/allowed-summary-views.ts` ·
      "imports a type from a `'use client'` module". Type-only, erased at compile — no client
      boundary is crossed at runtime.
- [x] dismissed · tailwind-v4-audit · slice diff · no pre-v4 patterns found; the new markup uses
      tokens and scale utilities throughout.

## Simplify pass

Ran `/simplify` (4 angles; the reuse agent died on a session limit and was re-dispatched to
completion) — 18 applied, 3 skipped, 1 dismissed, 1 dropped; each finding folded into `## Findings`
above (tagged `simplify`). No separate report file: this ledger is the report.

## Tests & suite

- `pnpm typecheck` — green.
- `pnpm lint` — 2 errors, both pre-existing in files this slice never touched
  (`src/hooks/use-latest-request.ts:15` refs-during-render, `test.js:240` `no-undef`); 81 warnings,
  none in the diff.
- `pnpm test` — **171 passed / 39 skipped, 2446 tests green.** Three specs were red first and were
  fixed as stale-spec findings (below), not weakened.
- `pnpm test:parity` — **green.** This is the leg that matters: the parity guard was RED at the start
  of the gate (~50 investments drifting, up to 235 908,25 zł) and the plane-split fix is now verified
  end-to-end against `db-test`, including the 1000-item perf dataset on inv 7.
- `pnpm build` — green.
- `pnpm test:e2e` — **not run** (standing instruction: never unprompted; ~1h). The slice's browser
  obligation is the open `[ ]` box at the top.

### Stale specs the suite caught

- [x] fixed · suite · `src/__tests__/transfer-rabat.test.ts:26` · „is no longer offered by the
      transaction transfer dialog" asserted the EX-555 state this slice deliberately reverses.
      Rewritten to assert the reversal, carrying the reason and the EX-712 exit condition.
      test: TDD · unit — the spec IS the guard; it was inverted to match the decision, not deleted.
- [x] fixed · suite · `src/__tests__/components/forms/expense-form/draft-type-coercion.test.ts:10` ·
      the coercion case used `LABOR_COST`/`RABAT` as its examples of a type the dialog no longer
      offers — both are offered again. Retargeted at `INVESTOR_DEPOSIT`/`CANCELLATION`, which this
      dialog has never booked, so the rule is still pinned.
      test: TDD · unit — same spec, real examples.
- [x] fixed · suite · `src/__tests__/lib/queries/shape-investments.test.ts:421` · asserted
      `marginV2` `toBeNull()` on the listing row, which the simplify pass changed to `undefined` so
      TanStack's `sortUndefined` can see it. Now `toBeUndefined()` with the reason inline.
      test: TDD · unit — the guard follows the type it guards.

## Close-out (2026-08-18)

**39 fixed · 6 skipped · 4 dismissed · 2 dropped · 1 deferred — 1 open box.**

The slice ends **in review**, not archived. Two things hold the archive:

1. The open `[ ]` E2E box. It cannot be filed (Linear free-issue limit), so it stays open by design.
2. `context/foundation/manual-checks.md` `## EX-649` — 22 checks, all unticked. The owner is
   dogfooding them.

Tracker: EX-649 carries the `in review` label; team Ex-plant has no `In Review` state, so status
stays `In Progress`. `change.md` → `implemented`.

### For the owner — two calls the gate did not make for you

- **Robocizna v1 / Robocizna v2 are visible to a MANAGER.** Marża and Wypłaty sit behind
  `isAdminOrOwner`; these two do not. That changes what a user may see, so it is surfaced rather
  than silently flipped. Say the word and they move behind the same gate.
- **„Rozliczenie z ekipą" calls an overpayment „Nadpłata"**, while the „Podwykonawcy" tab says
  „nadpłacone" and the listing says „Wypłacono więcej niż wykonano". Three words for one state. The
  short one was chosen because the column is narrow; worth deciding whether the app should settle on
  one.

### Post-gate change (owner request, 2026-08-18)

The „Różnica" column was **removed** from the listing — the header explained nothing on its own.
The rozjazd now rides on the „Robocizna v2" cell as a `LabelHintIcon variant="mismatch"`, shown only
when it is non-zero, with the kwota in the tooltip. The findings above that name the column stay as
written: they record what the gate caught at the time.
