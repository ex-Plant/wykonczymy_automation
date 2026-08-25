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
      **Resolved 2026-07-27 (EX-605, commits `4df66ebe` + `a75714c8`).** Owner adjudicated: activate on
      selection, seeded with Σ rabatów per pozycja so no figure moves, **and** put it on the undo stack.
      `globalDiscountForMode` in `calc.ts` carries the rule; the red-first unit spec landed with it. The
      discount now saves through `saveSetting` like its three sibling investment settings — it was the only
      one of the four missing an undo entry. Owner then extended the scope: both modes commit through one
      „Zapisz" button (`RabatValueField`, replacing `PercentRabatTool`), because blur is the wrong commit
      gesture for a deal-level concession. Manual checks: `## EX-605` in `manual-checks.md`; durable rule
      recorded in `context/reference/kosztorys-editor-domain-notes.md`.
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

### Structure, cohesion, comments

- [x] dismissed · comment-noise · `@investmentCrumb/default.tsx:1` and `summary-economics.ts:139` ·
      both survive the strip test on a second read. The `default.tsx` line explains **why the file exists
      at all** (a reader who doesn't know the slot convention cannot derive "no-match fallback" from an
      empty component), and `summary-economics.ts:139` carries the _formula_ — delete it and
      `doRozliczeniaNet: number` no longer says it is `combinedNet − paidNet`.
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

num(x)`written out three times →`numOrNull`, with the note on why it is not just `num`(a
      nullable coefficient means "inherit the default", which`0` would answer as "free").
'toolbarSm'` → a `buttonTrigger` flag in the VARIANT table. The table already claims to be the one
place a variant is described; the `||` was a second, drift-prone place.

- [x] skipped, **filed EX-608** · simplify (reuse + efficiency, **converged independently**) ·
      `investment-crumb.tsx:15` → `getInvestmentName` · third read of the same investment row per render
      (`getInvestment` in the page guard, `fetchReferenceData`, then this), and it is tagged
      `investments`, so **every settings write this slice added** expires it. Not fixed here because the
      fix (read the name off `fetchReferenceData`) assumes that cache is warm on every route the slot
      renders on — a per-route behaviour change, not a cleanup.
- [x] fixed (partly) + dropped (partly) · simplify (simplification + altitude) ·
      `summary-panel-content.tsx` host-capability props (`totalsOnly`, `showTransactionLists`,
      `showSettingsBar`/`showGlobalSettings`) · filed as a five-boolean bag with `totalsOnly` reachable
      only from its own spec.
      **Correction (2026-07-27, second pass):** the earlier framing over-counted. Only **one** of the
      five was dead — `DepositsTable`'s `totalsOnly`, born in `86dc9e1c` as the first attempt at a host
      without the per-wpłata list; that host ended up going through `showTransactionLists={false}` →
      `showDeposits={false}`, so the table never renders at all and the branch was unreachable.
      **Fixed:** `totalsOnly`, its `!totalsOnly` branch, the `-mt-px` conditional, the now-unused `cn`
      import, and its only exerciser `src/__tests__/components/kosztorys/summary/deposits-table.test.ts`
      are deleted. The remaining four are **live and correct**: `showTransactionLists` is passed by
      `investment-summary-panel.tsx:99`, `showSettingsBar` by `kosztorys-editor-body.tsx:244`,
      `showPies` / `clientView` by both. **Dropped:** collapsing the four live booleans into named host
      profiles — with the dead one gone the bag is a legible four-flag capability set, not worth a
      design change to a shared component with three call sites, and not worth a backlog entry.
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

| Blocker                        | State                                                                                                                                                                                                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No open `[ ]` findings         | ⛔ **1 open** — the host-capability boolean bag, reopened by the `86dc9e1c` correction above; owes a Linear issue                                                                                                                                                                                   |
| Manual verification signed off | ⛔ **open** — the `## EX-597` section in `context/foundation/manual-checks.md` is authored but unperformed. Two of its checks need a human at the Network tab (write-path request counts), and one still carries EX-606 as known-unfixed. EX-605 shipped and has its own `## EX-605` check section. |

**Not archivable yet.** The slice's own code is committed and merged to `staging`; EX-605 shipped as a
follow-up on top of it.
