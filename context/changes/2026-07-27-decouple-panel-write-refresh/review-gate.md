# Review-gate ledger — 2026-07-27-decouple-panel-write-refresh (EX-597) · 2026-07-27

**Scope:** commits `dd148c15~1..HEAD` (27 commits, 47 src files, +1098/−744) + 3 uncommitted test
files (`src/__tests__/lib/db/kosztorys-tree-sql-drift.test.ts`,
`src/__tests__/lib/db/kosztorys-tree.db.test.ts`, `src/__tests__/lib/cache/revalidate.test.ts`).

Branch-vs-`main` is 665 files — the branch was cut from a long-lived dogfooding line, so the branch
diff is not the slice.

**Checks that dropped out:** `/10x-impl-review` (no `plan.md` — this change ran as a spike throughout,
`/10x-plan` was never invoked). Step 0.5 verification pass skipped (no `verify-manual-checks` skill
installed).

**Parallel-session hold:** a concurrent agent owns uncommitted files in this shared tree. It committed
mid-review (`6f5ee614` → `f30f2da7`, incl. `b8c0d623` + `268ca8d6`, both tagged `fix(EX-597)`), which
released most of the hold. **Still held:** `kosztorys-totals-panel.tsx`, `settlement-plane-warning.tsx`,
`warning-banner.tsx`. `/simplify` must not mutate these (never-mutate-a-parallel-tree rule); a finding
landing in one is deferred **with that reason**.

## Findings

<!-- Appended as each check reports; re-sorted most-severe-first at Step 4 close-out. -->

### Correctness (code-review + cross-check)

- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/summary/global-discount-control.tsx:37` ·
      `mode` is `useState`-seeded **once** and never resynchronised, so it can contradict the data it
      describes. `optimisticSettingSave`'s failure path restores `globalDiscount` but has no reach into
      the component's local state.
      Failure: rabat „Kwotowy" 500 zł → pick „Wyłączony" → the write fails → the revert puts `type:'amount'`
      back, the select still reads „Wyłączony". The user sees no rabat while every total still subtracts one.
      Fixed by reconciling during render (React's adjust-state-from-props pattern, not `useEffect` — repo
      rule): a `seenType` shadow flips `mode` back to `'amount'` when a stored discount reappears unbidden.
      Only the null→stored direction is corrected; the reverse is the user's own `changeMode`, which may
      have gone to „%".
      test: no automated test · unit — the repo has **no component-test layer** (no jsdom/testing-library
      in `package.json`, no `environment` in `vitest.config.ts`); standing it up is repo-level
      infrastructure, not this slice's work. Browser-level by nature → belongs to the E2E backlog below.
- [x] 🟡 WARNING · skipped, **filed EX-605** · code-review · `global-discount-control.tsx:50-56` · selecting „Kwotowy"
      **persists nothing** — `changeMode` only writes when _leaving_ `'amount'`. So the select reads
      „Kwotowy" and its own description promises „Nie łączy się z rabatami per pozycja — zastępuje je",
      while `isGlobalDiscountActive` is still `false` and every per-item rabat is still applied. The UI
      asserts a suppression the engine is not performing until a value is typed.
      Real, and it contradicts the semantics `calc.ts:17-24` states ("the MODE decides the replacement,
      not the amount"). **Not auto-applied:** the correct write on entry is `{type:'amount', value: <current>}`,
      which activates the global discount — and therefore mass-suppresses per-item rabaty — the instant the
      select is touched, before any amount is entered. That is a behaviour change in the exact semantics the
      owner adjudicated twice in the last two commits (`b8c0d623`, `268ca8d6`). Owner's call, not a
      reviewer's.
      test: test-driven-debugging · unit — the assertion is pure (`isGlobalDiscountActive` after entering
      the mode), so it does **not** need the missing component-test layer; author it with the fix.
- [x] 🟡 WARNING · skipped, **filed EX-606** (High) · code-review · `src/lib/kosztorys/percent-rabat.ts:9` +
      `use-kosztorys-editor.ts:1116-1138` · the intended 0% mass-clear lands on **no undo stack**.
      `handleApplyPercentRabat` captures `prev` and hands it to `optimisticSettingSave` as the _failure_
      rollback only — there is no `pushReversible` anywhere in the handler, so a **successful** apply is
      not undoable.
      Failure: type 0 in „%" → every per-item rabat across the whole kosztorys is zeroed → Ctrl+Z does
      nothing. The `min(0)` (was `gt(0)`) is a deliberate owner ruling, documented in-comment — so the
      mass-clear is intent, and the gap is only that the most destructive bulk action in the editor has
      no way back.
      **Not auto-applied:** `pushReversible` over a whole-dataset patch is an undo-semantics change of its
      own size (coalescing window, interaction with `flushUndoBuffer`), review-worthy separately.
      test: TDD · unit — assert the undo stack depth grows by one after a successful apply, and that
      popping it restores the per-row `discountType`/`discountValue`.
- [x] 🔵 OBSERVATION → **upgraded** · fixed · code-review · `use-kosztorys-editor.ts:1209` ·
      `setTimeout(() => router.refresh(), 700)` on the grid-change path was **never cleared**, so the
      comment beside it ("after the save quiets down") was false: a run of edited cells queued one
      full-route refresh _each_. This is precisely the cost `d15ba6ab`'s `deferRefresh` removed from the
      autosave — **the slice's #2 win was being partly handed back** a few lines away.
      Fixed by storing the handle in a `refreshTimer` ref and restarting it, mirroring `flushTimer`
      directly above. Pre-existing (moved here by `08310f68`), but reaching outside the diff is not a
      reason to defer a fix that restores the change's own headline claim.
      test: no automated test · e2e — timer coalescing is only observable as request count in a browser
      session; folded into the E2E backlog item below.
- [x] 🟡 WARNING · fixed · feature-first-structure · `src/components/ui/history-back-button.tsx:16` ·
      bare `router.back()` with no empty-history fallback — on a direct load the crumb's „wróć" is dead.
      Sibling `back-button.tsx:14` already guarded `window.history.length > 1`; the new component
      re-solved the problem and dropped the guard.
      Failure: shared link → fresh tab → `history.length === 1` → „wróć" does nothing / leaves the app.
      Fixed by **deduping rather than copying the guard**: the decision moved into
      `src/components/ui/use-history-back.ts`, now the single implementation behind both back
      affordances, and `HistoryBackButton` takes a `fallbackHref` (`/inwestycje/${id}` from the crumb,
      the same target as the `<Link>` beside it). One hook is what stops the guard being dropped a
      third time.
      test: no automated test · unit — needs the component-test layer this repo doesn't have (see W1).
      The dedup is the structural guard in its place.
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/investments.ts:124,146` ·
      `getInvestmentName` reads with `overrideAccess: true` and no auth guard. Identical to
      `getInvestment` beside it, returns a name only, and the crumb renders solely on authenticated
      `/inwestycje/**` routes. Pre-existing repo pattern, not a slice regression.
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/cache/tags.ts:18` + `hooks/revalidate-collection.ts:23` ·
      singular/plural split on `entityTag`. The generic collection hook emits `entityTag('investments', id)`
      → `"investments:5"`, while every subscriber writes `entityTag('investment', id)` → `"investment:5"`.
      **Not a correctness bug** — the same hook also expires `CACHE_TAGS.investments`, which covers those
      entries, and `recalculate-balances.ts` emits the singular form the queries actually subscribe to. So
      the per-entity tag emitted by the hook is simply inert. Left alone: making it live requires either a
      slug→singular map in the generic hook or renaming every subscriber, and the collection-wide tag it
      would optimise away is not currently a measured cost. Recorded because the mismatch reads as working
      code and will mislead the next person who reaches for a per-entity tag.
- [x] 🔵 OBSERVATION · dropped · code-review · media delete → `revalidateTag` fire-and-forget ordering ·
      a delete's invalidation is not awaited against an in-flight read, so a render racing the delete can
      cache a row that no longer exists until the next write. Window is milliseconds, the payload is a
      filename, and the next media write clears it. Not worth a fix or an issue.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/queries/media.ts:20` · the size-headroom comment
      cited "988 rows / 808kB", which is the **table** read, not the cached payload — and it was the
      number the headroom conclusion rested on. The four projected columns measure **95 kB** across those
      988 rows against the Data Cache's ~2 MB ceiling, i.e. ~10× headroom, not ~2×. Comment corrected,
      with the ~10 000-row revisit threshold recorded.
