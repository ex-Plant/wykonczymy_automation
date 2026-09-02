# Review-gate ledger — snapshot-retention-thinning · 2026-09-02

Commit under review: `fca1ea2e` (19 files, base `staging`).

Checks dispatched: `/10x-impl-review`, `/code-review`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `comment-noise-audit` (flag-only).
Dropped: `tailwind-v4-audit` — the diff touches one `.tsx` and adds no styling. Step 0.5 (verification
pass) skipped — no `verify-manual-checks` skill installed, and the browser pass was not requested this turn.

## Findings

- [x] 🟡 WARNING · fixed · code-review + impl-review · `src/lib/kosztorys/snapshot-format.ts:72` ·
      The `??` fallbacks that stop a 23502 were dead branches under the strict `SnapshotPayloadT`, so
      the repo's dead-code rule (gate on a green typecheck) would sanction deleting the exact guards
      this slice exists to add — added `StoredSnapshotPayloadT`, which marks optional precisely the
      NOT NULL DEFAULT columns, and threaded it through every stored-payload reader.
      test: no automated test — the guarantee is a type; a spec cannot assert it, `tsc` does.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/append-preset-sections.ts:45` ·
      `appendPresetSections` feeds `insertItems` straight from `preset.payload.items` — a stored jsonb
      payload, same 23502 exposure as a restore — but never applied the defaults. Now maps through
      `itemWithColumnDefaults`, and the returned slice carries the filled items too.
      test: no automated test — covered by the existing `append-preset-sections.test.ts` path; the
      shape guarantee is the type. Filed as a gap only if a real pre-column preset ever surfaces.
- [x] 🟡 WARNING · dismissed · impl-review · `src/lib/kosztorys/restore-kosztorys.ts:50` ·
      Claim: with `settings` absent and `clearGlobalDiscount` false, `data` is `{}` and the
      `updatedAt` bump the grid remount depends on is short-circuited. FALSE — Payload stamps
      `updatedAt` on every update regardless of `data`
      (`node_modules/payload/dist/collections/operations/utilities/update.js:246`). Comment rewritten
      to say what is actually guaranteed instead of implying the write does it.
- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/lib/db/snapshots.test.ts` ·
      The weekly-band fixture used two rows on the SAME day (200d) plus one 7 days later, so a weekly
      DELETE that truncated by DAY would have passed identically. Added `insertInWeek`, anchored on
      `date_trunc('week', …)`, placing two rows on different days of one week.
      test: TDD · integration — the fixture IS the fix; green against the current sweep.
- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/lib/db/snapshots.test.ts` ·
      A manual row was asserted only in the weekly band, so a `kind = 'auto'` filter dropped from the
      DAILY DELETE stayed green. Added `manualInDailyBand` (40 days) and asserted it survives.
      test: TDD · integration — one manual fixture per band.
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/kosztorys/restore-kosztorys.ts` ·
      No regression guard for the case the `settings` guard exists for. Added
      `src/__tests__/lib/kosztorys/restore-missing-settings.test.ts` — restores a payload with the key
      DELETED and asserts the persisted tree plus the untouched live coefficients.
      test: test-driven-debugging · integration — asserts persisted state, not the action's result.
- [x] 🔵 OBSERVATION · fixed · comment-noise + impl-review · `src/lib/kosztorys/capture-auto-snapshot.ts:5`,
      `src/lib/actions/kosztorys-snapshots.ts:16,27`, `src/lib/kosztorys/replace-tree-with-snapshot.ts:14`,
      `src/components/kosztorys/editor/hooks/use-auto-snapshot.ts:7` · Four comments this commit made
      false: "unconditional" (the undo-revision gate landed in EX-701), "the idle-suppression check
      lands with S-07" (it already did), "capped at the newest 50 and swept after 7 days", "the count
      cap + daily GC still bound the table". All rewritten to the current policy.
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
- [x] fixed · comment-noise · `src/lib/db/snapshots.ts:16,102,120`,
      `src/app/(payload)/api/cron/cleanup/route.ts:8`,
      `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:120` · Duplicated prose:
      idempotence stated twice, the Warsaw rationale twice, a "first night after deploy" paragraph
      restating the manual check, and a 3-line comment justifying an unconditional dialog sentence.
      Trimmed to one statement each; the dialog comment deleted outright.
- [x] fixed · module-cohesion · `src/lib/kosztorys/snapshot-format.ts` · `itemWithColumnDefaults`
      lived in the `server-only` `insert-kosztorys-tree.ts`, which put the tolerance discharge out of
      reach of `build-catalogue-seed.ts` (a stored-payload reader that runs from a script). Moved next
      to the type that declares the tolerance; three readers now share it.
- [x] fixed · structure-scatter · `src/lib/kosztorys/insert-rows.ts:88` · `insertSections` demanded a
      full `KosztorysSectionT` while taking `displayOrder` separately, forcing an `as` cast at both
      call sites. Narrowed to `Omit<…, 'displayOrder'>`; both casts gone.
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

BLOCKED — the four manual checks in `context/foundation/manual-checks.md`
(`## Przerzedzanie snapshotów kosztorysu`) are unticked. The slice is **in review**, not archivable.
