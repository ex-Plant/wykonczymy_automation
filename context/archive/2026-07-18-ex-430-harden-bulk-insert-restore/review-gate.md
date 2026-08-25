# Review-gate ledger — ex-430-harden-bulk-insert-restore · 2026-07-28

Diff under review: `a0f06298~1..HEAD` (p1–p4 + epilogue), 8 files.

Fan-out: `/10x-impl-review`, `/code-review`, `comment-noise-audit` (flag-only), and the three
file-organization audits (`feature-first-structure`, `module-cohesion-audit`,
`structure-scatter-audit`) collapsed into one agent — the diff adds three specs in canonical mirror
paths and edits three existing `src/lib/kosztorys` files, so three separate agents would be
ceremony. `tailwind-v4-audit` dropped: no CSS/TSX in the diff. Step 0.5 (verification pass) skipped:
no `verify-manual-checks` skill installed in this environment.

## Findings

- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/kosztorys/insert-rows.ts` · claimed the plan's
      `INSERT … SELECT unnest(...) WITH ORDINALITY` alternative was the correct implementation and the
      natural-key join a lesser substitute. **Disproved by experiment**, not by argument: `RETURNING`
      cannot reference the source relation — `RETURNING id, u.ord` on a TEMP-table repro raises
      `ERROR: missing FROM-clause entry for table "u"`. The plan's alternative is not implementable as
      written, so the key join stands.
      test: no automated test — a claim about the review, not about the code
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

**Archived 2026-07-29, EX-430 closed `Done`.** `context/foundation/manual-checks.md` still carries the
two unticked EX-430 boxes (undo-to-snapshot tree identity; preset-onto-blank parenting) — they stay open
in the registry. The gate paragraph above was written under the old rule where manual checks hard-blocked
archive; that was reversed on 2026-07-28, so manual verification no longer gates `Done`.

Findings with disposition `fixed` were trimmed from `## Findings` at archive time — the fixes are the code.