- [x] 🔵 OBSERVATION · skipped · code-review · `summary-panel-content.tsx` → `SummaryExpensesTab` ·
      passes the raw rate where the effective rate is what the tab displays; latent, no wrong figure
      renders today because the two coincide on every current settlement mode. Belongs with the
      `SummaryPanelProvider` prop-threading refactor already recorded below, not as a spot patch.
- [x] 🔵 OBSERVATION · skipped · code-review · `fetchReferenceData` `cache()` mutation-ordering ·
      safe only circumstantially (its own comment concedes it); a future action that mutates then reads
      reference data in the same request silently gets the pre-write value. Verified clean across all
      ~20 call sites. Nothing enforces it — recorded in `change.md` → "Findings" #3 rather than fixed,
      because the enforcement is a lint rule or a convention doc, not a code change in this slice.
- [x] 🔵 OBSERVATION · dismissed · code-review · the `json_agg` tree query · reviewed against the actual
      migration DDL — column correctness, `stage_progress` → `kosztorys_items` → investment join scoping,
      `coalesce` on all four aggregates, the numeric string-vs-JSON-number coercion asymmetry,
      `updated_at` ISO normalisation, `ORDER BY` inside the aggregate, bind-parameter safety, and no
      truncation cap (strictly better than the `limit: 100000` + `assertCompletePage` it replaced).
      **Zero defects in the riskiest thing in the slice.** The three new specs pin it.

- [x] deferred, **filed EX-604** (`e2e-backlog`) · gate · the `deferRefresh` write path has no
      end-to-end guard. A broken write is invisible in the session that made it — the grid keeps
      rendering the typed value out of local `rows` whether or not anything reached Postgres. Browser-level
      by nature; E2E authoring was declined this session, so per AGENTS.md the obligation is discharged by
      filing, not by the decline. Covers three risks: the write persists across a reload, the refresh
      coalesces to one per burst, and the client share route sees the invalidation.

### Doc drift found while running the gate

- [x] fixed · gate · `AGENTS.md:239` · claimed "There is no `context/foundation/test-plan.md` here yet"
      — the file exists. A test-routing rule that denies its own anchor sends every new test back to
      "cover this file". Rewritten to point at it.
- [x] fixed · gate · `context/foundation/manual-checks.md` · no EX-597 section existed (an archive
      blocker). Added, structured around what this slice actually risks: it is a perf change, so the
      checks are mostly **non-regression** on the rewired reads/caches plus the two coalescing behaviours
      only observable as request counts. Also carries EX-605 and EX-606 as explicit
      known-unfixed items awaiting the owner's confirmation.
- [x] fixed · gate · `change.md` · the Outcome table ranked `deferRefresh` #2 without knowing an
      uncleared `router.refresh()` timer was handing part of it back. Caveat added, with the
      generalisation: **a per-write saving is only real if nothing downstream re-adds per-write work** —
      the 324 766 B → 127 B measurement was taken on the action's own payload and structurally could not
      have seen a second refresh path 80 lines away.

### Structure, cohesion, comments

- [x] fixed · feature-first-structure · `labeled-mode-select.tsx` · born-generic primitive (label +
      SimpleSelect + Description + children, zero domain tokens) filed under a feature folder with 3
      consumers. Moved to `src/components/ui/`; all 3 imports rewritten; `tsc` clean. The
      parallel-session block on this lifted when that agent committed.
- [x] fixed · comment-noise · `src/app/(frontend)/layout.tsx:35-36` · **commented-out code**, not a
      comment: `// process.env.NODE_ENV !== 'production' && 'dark',`. Uncommenting it would also violate
      the repo's `no-restricted-syntax` raw-`process.env` ban (AGENTS.md — env only through `src/lib/env/`).
      Deleted.
- [x] fixed · comment-noise · 3 deletes + 1 trim · deleted `top-nav.tsx:23` + `inwestycje/[id]/page.tsx:130`
      (layout narration), `labeled-mode-select.tsx:12` (triple restatement of `description: ReactNode`);
      trimmed `revalidate.ts:5` (dropped the body-restating first line, kept the `WARNING:` Route-Handler
      constraint). `simple-select.tsx:25` was rewritten wholesale by the `buttonTrigger` fix below, which
      dissolved the flagged clause.
