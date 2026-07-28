# Review-gate ledger — cancellation-sum-overcount (EX-574) · 2026-07-28

Reviewed diff: `739788ac..HEAD` — `dc2bf98b`, `5ed00e78`, `27444def`, `3ccb4c88`.

Source files in scope:

- `src/lib/queries/transfer-filters.ts`
- `src/lib/db/where-to-sql.ts`
- `src/components/transfers/transfer-filters.tsx`
- `src/__tests__/lib/queries/transfer-filters.test.ts` (new)

Guard: the working tree carries a **parallel session's** uncommitted preview-mode work
(`preview-policy.ts`, share pages, summary panel, `playground/`). None of it overlaps this slice's
files — `/simplify` must not touch it.

Step 0.5 (browser verification pass) skipped: manual checks are non-blocking for Done as of
2026-07-28; they remain unticked in `context/foundation/manual-checks.md:641-657` and are surfaced at
Step 4.

## Findings

- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/db/where-to-sql.ts:42` · `buildSqlConditions`
      unconditionally `continue`s on `id`, so `?id=42` lists one row under a tile summing the whole
      non-cancelled table. `id` is in `ENTITY_FILTER_KEYS:35`, so it alone renders the tile. The
      sentinel is already caught upstream (`sum-transfers.ts:257,405`), so the skip only ever kills a
      real filter. Pre-existing, but it breaks this slice's own acceptance sentence.
      test: test-driven-debugging · unit — `?id=42` → emitted SQL contains `id = 42`
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/transfers/transfer-filters.tsx:231` ·
      The scope tooltip states only half the `showCancelled` mismatch. `buildTransferFilters:92`
      emits no `type` condition in that view, so the tile still counts every CANCELLATION stub at
      +1× — EX-574's own defect — while the note reassures the reader the sum is merely narrower.
      test: no automated test · — static Polish copy on a `!==` branch; the SQL behavior it
      describes is pinned by the `showCancelled` spec case
- [x] 🟡 WARNING · fixed · `code-review` + `impl-review` (F2/F3) ·
      `src/__tests__/lib/queries/transfer-filters.test.ts` · The spec covers 5 of the 8 operators
      `buildTransferFilters` can emit — `greater_than_equal`/`less_than_equal` on `date`, `equals`
      on `worker`, and the whole `or` branch are unguarded. Phase 2's throw was justified on the
      claim that the spec covers every reachable operator; on three of eight it does not, so a
      rename in `OPERATORS` ships green and 500s the first user who sets a „do" date.
      test: TDD · unit — add the date-range, worker-`equals`, and `or`-branch cases
- [x] 🟡 WARNING · fixed · `impl-review` (F1) · `src/lib/db/where-to-sql.ts:82` ·
      `OPERATORS[operator]` resolves up the prototype chain, so `{ amount: { isPrototypeOf: 5 } }`
      renders `AND false` — a silently empty result set — instead of throwing. Not user-reachable
      (search params become values, never keys), but it is exactly the vanish-silently class the
      throw exists to close.
      test: TDD · unit — inherited-key case must throw
- [x] 🟡 WARNING · fixed · `impl-review` (F3) ·
      `src/__tests__/lib/queries/transfer-filters.test.ts:48` · `not.toContain('type ')` passes only
      because the base SELECT happens to write `type::text` / `AS type,` / `GROUP BY type,` with no
      trailing space. A whitespace edit in `sum-transfers.ts` turns it red with zero behavior change.
