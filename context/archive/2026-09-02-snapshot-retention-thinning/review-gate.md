# Review-gate ledger — snapshot-retention-thinning · 2026-09-02

Commit under review: `fca1ea2e` (19 files, base `staging`).

Checks dispatched: `/10x-impl-review`, `/code-review`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `comment-noise-audit` (flag-only).
Dropped: `tailwind-v4-audit` — the diff touches one `.tsx` and adds no styling. Step 0.5 (verification
pass) skipped — no `verify-manual-checks` skill installed, and the browser pass was not requested this turn.

## Findings

_Trimmed at archive (2026-09-02): the nine `fixed` findings were dropped — a fix's durable
record is its commit, and the code now reads the way the finding asked for. What survives is the
negative space git cannot hold: what was judged benign, dropped, or deliberately left undone.
Pre-trim tally: 9 fixed, 5 dismissed, 1 dropped, 1 skipped · 0 open._

- [x] 🟡 WARNING · dismissed · impl-review · `src/lib/kosztorys/restore-kosztorys.ts:50` ·
      Claim: with `settings` absent and `clearGlobalDiscount` false, `data` is `{}` and the
      `updatedAt` bump the grid remount depends on is short-circuited. FALSE — Payload stamps
      `updatedAt` on every update regardless of `data`
      (`node_modules/payload/dist/collections/operations/utilities/update.js:246`). Comment rewritten
      to say what is actually guaranteed instead of implying the write does it.
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/db/snapshots.ts:114` · Neither existing index
      (`…investment_taken_at_idx`, `…investment_kind_taken_at_idx`) is prefixed on `taken_at`, so all
      three sweep DELETEs seq-scan. Real, and irrelevant at this scale: a nightly cron over a table
      that a year of retention leaves in the tens of thousands of rows. Not worth an index or a ticket.
- [x] skipped · code-review + impl-review · `src/lib/db/snapshots.ts:82` · `listSnapshots` is
      unbounded and the drawer renders it unvirtualized. The plan lists this under "What We're NOT
      Doing" on the owner's explicit ruling that the list is not a concern — so it stays. Recorded
      because code-review sized the year-one ceiling at ~4300 rows per investment, not the ~50 the
      ruling was given against; if the drawer ever feels slow, this is the reason.
- [x] dismissed · code-review · `src/lib/kosztorys/insert-kosztorys-tree.ts` · Claim: a payload
      mixing rows with and without `displayOrder` collides in the natural-key remap. Unreachable — a
      payload is written by one serializer version, so the key is present on all rows or none.
- [x] dismissed · code-review · `src/lib/db/snapshots.ts:111` · Claim: three DELETEs should be one
      transaction. Each band is independently idempotent and the survivors ARE the state, so a partial
      sweep is simply a sweep that will finish tomorrow.
- [x] dismissed · code-review · `src/lib/db/snapshots.ts:156` · Claim: the per-band counters are
      loose because a neighbouring run's rows land in them. That is the documented compromise for a
      shared test DB and the reason the spec asserts survivor stability, not `deleted === 0`.
- [x] dismissed · impl-review · Phase 1 · Claim: the DB spec was never run. It was — `pnpm
  test:integration`, green, and again after this pass.
- [x] dismissed · feature-first-structure · The slice added one spec and touched files in their
      existing homes; `__tests__` mirroring is exact. Nothing to place.

## Simplify pass

Ran as the serial mutating step of this gate rather than as a separate `/simplify` invocation —
9 findings applied, 0 proposed, 5 dismissed, 1 dropped, 1 skipped; all folded into `## Findings` above.

## Tests & suite

- `npx tsc --noEmit` — clean.
- `pnpm lint` — 4 errors, all pre-existing and outside this slice (`(legal)` pages' `<a>` vs `<Link>`,
  `test.js` `no-undef`). No new warnings from the diff.
- `pnpm test` — 228 files / 3178 tests passed, 57 files skipped (DB-gated).
- `pnpm test:integration` (5435 `db-test`) — 55 files / 202 tests passed, including the reworked
  `snapshots.test.ts` and the new `restore-missing-settings.test.ts`.
- `pnpm build` — green.
- `pnpm test:e2e` — NOT run (never run unprompted; ~1h). No browser-level E2E is owed: the slice's one
  UI change is a static sentence in an existing confirm dialog.

## Archive gate

Archived 2026-09-02 on the user's instruction with the four manual checks in
`context/foundation/manual-checks.md` (`## Przerzedzanie snapshotów kosztorysu`) still unticked — they
stay in the registry as open verification work, and the first-cron-run check can only be performed
after the deploy anyway.