- [x] dismissed · comment-noise · `@investmentCrumb/default.tsx:1` and `summary-economics.ts:139` ·
      both survive the strip test on a second read. The `default.tsx` line explains **why the file exists
      at all** (a reader who doesn't know the slot convention cannot derive "no-match fallback" from an
      empty component), and `summary-economics.ts:139` carries the _formula_ — delete it and
      `doRozliczeniaNet: number` no longer says it is `combinedNet − paidNet`.
- [x] fixed · comment-noise · `decimal-field.tsx:10,29`, `summary-panel-content.tsx:128` · 3 trims
      applied — symbol-restating first clause cut, design rationale kept.
- [ ] deferred · comment-noise · `kosztorys-totals-panel.tsx:15` · 4th trim. **Still blocked by the
      parallel-session hold** — this file remains uncommitted in another agent's tree.
- [x] dismissed · comment-noise · slice comments overall · 21 flagged-keep, incl. every comment in the
      4 highest-risk new modules (`kosztorys-tree.ts`, `reference-data.ts`, `media.ts`, `revalidate.ts`)
      and all three new test files. The comment-heaviest new code is the best-justified — measured numbers,
      ticket ids, owner rulings with dates, SQL gotchas with tests pinning them. Vanished-state phrasing in
      `calc.ts:18` / `percent-rabat.ts:7` reads like noise but is the anti-simplification guard, with three
      tests pinning it.
- [x] dropped · comment-noise · `run-action.ts:33`, `use-kosztorys-editor.ts` section dividers ·
      technically restatement, but the dividers carry real wayfinding in a ~1300-line file and deleting
      them makes the EX-515 problem worse, not better.
- [x] skipped · comment-noise · `investment-settings-link.tsx` ↔ `investment-summary-panel.tsx`,
      `summary-investment-settings.tsx` ↔ `summary-panel-content.tsx`, `vat-rate-field.tsx` ↔
      `global-discount-control.tsx` · the same rationale sentence now lives in 2–3 places and can drift.
      Each copy is individually load-bearing, so no comment edit is right — the real fix is deduping the
      **overlapping prop types**, a refactor of its own, and 3 of the files are in the dirty set.
