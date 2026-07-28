# Review-gate ledger — ex-430-harden-bulk-insert-restore · 2026-07-28

Diff under review: `a0f06298~1..HEAD` (p1–p4 + epilogue), 8 files.

Fan-out: `/10x-impl-review`, `/code-review`, `comment-noise-audit` (flag-only), and the three
file-organization audits (`feature-first-structure`, `module-cohesion-audit`,
`structure-scatter-audit`) collapsed into one agent — the diff adds three specs in canonical mirror
paths and edits three existing `src/lib/kosztorys` files, so three separate agents would be
ceremony. `tailwind-v4-audit` dropped: no CSS/TSX in the diff. Step 0.5 (verification pass) skipped:
no `verify-manual-checks` skill installed in this environment.

## Findings

- [x] 🔴 CRITICAL · fixed · impl-review + code-review · `src/lib/kosztorys/insert-rows.ts:56` ·
      `indexReturnedIds` threw on a tied natural key, so any tree with two sections (or two same-section
      items) sharing a `display_order` could never be restored, preset-seeded or preset-appended again —
      and the snapshot preserves `display_order` verbatim, so the failure repeats on every retry with no
      UI path to repair it. Verified independently before accepting: `pg_constraint` shows **no UNIQUE on
      `display_order`** (only `kosztorys_stages_investment_ordinal_unique` exists), `appendPresetSections`
      knowingly races on a MAX select, the read path orders by `(display_order, id)` so a tie is merely
      ambiguous — and the dev DB holds one such duplicate today. Fixed by degrading to positional mapping
      on a tie (with a `console.error` + `TODO(EX-449) SENTRY-REQUIRED`) instead of refusing the batch:
      positional is exactly what this code did before the key join, so the fallback is the old behaviour,
      not a new risk.
      test: test-driven-debugging · integration — `restore-duplicate-display-order.test.ts`, red first
      (threw), now asserts no throw + every item under its own section across reminted ids
- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/lib/kosztorys/insert-schema-drift.test.ts:1` ·
      the drift guard **retyped** the INSERT column lists instead of importing them, so the cheapest way
      to make it green after a real drift was to edit the test — a guard that guards nothing. Fixed by
      exporting `SECTION_INSERT_COLUMNS` / `ITEM_INSERT_COLUMNS` / `STAGE_INSERT_COLUMNS` /
      `PROGRESS_INSERT_COLUMNS` and building both the SQL and the assertion from the same constants.
      Proved red by deleting `'note'` from `ITEM_INSERT_COLUMNS`.
      test: TDD · integration — the guard itself; the deliberate-drift run is its proof
- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/lib/kosztorys/restore-rollback.test.ts:112` ·
      the spec asserted only _that_ it threw, so a guard that started throwing **earlier** (before the
      wipe) would leave it green while it silently stopped testing atomicity. Now asserts the throw's
      origin — `23505` on `kosztorys_stages_investment_ordinal_unique` — read off `error.cause`, because
      Drizzle wraps the driver error.
      test: TDD · integration — the assertion is the fix
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/insert-rows.ts:56` · `remapNewIds` — the whole
      point of the slice — had **no direct unit coverage**: every path through it was only exercised
      incidentally by DB specs, so the shuffled-RETURNING case it exists to survive was never actually
      shuffled. Added `src/__tests__/lib/kosztorys/insert-rows.test.ts`: shuffled RETURNING → input order,
      tie → positional + one log line, short insert → throws, unmatched key → throws.
      test: TDD · unit — four pure cases, no DB
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/actions/kosztorys.ts:57` +
      `src/lib/kosztorys/display-order.ts:20` · `displayOrder` was validated as a bare `z.number()` while
      its siblings at :300/:373 already used `z.coerce.number().int().min(0)`. Now load-bearing, not
      cosmetic: a float `display_order` round-trips through the natural-key join as a string and would
      never match. Tightened both, with a comment saying why the `.int()` matters here.
      test: no automated test — schema-level, and the join's behaviour is covered by `insert-rows.test.ts`