- [x] 🔵 OBSERVATION · fixed · `code-review` + `impl-review` (F4) ·
      `src/lib/db/where-to-sql.ts:95-99` · `escapeValue` degrades every non-number/non-string to the
      keyword `NULL`, so a boolean condition becomes an always-`NULL` predicate rather than throwing
      — the silent sibling of the operator bug just fixed. `cancelled` is in `FIELD_TO_COLUMN:20`, so
      the module advertises boolean support it does not have.
      test: TDD · unit — boolean renders `TRUE`/`FALSE`; an unsupported value type throws
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/db/where-to-sql.ts:90` · Multi-operator
      field conditions join with `' AND '` and splice into the OR list unparenthesized. Correct today
      only because SQL binds `AND` tighter than `OR`; the new `less_than` branch is the first thing
      that makes a two-operator part common inside an `or`.
      test: no automated test · — parenthesizing is unobservable until an `or` carries a range;
      covered incidentally by the new `or`-branch spec case
- [x] 🔵 OBSERVATION · fixed · `impl-review` (F6) · `src/lib/db/where-to-sql.ts:84-86` · The
      `in`/`not_in` array guard was added beyond the plan and has no spec case.
      test: TDD · unit — non-array `in` throws
- [x] 🔵 OBSERVATION · fixed · `impl-review` (F5) + `simplify` · `src/lib/db/where-to-sql.ts:79` ·
      An unmapped **field** still vanishes silently while an unmapped **operator** throws. First
      closed by documenting the gap; `/simplify` then closed it for real — a comment explaining a
      hole is not a guarantee. Every field the 4 producers can emit (`buildTransferFilters`, plus
      the `investment`/`worker` merges in the investment, pracownicy and kosztorys_v2 pages) is in
      `FIELD_TO_COLUMN`, so the set is closed and the throw is unreachable in practice.
      test: TDD · unit — `unmapped field "nickname"` throws
- [x] fixed · `impl-review` (F2) ·
      `src/__tests__/lib/queries/transfer-filters.test.ts:17-25,32-33` · The spec duplicates the
      fake-payload harness and `extractSql` from `src/__tests__/sum-transfers.test.ts:15-27,240`
      line-for-line, against the plan's explicit „reuse" instruction. A drizzle upgrade that moves
      `queryChunks[0].value[0]` now breaks two copies that don't reference each other.
- [x] fixed · `comment-noise` · `src/__tests__/lib/queries/transfer-filters.test.ts:27` · Delete —
      `sqlForSearchParams` and its four-line body already state the chain.
- [x] fixed · `comment-noise` · `src/lib/db/where-to-sql.ts:24` · Trim the postmortem
      („It used to fall through silently…") and the restatement of the `OPERATORS` table below it;
      keep the closed-set justification. Also drags a Polish UI label into an English comment.
- [x] fixed · `comment-noise` · `src/lib/queries/transfer-filters.ts:185` · Trim the vanished-state
      framing; keep the domain fact that makes the `type` condition load-bearing.
- [x] fixed · `comment-noise` · `src/__tests__/lib/queries/transfer-filters.test.ts:6` · Trim the
      chain narration and postmortem; keep the assert-the-SQL-not-the-Where rule.
- [x] fixed · `impl-review` (F7) + `simplify` · `src/components/transfers/transfer-filters.tsx:101-103` ·
      `listsCancelled` re-derived, client-side, a rule `buildTransferFilters:74-78` owns, with both
      param names as bare literals in both places. Originally skipped on the grounds that the dedup
      would drag a server module into the client bundle — `/simplify` invalidated that reason: the
      server already holds the Where (`transfer-table-server.tsx:27`), so `!('cancelled' in
    config.query.where)` says „the sum is narrower than the list" at the right altitude and rides
      the `config` channel that already carries `totalFilteredAmount`. No client import added.
- [x] skipped · `feature-first` · `src/__tests__/build-transfer-filters.test.ts` +
      `transactions-report-filters.test.ts` · Same source (`lib/queries/transfer-filters.ts`), two
      spec homes — the new mirrored one and the grandfathered top level. AGENTS.md explicitly
      grandfathers the top level, and `scripts/test-integration.sh` discovers specs by grepping the
      tree, so a blind move risks discovery. The slice added to the correct home; draining the tail
      is its own commit.
- [x] dropped · `code-review` · `src/components/transfers/transfer-filters.tsx:226` · The tooltip is
      gated behind `hasAnyFilter`, which excludes `showCancelled`/`cancelledTransactionAudit`, so in
      bare audit mode no tile renders at all. No tile means no misleading number — benign.
- [x] dropped · `code-review` · `src/components/transfers/transfer-filters.tsx:231` · Radix
      suppresses the focus-open on touch, so the note is hover-only on phones. App-wide
      `InfoTooltip` pattern, not this diff's defect.
- [x] dismissed · `impl-review` (F8) · `src/lib/db/where-to-sql.ts:72` · `like` passes `%`/`_`
      unescaped, but its sole producer is `normalizeAmountSearch`'s prefix mode behind `^\d+$`. Not
      reachable, and the inline comment already states the pre-validation contract.
- [x] dismissed · `impl-review` (F9) · Linear EX-574 · Sits at In Progress / `in review` while the
      plan says „→ Done". That is this project's convention — Done comes after the gate.
- [x] dismissed · `tailwind-v4-audit` · `src/components/transfers/transfer-filters.tsx` · Clean —
      the diff adds logic and a string prop, no styling, no responsive prefixes.
- [x] dismissed · `module-cohesion` + `structure-scatter` · Clean. The slice improved cohesion twice
      (the `OPERATORS` table, the collapsed `stripCancelledFilters`) and invented no new home.
- [x] fixed · `simplify` (reuse — both agents, must-fix) · `src/__tests__/sum-transfers.test.ts:15-27,238-242` ·
      The gate extracted `helpers/fake-payload-sql.ts` and then migrated only the new spec, so the
      hand-rolled `mockExecute` / `fakePayload` / `extractSql` triple survived here — two copies
      where there had been one, and the new spec would go green while this one went red on a drizzle
      upgrade. Both now import the helper; `extractSql` folded into `lastSql` (its only caller).
- [x] fixed · `simplify` (altitude) · `src/__tests__/lib/db/where-to-sql.test.ts` (new) · One
      module's tests lived in three places. The translator now has its own spec asserting
      `buildSqlConditions` **directly** — no fake db in the loop — absorbing the 5 translator-only
      cases from the queries spec and the `buildSqlConditions — filter translation` block from
      `sum-transfers.test.ts`. Each remaining home keeps only what it actually owns: the queries spec
      the URL → SQL chain, `sum-transfers.test.ts` the seam (sentinel short-circuit, splice slot).
      Coverage went up on the way — quote escaping, `like`, a range nested in an `or`.
- [x] fixed · `simplify` (altitude) · `src/lib/db/where-to-sql.ts:36-72` · `buildSqlConditions`
      wrapped each field back into a `{ [field]: condition }` object so `buildFieldCondition` could
      unwrap it and loop — a loop that then silently dropped every field after the first, and forced
      the `or` branch through the same wrap/unwrap. Collapsed into one recursive `renderField(field,
    condition)`; `or` branches now AND multi-field sub-objects instead of discarding them.
- [x] fixed · `simplify` (simplification) · `src/lib/db/where-to-sql.ts:59-60` · The `in`/`not_in`
      arity check sat in the operator loop as a name-matching special case. Moved into the two
      renderers that need it via `renderList`, so the loop is uniform and the table stays the single
      place operators are described. Error message gained the offending value type.
- [x] dismissed · `simplify` (efficiency) · Clean — no new I/O, no added sequential awaits, no
      closure-captured long-lived objects. The one perf-shaped change is a wash: `renderField`
      allocates one fewer object per field than the wrap/unwrap it replaced.

## Simplify pass

Ran `/simplify` — 5 applied, 0 proposed, 1 dismissed; every finding folded into `## Findings`
above (tagged `simplify`). Both cleanup agents converged independently on the un-applied helper
extraction as the must-fix. No separate report file: the ledger is the record.

Scope guard held — nothing outside the slice's own files was touched, so the parallel session's
uncommitted preview-mode work is untouched.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm test` — **1874 passed**, 70 skipped (139 files). The skips are the DB-backed specs that need
  the 5435 container; they run under `pnpm test:integration` on the pre-push hook.
- `pnpm lint` — **0 errors**, 86 warnings, all pre-existing `no-unused-vars` on the `db` arg in
  `src/migrations/*`. None in this slice's files.
- `pnpm build` — clean.
- `pnpm test:e2e` — **not run.** E2E is non-blocking for Done as of 2026-07-28, and this slice's
  browser coverage is already filed as **EX-627** (`e2e-backlog`).

New/changed specs this gate: `lib/db/where-to-sql.test.ts` (new, 20 cases),
`lib/queries/transfer-filters.test.ts` (10 cases), `sum-transfers.test.ts` (28), all green.
