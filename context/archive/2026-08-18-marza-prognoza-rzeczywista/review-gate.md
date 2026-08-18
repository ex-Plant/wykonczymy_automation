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

- [x] dismissed · simplify(reuse) · `src/__tests__/investment-render-parity-db.test.ts:107` · a third
      copy of that same fold lives in the parity spec. Left alone deliberately: routing it through
      `fetchKosztorysClientTotals` would put `unstable_cache` inside a spec whose whole job is to read
      the DB fresh and compare two render paths — it could then pass against a stale entry.
- [x] dropped · simplify(reuse) · `summary-margin-tab.tsx` „Rozliczenie z ekipą" · a third rendering
      of należne / zaliczki / pozostało, and a third vocabulary for the overpaid case („Nadpłata"
      here vs „nadpłacone" and „Wypłacono więcej niż wykonano" elsewhere). The `RemainingCell` lift
      would be a UI restructure, and the shorter label is a deliberate reading in a narrow column —
      not worth the churn. The vocabulary overlap is raised for the owner in the close-out instead.

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