- [x] 🔵 OBSERVATION · fixed · code-review ·
      `src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts:213` · the column-coverage fixture
      never exercised the **mirrored** override combo (`w_tools=amount` + `own_tools=coeff`), so a swapped
      pair of override columns survived the roundtrip unnoticed; and its id comparison used a
      lexicographic `.sort()`, which orders `[10, 9]` as `[10, 9]`. Added the third Section C item + a
      third stage + a newline in a `description`, and switched to a numeric comparator.
      test: TDD · integration — the fixture rows are the coverage
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/kosztorys/insert-rows.ts` · claimed the plan's
      `INSERT … SELECT unnest(...) WITH ORDINALITY` alternative was the correct implementation and the
      natural-key join a lesser substitute. **Disproved by experiment**, not by argument: `RETURNING`
      cannot reference the source relation — `RETURNING id, u.ord` on a TEMP-table repro raises
      `ERROR: missing FROM-clause entry for table "u"`. The plan's alternative is not implementable as
      written, so the key join stands.
      test: no automated test — a claim about the review, not about the code
- [x] fixed · simplify · `src/__tests__/lib/kosztorys/{restore-duplicate-display-order,serialize-restore-roundtrip,restore-rollback,serialize-apply-preset}.test.ts`
      · four hand-rolled `beginTransaction` / `commit` / `rollback` blocks reimplemented the repo's own
      `withPayloadTransaction` primitive (two of them written by this slice, two pre-existing). All four
      now call it; `restore-rollback` keeps its own `try/catch` purely to capture the error it asserts on.
- [x] fixed · comment-noise · `src/lib/kosztorys/append-preset-sections.ts:44,50` +
      `src/lib/kosztorys/insert-kosztorys-tree.ts:34` + the roundtrip spec · five comments that restated
      their code trimmed or deleted; the one comment in `append-preset-sections.ts` that carries real
      rationale was **kept and extended** to name what it now explains — the tolerated MAX-select race is
      the _source_ of the tie that the id remap degrades on.
- [x] dropped · primitive-reuse-scan · `src/__tests__/lib/kosztorys/*.test.ts` · the same three-line
      `vi.mock('@/lib/auth/require-auth', …)` stub repeats across six specs. Not worth extracting: the
      `vi.mock` call is hoisted and must stay in each file regardless, so a shared factory saves one line
      per spec while adding an indirection to a test-only stub.
- [x] filed EX-635 · primitive-reuse-scan · `src/__tests__/lib/kosztorys/*.test.ts` · six DB specs each
      hand-build the same kosztorys tree in a long `beforeAll`; a shared fixture builder belongs beside
      `helpers/investment.ts`. Not fixed here — it rewrites the `beforeAll` of six specs spanning two
      slices, which is a review-worthy refactor, not a gate fix.
- [x] dismissed · feature-first-structure / module-cohesion / structure-scatter · no findings. The three
      new specs sit in their canonical full-depth mirror paths, `insert-rows.ts` is a single-concern
      module the diff made _more_ cohesive by exporting the column constants it already owned, and no new
      competing home was created.

## Simplify pass

Ran `/simplify` — 2 applied (transaction-primitive dedup across 4 specs; comment-noise trims), 0
proposed, 0 dismissed; each finding folded into `## Findings` above (tagged `simplify` /
`comment-noise` / `primitive-reuse-scan`). No separate report file — this ledger is the record.

## Tests & suite

- `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/lib/db` (against the 5435 `db-test`
  container) — **44 files / 425 tests passed**.
- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors, 84 pre-existing warnings (all unused `payload`/`req`/`db` args in
  `src/migrations/*`, none from this diff).
- Full suite (`test:e2e`, `build`) — not run; awaiting the user's go.

### E2E disposition

**None owed.** This slice is pure backend hardening of `src/lib/kosztorys` bulk inserts — no route, no
component, no browser-observable behaviour changed. Its risks (RETURNING row order, atomicity on a
mid-restore throw, column drift, tied natural keys) all live below the HTTP boundary and are covered by
DB-backed integration specs, which is the cheapest layer that gives real signal. A Playwright spec would
exercise the same code path through five extra layers and assert nothing the integration specs don't.

### Archive gate

**Blocked — the slice stays _in review_.** `context/foundation/manual-checks.md` carries two unticked
EX-430 boxes (undo-to-snapshot tree identity; preset-onto-blank parenting) that only a human can tick.
Per the project's `Done` rule, manual checks are a hard blocker for archive: do not run `/10x-archive`
until they are ticked.