- [ ] fix-now · module-cohesion · `src/components/kosztorys/summary/kosztorys-totals-panel.tsx:14` ·
      header comment ("this file owns nothing but the overlay, so the investment page can mount the same
      content without inheriting the editor's geometry") is now **factually false** — the slice added
      `OPEN_SETTINGS_PARAM`, a `useSearchParams` read and a `forcedOpen` state machine, so the file also
      owns the `?ustawienia=1` deep-link arrival protocol. Doc drift, not a split.
      **Blocked by the parallel-session hold** — this file is uncommitted in another agent's tree.
- [x] skipped · module-cohesion · `src/components/kosztorys/editor/use-kosztorys-editor.ts` · 1289 LOC,
      one export, ~50-key return object, 6 co-resident responsibilities; this slice added +115 LOC and one
      more state slice to it. **Not a new kind of mixing** — settings-persistence already lived here — and
      EX-515 deliberately deferred this split as "a cohesive stateful unit needing a test harness first".
      Recorded because the slice is evidence seam (f) `:958–1138` is now the file's fastest-growing one and
      is self-contained enough to name its own extraction (`use-investment-settings-writes.ts`, needs only
      `investmentId`, `tree`, `patchRows`, `pushReversible`, `optimisticSettingSave`). Belongs to EX-515,
      not to this slice.
- [x] skipped · module-cohesion · `src/lib/queries/reference-data.ts:306-353` ·
      `fetchMaterialTransactionsForInvestment` is not reference data — a per-investment transaction
      projection doing inline Polish UI label shaping (`'Nieznana kategoria'`, `'Korekta'`) in a query
      module. **Pre-existing and untouched by this slice** (its 176 changed lines are ~170 lines of
      re-indentation from the `cache()` wrap; export count identical at 14). Belongs in its own
      `lib/queries/investment-transactions.ts`; moving it is unrelated to a perf slice.
- [x] skipped · module-cohesion · `src/components/kosztorys/summary/summary-panel-content.tsx` ·
      ~35 props, and beyond dispatching to tabs it computes settlement economics inline
      (`bucketDepositsByPlane`, `buildSettlementPlaneVerdict`, `computeDoZaplatyRM`). Pre-existing; slice
      added 2 props. The fix is a `SummaryPanelProvider`, a review-worthy refactor — and the file is in the
      parallel session's dirty set. Watch the prop count past ~40.
- [x] dismissed · module-cohesion · `src/lib/db/kosztorys-tree.ts` · flagged for review as "one big SQL
      query + 4 mappers"; verified **cohesive** — the four mappers are private, unexported, unreachable
      from any other read, and exist only because of that exact `SELECT`. One reason to change: the tree's
      columns. No split warranted.
- [x] fixed · structure-scatter · `AGENTS.md:165` · said `src/lib/db` is "raw SQL financial
      calculations", but it now holds `get-db`, `where-to-sql`, `with-payload-transaction`, `snapshots`,
      `presets`, `notifications` and the new `kosztorys-tree` — none of them financial. The real rule the
      slice followed is "raw-SQL data-access layer: statement + row mapper; auth/cache/shaping live in
      `lib/queries`". Stale wording is what sends the next `lib/db` file to the wrong home.
- [x] fixed · structure-scatter · `AGENTS.md` (Route Groups section) · the `@investmentCrumb` slot is
      the repo's **first and only** parallel route slot. Name the convention now, while there's one
      instance: shell content needing route params gets a `@slot` under `(frontend)/`; the slot file is a
      re-export only, the component lives in `components/nav/`. Undocumented, a second one gets mirrored
      badly.
- [x] skipped · structure-scatter · `src/components/kosztorys/summary/summary-investment-settings.tsx` ·
      composes 4 children on two different contracts — 2 take value+callback props, 2 reach into
      `useKosztorysEditorContext()` directly, which is why the `showSettingsBar` prop exists as a
      "this host is inside the provider" guard. Real design inconsistency, invisible at the call site.
      Not fixed: unifying the contract is a behavior-touching refactor across 4 components and 2 hosts,
      and 3 of them are in the parallel session's dirty set. Review-worthy on its own.
- [x] dropped · structure-scatter · `materials-net-pricing-control.tsx`, `global-discount-control.tsx` ·
      the `flex items-center gap-2` + `text-muted-foreground text-xs` unit-suffix row repeats 3× —
      too small to earn a sub-slot on `LabeledModeSelect`; churn exceeds the gain.
- [x] dismissed · structure-scatter · `temp_notes.md` · flagged as violating "all prose docs live under
      `context/`", but it is **not in this slice** — committed 2026-07-24 in `96b048eb`, deliberately
      recovered owner interview notes. Misattributed to the diff.
- [x] dismissed · structure-scatter · slice structure overall · 0 scattered kinds, 0 stray files, 0
      catch-alls; the `lib/db` ↔ `lib/queries` seam matches 5 pre-existing precedents, and the
      `@investmentCrumb` slot duplicates nothing.
- [x] dropped · tailwind-v4-audit · `eslint.config.mjs` · no Tailwind-aware ESLint plugin, so
      unregistered classes / dead utilities never fail CI (`prettier-plugin-tailwindcss` only sorts) —
      repo-level tooling gap, not a defect in this slice; adding a plugin + fixing whatever it surfaces
      repo-wide is its own change, not something to smuggle into a perf slice.
- [x] dismissed · tailwind-v4-audit · slice UI (8 new components) · audit found zero violations —
      no `[var(--…)]`, no new inline styles, no unregistered utilities; the 2 inline `style` hits and
      the 4 arbitrary-value hits are all pre-existing or canonical v4 syntax.

### Simplify pass (reuse / simplification / efficiency / altitude)

- [x] fixed · simplify (altitude + efficiency, **converged independently**) ·
      `use-kosztorys-editor.ts:259-263` · **a real defect in this gate's own earlier fix.** The refresh
      timer added at :1212 was never added to the unmount cleanup that `flushTimer` has, so navigating
      away right after typing left a `router.refresh()` armed for up to 700ms — firing a full-route
      re-render (90–193ms of server work, per this slice's own figure) of the route the user just left.
      Cleanup now clears both timers, and the literal `700` became `TOTALS_REFRESH_DEBOUNCE_MS` rather
      than silently sharing `UNDO_COALESCE_MS`'s value — they are two knobs that happen to agree.
      test: `no automated test` — unmount-timer behaviour needs a component harness this repo has no
      layer for (no jsdom, no testing-library). Covered by the EX-597 manual check instead.
- [x] fixed · simplify (altitude) · `src/lib/cache/revalidate.ts` · deleted `revalidateCollection`
      (singular) and repointed its 3 callers + 2 test mocks at `revalidateCollections`. The singular was
      strictly weaker — same behaviour minus the `deferRefresh` option — so a caller reaching for the
      obvious-looking name silently could not opt into the very mechanism this slice exists to provide.
      One entry point, one place to make the choice.
- [x] fixed · simplify (reuse) · `src/lib/queries/investments.ts:81` + `investment-crumb.tsx:12` ·
      split `isInvestmentId` out of `parseInvestmentId`. `parseInvestmentId`'s own comment says it is
      "the single home for the id-validity rule so … doesn't re-inline the check and drift from it" —
      and the crumb re-inlined it as `/^\d+$/`, which had **already drifted** (rejects `"07"`, accepts
      `"0"`). The split exists because a slot cannot use the `notFound()` form: a 404 in a parallel
      route takes the whole shell down when all it wants is to render nothing.
- [x] fixed · simplify (simplification) · `src/lib/db/kosztorys-tree.ts:108-112` · `x == null ? null :
    num(x)` written out three times → `numOrNull`, with the note on why it is not just `num` (a
      nullable coefficient means "inherit the default", which `0` would answer as "free").
- [x] fixed · simplify (simplification) · `collapsible-section.tsx` · two parallel
      `Record<SizeT, string>` keyed identically → one `Record<SizeT, {title, chevron}>`, so a new size
      can't be half-added.
- [x] fixed · simplify (simplification) · `simple-select.tsx:55` · `variant === 'toolbar' || variant ===
    'toolbarSm'` → a `buttonTrigger` flag in the VARIANT table. The table already claims to be the one
      place a variant is described; the `||` was a second, drift-prone place.
- [x] skipped, **filed EX-608** · simplify (reuse + efficiency, **converged independently**) ·
      `investment-crumb.tsx:15` → `getInvestmentName` · third read of the same investment row per render
      (`getInvestment` in the page guard, `fetchReferenceData`, then this), and it is tagged
      `investments`, so **every settings write this slice added** expires it. Not fixed here because the
      fix (read the name off `fetchReferenceData`) assumes that cache is warm on every route the slot
      renders on — a per-route behaviour change, not a cleanup.
- [ ] deferred · simplify (simplification + altitude) · `summary-panel-content.tsx` host-capability props
      (`totalsOnly`, `showTransactions`, `showSettingsBar`/`showGlobalSettings`) · a five-boolean bag
      encoding one host identity, with `totalsOnly` reachable only from its own spec.
      **Correction (2026-07-27):** first triaged as "another slice's in-flight work, not ours" on the
      strength of `git log -S` pointing at `86dc9e1c`. That was wrong — `86dc9e1c` is an **ancestor of
      this branch and already on `staging`**, i.e. landed history this slice was built on, not a
      parallel agent's dirty tree. So the agents' original call stands: this is unused plumbing built
      for a host that was never wired, and `showSettingsBar` additionally names a component that no
      longer exists while being forwarded on as `showGlobalSettings`. Deferred rather than fixed
      because collapsing five booleans to named host profiles is a design change to a shared component
      with three call sites — a slice of its own, not a gate cleanup. Box checks once filed.
- [x] skipped · simplify (altitude) · `use-kosztorys-editor.ts` `handleGlobalCoeffChange` · alone among
      the settings handlers it never opts into `startSettingsSave`, so it shows no saving pill and isn't
      disabled in flight. Real inconsistency, but it is a **UX behaviour change** to a figure-moving
      control, and this slice's remit was write-path cost — not the one to change what the user sees
      mid-save.
- [x] dropped · simplify (reuse) · drift-parser duplication between `kosztorys-tree-sql-drift.test.ts`
      and `reference-data-sql-drift.test.ts` · extracting a shared `src/__tests__/helpers/` parser would
      couple two guards whose whole value is being independently written. Two ~10-line readers is the
      cheaper failure mode.
- [x] dropped · simplify (efficiency) · media read still awaited alongside transfers though no longer
      dependent; `fetchExpenseCategories` duplicate read; deposit rows crossing into the RSC payload on a
      host that never lists them · all three measured or reasoned as negligible against the 5→1 round-trip
      win; the efficiency agent said so itself on the middle one.
- [x] dismissed · simplify (simplification) · third case in `revalidate.test.ts` · flagged as redundant,
      but it pins a distinct invariant the other two don't (that `deferRefresh` is per-call, not sticky
      across slugs in one invocation).
- [x] dropped · simplify (reuse) · `investment-settings-link.tsx` ≈ `open-kosztorys-v2-button.tsx`;
      `materials-net-pricing-control.tsx:65-67` `<span>` label bypassing `DecimalField`'s label slot ·
      the first is a 12-line structural rhyme in another slice's dirty file; the second is a real a11y
      nit but sits in the parallel-session hold set.

## Simplify pass

Ran `/simplify` — 4 agents (reuse, simplification, efficiency, altitude), 17 findings after dedup:
**6 fixed, 1 filed (EX-608), 3 skipped, 6 dropped, 1 dismissed · 0 open.** Two agents converged
independently on the refresh-timer unmount leak, which was a defect in this gate's _own_ earlier fix —
the strongest argument for the fan-out. Findings folded into `## Findings` above (tagged `simplify`)
rather than a separate report, per the gate's one-list rule.

Altitude's three explicit _no-change_ verdicts are worth recording: `deferRefresh` sits at the right
altitude (an option on the shared helper, not a special case beside it), the `@investmentCrumb`
parallel-route slot is the correct mechanism for param-dependent shell chrome, and the `lib/db` ↔
`lib/queries` seam is respected by the new tree query.

## Tests & suite

**Authored at Step 3** — one spec, for the one behaviour change in the `/simplify` batch:

- `src/__tests__/lib/queries/investment-id.test.ts` (13 tests, green) — pins `isInvestmentId`, the
  predicate split out of `parseInvestmentId`. Its first two cases _are_ the drift the split fixed
  (`"07"`, `"0"`), so the spec fails if anyone re-inlines `/^\d+$/` anywhere.

Nothing else in the batch warranted a spec: the other five fixes are refactors with identical
behaviour, and `tsc --noEmit` is the guard that they are (it caught nothing, which is the signal).

**Legs run so far**

- `pnpm exec tsc --noEmit` — clean (run three times across the batch).
- `prettier --check` on every touched file — clean after formatting `layout.tsx` +
  `use-kosztorys-editor.ts`.
- Targeted vitest: `investment-id`, `toggle-actions`, `reconcile-leads`, `revalidate`,
  `kosztorys-tree-sql-drift`, `deposits-table` — **27 + 13 passed**. These are exactly the specs the
  `revalidateCollections` consolidation rewrote plus the new one.

**Full unit suite** (user's call at Step 3 — unit only, no build/lint leg):

`pnpm test` → **1777 passed, 0 failed, 62 skipped** across 129 files (19s). The 62 skips are the
DB-backed specs that self-skip without the 5435 `db-test` container, plus the SMTP `ECONNREFUSED`
stderr, which is `@payloadcms/email-nodemailer` probing a mail server at import time — unrelated
noise, present before this slice.

E2E is out by standing instruction for this slice; its browser-level obligation is discharged by
**EX-604** (`e2e-backlog`), per the AGENTS.md rule that a commit message saying "deferred" does not
discharge it.

## Archive gate

| Blocker                        | State                                                                                                                                                                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No open `[ ]` findings         | ⛔ **1 open** — the host-capability boolean bag, reopened by the `86dc9e1c` correction above; owes a Linear issue                                                                                                                        |
| Manual verification signed off | ⛔ **open** — the `## EX-597` section in `context/foundation/manual-checks.md` is authored but unperformed. Two of its checks need a human at the Network tab (write-path request counts), and two carry EX-605/EX-606 as known-unfixed. |

**Not archivable yet**, and nothing is committed. The code side of the gate is finished.
