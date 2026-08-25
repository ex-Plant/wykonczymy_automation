# Review-gate ledger — 2026-08-18-flota-przeglady (EX-711) · 2026-08-19

Scope: `staging...HEAD` — 58 files, 9 commits (`28d6923f`..`f7c34939`), plus the fixes applied by this gate.
Fan-out: 7 checks, all applicable, all returned. Step 0.5 skipped — no `verify-manual-checks` skill.
Note: `3f8a2f2e feat(inwestycje)` on this branch is another agent's commit; recorded in `change.md` as an
out-of-band inclusion rather than cherry-picked out.

## Findings

> **Trimmed at archive (2026-08-25).** Pre-trim tally: **36 fixed, 4 skipped, 11 dropped, 5 dismissed, 1 filed · 0 open**. The 36 fixed findings were removed — a fix's durable record is its commit and the code it left behind, both still readable. What survives below is the negative space git cannot hold: what was deliberately _not_ done, and why.

- [x] 🟡 WARNING · skipped · `code-review`,`impl-review` · `src/components/tables/investments.tsx:22` · `hasKosztorysReading` infers "no kosztorys" from `totalLaborCosts !== 0`, but that figure is _executed_ robocizna — a real kosztorys with przedmiar and no etap progress renders „brak danych" on five v2 columns. Real, but it is commit `3f8a2f2e`, another agent's in-flight work; surfaced to the user rather than edited under them.
      test: TDD · unit — owed with the fix in `shape-investments`, which already knows the truth (`kosztorysTotalsRecord[id] === undefined`).
- [x] 🔵 OBSERVATION · skipped · `code-review`,`impl-review` · `src/lib/actions/fleet.ts:28` · `updateVehicleAction` has no caller, so `RETIRED` is unreachable in-app and the only "remove this car" gesture is an admin Delete that cascades the inspection history. Real and worth doing, but it adds UI (an edit dialog) and changes what a user MAY DO — surfaced for your call rather than auto-applied.
      **Rozstrzygnięte 2026-08-24 (właściciel): potrzebna edycja pojazdu i wycofywanie.** `EditVehicleDialog` na karcie pojazdu wywołuje `updateVehicleAction`; „Wycofany" jest odtąd osiągalny po założeniu auta.
      test: no automated test · unit — `vehicle-update.test.ts` pilnuje PERSISTED stanu akcji (wycofanie, nietknięte znaczniki, odrzucona walidacja); samo okno to wiring bez logiki.
      Strażnik `beforeDelete` na `vehicles` **nie** wchodzi — nie był proszony; kasowanie w adminie dalej kaskaduje historię (osobna pozycja niżej).
      test: TDD · e2e — owed with whichever fix you pick (edit dialog, or a `beforeDelete` guard mirroring `preventDeleteWithTransactions`).
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/lib/env/schema.ts:34` · `FLEET_NOTIFICATION_EMAIL` and `ADMIN_EMAIL` ship as required, and `(frontend)/layout.tsx` imports `serverEnv` as the build gate — any Vercel env without them fails `next build` on merge. Not a code fix; recorded as a deploy prerequisite in `change.md`.
- [x] dismissed · `feature-first` · `src/lib/fleet/costs.ts:2` · imports the view type `InspectionHistoryEntryT` from `@/types/fleet`. Benign: `costs.ts` is a view aggregator whose only consumer is `vehicle-costs.tsx` — the view shape is genuinely its input, not a leak.
- [x] dismissed · `tailwind-v4-audit` · — · zero findings across all 15 touched files: no `var(--token)` in arbitrary classes, no inline styles, no arbitrary bracket values, no raw colour literals.
- [x] dropped · `feature-first` · `src/lib/fleet/days.ts` · generic Warsaw-day helpers filed under a feature, and `warsawToday()` shadows `lib/utils/date.ts`'s UTC `today()`. Every consumer today is fleet, so promoting it now is premature — revisit at the second feature that needs a Warsaw day.
- [x] dropped · `feature-first` · `src/lib/actions/notifications.ts:20`, `src/app/(frontend)/flota/page.tsx:19` · a read living in `lib/actions`, and a page writing straight to `lib/db`. Both are pre-existing conventions mirrored from the leads twin; changing them is a cross-cutting refactor, not this slice's.
- [x] dropped · `module-cohesion` · `src/lib/queries/fleet.ts` · still mixes pure shaping (`toRow`, `historyOfType`) with cached reads. Much reduced by moving the mapper out; the remainder is genuinely this query's view shape.
- [x] dropped · `impl-review` · `src/lib/queries/fleet.ts:135`, `src/lib/fleet/sweep-io.ts:29` · O(vehicles × events) per-vehicle filter. The plan explicitly declares "tens of vehicles, no scale story to design for".
- [x] dropped · `tailwind-v4-audit`,`comment-noise` · `src/components/nav/sidebar.tsx:48,53,98` · `lg:flex` at 1280 and two layout-narration comments — all pre-existing (2026-03), untouched by this slice.

- [x] skipped · `simplify` · `src/components/forms/inspection-form/inspection-form.tsx:82` · the upload-then-create + orphan-discard block is now a **fourth** copy (`edit-transfer-form.tsx:93`, `expense-form.tsx:178`, `hooks/use-invoice-upload.ts`). Extracting `withInvoiceUpload(files, action)` is right, but it rewrites the submit path of two money-entry forms — a review-worthy refactor, not a gate edit.
- [x] dismissed · `simplify` · `src/lib/fleet/map-inspection.ts:4` · `asId` duplicates `resolveId` in `lib/utils`. Not taken: `resolveId` returns `number | undefined`, so reusing it costs an `as number` at the one call site — trading a total function for a cast to save two lines. Comment now records why.
- [x] dismissed · `simplify` · `src/components/fleet/deadline-cell.tsx:25` · „two checks for one fact". They are not: `daysLeft` is independently nullable in `FleetDeadlineT` (the table sorts on it), and dropping either narrowing fails `tsc`. Verified by making the change and reverting it.
- [x] dismissed · `simplify` · `src/components/nav/sidebar.tsx:72` · Flota hand-wired instead of going through `SECTION_LINKS.badge`. `SECTION_LINKS` has no role gate, and every role-gated link (Kosztorysy, Pracownicy, Raporty) is hardcoded identically — the new entry matches its neighbours; generalising is a nav-wide change.
- [x] dropped · `simplify` · `src/lib/fleet/deadlines.ts:29`, `queries/fleet.ts:136` · ~13 filter+sort passes over an already-sorted array per listing row. Removing the sorts makes these pure helpers depend on caller ordering — a silent footgun — and the dataset is tens of events. The duplicate `kmSinceOilChange` recompute and the three hand-rolled group-bys were closed by the shared loader anyway.
- [x] dropped · `simplify` · `src/lib/fleet/sweep-io.ts:50` · `stampNotified` fires one `payload.update` per stamp, each triggering `revalidateTag` for one logical change. Batching means a raw-SQL `UPDATE … FROM (VALUES …)` in `lib/db` for a handful of rows once a day.
- [x] dropped · `simplify` · `src/components/nav/unread-fleet-badge.tsx:23` · two badges = two server actions per navigation. Merging them into one `getUnreadCounts()` couples the two streams' fetch lifecycles to save one query on a nav change.
- [x] dropped · `simplify` · `src/lib/fleet/reminder-sweep.ts:38` · `FleetDigestT` mixes the message with the write-back ledger. Splitting the return is churn across the route, the mailer and the specs for one `isEmptyDigest` line.
- [x] dropped · `simplify` · `src/components/forms/inspection-form/inspection-form.tsx:76` · `lockedVehicleId` exists because both dialogs share `formId="add-inspection"`, so a draft can restore the wrong car. Distinct form ids would delete the merge branch — but sharing the draft across the two entry points may well be deliberate, and it is behaviour, not shape.
- [x] dropped · `simplify` · `src/components/fleet/inspection-history.tsx:35` · conditional column tracks via two `...(cond ? [x] : [])` spreads. Cosmetic.

- [x] filed · `slice-review-gate` · `e2e/` · the slice is browser-level and ships with no Playwright spec — six paths the unit layer structurally cannot reach (shared draft identity across the two dialogs, the type→prefill→hidden-field chain, the odometer warning, the upload error path, the three deadline states + urgency sort, and the badge clearing from either entry point). Not authored here: an E2E run is ~1h and is never started unprompted — filed EX-716 (`e2e-backlog`).
      test: TDD · e2e — filed EX-716

## Simplify pass

Ran `/simplify` (reuse · simplification · efficiency · altitude, four agents in parallel) —
**13 applied, 5 dropped, 3 dismissed, 3 skipped**; each folded into `## Findings` above, tagged
`simplify`. Two agents independently caught the `beforeChange` patch regression this gate itself had
introduced, which is the one finding that would have shipped a broken digest.

What the altitude pass judged **correct and told us not to churn**, recorded so a later reviewer
doesn't re-litigate it: the two-leg `should-notify` design (polled date vs edge-triggered km — two
bookkeeping columns is the right depth, not a special case); the collection hook as the home for the
bookkeeping reset (there IS no update action, so the action layer cannot see an admin edit — fix it
in the hook, don't move it); `vehicle-detail-tabs` local state (both views are folds of data already
on the page, so a URL param buys a round trip); the two-stream badge SQL staying as two queries
(leads count creation events, deadlines have none and must date off `next_due_at − 30d`); and
`thresholds.ts` encoding buckets as day counts so „which bucket", „how urgent" and „already
announced" collapse onto one orderable integer.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm lint` — no new findings in the slice's files (25 pre-existing repo-wide errors, all in
  `test.js` and older migrations, untouched).
- `pnpm exec vitest run src/__tests__/lib/fleet src/__tests__/lib/queries/fleet.test.ts
src/__tests__/components` — 30 files, 229 tests, green.
- Full suite (`typecheck && lint && test && test:e2e && build`) — **not run**; the e2e leg is ~1h and
  is never started unprompted.
- **E2E owed.** This slice is browser-level and has no Playwright spec. Not authored here — filed to
  the E2E backlog as EX-716.

**Po rozstrzygnięciu 2026-08-24** (edycja pojazdu + ingest załączników):

- `pnpm typecheck` — clean. `pnpm lint` — clean on the three touched files.
- `pnpm exec vitest run` (full unit suite) — 184 files / 2614 tests green, 45 files / 147 skipped.
- `vehicle-update.test.ts` + `vehicle-flags.test.ts` against `db-test` (5435) — 6/6 green. The test DB
  needed `pnpm db:migrate:test` first: `20260819_1_add_service_type_and_vehicle_flags` lives on this
  branch and had never been applied there.
- Full suite **with `DB_POSTGRES_URL` pointed at 5435** (so the DB-backed specs actually run) — 229
  files / 2761 tests, 3 files failing on `column "hidden_columns" does not exist`
  (`kosztorys-client-view`, `share-token`, `preview-kosztorys-token`, `investment-render-parity-db`).
  **Not this branch's doing**: `db-test` carries staging's `20260824_0_drop_kosztorys_client_view_hidden_columns`
  while this branch is 37 commits behind and still selects the dropped column. It clears on rebase; no
  fleet spec is among them.

## Close-out

**23 fixed · 1 filed · 5 dismissed · 8 dropped · 3 skipped · 0 open.**

The two findings that were held back for the owner's decision are **rozstrzygnięte (2026-08-24)** and
both landed:

1. **„Potrzebujemy edycję pojazdu i wycofywanie."** `EditVehicleDialog`
   (`src/components/dialogs/edit-vehicle-dialog.tsx`) sits on the vehicle page next to „Dodaj
   przegląd" and calls the previously caller-less `updateVehicleAction`, so „Wycofany" is reachable
   after a car is created. Guard: `src/__tests__/lib/actions/vehicle-update.test.ts` (DB-backed,
   asserts the persisted row — retirement, the untouched „do wymiany" map, and a rejected payload
   writing nothing).
   The **`beforeDelete` guard on `vehicles` was NOT taken** — it wasn't asked for. Deleting a car in
   `/admin` still cascades its whole inspection history (`ON DELETE cascade`), and nothing in the app
   offers that gesture, so the exposure is admin-only. If it ever needs closing, mirror
   `preventDeleteWithReferences`.
2. **Ingest moved to pick time.** `inspection-form.tsx` now runs `ingestFiles` +
   `reportBlockedFiles` when the file is chosen (mirroring `use-invoice-upload.ts`), so a HEIC is
   decoded and an oversize file is refused with a message instead of silently failing at submit. It
   needed a busy state to be correct: without one a submit fired mid-conversion saves the przegląd
   with no załącznik. `FormFooter` and `FileInput` are disabled while ingesting, and the `action`
   wrapper re-checks — a keyboard Enter bypasses the disabled button.

**Expected outcome: in review, not archive.** ~28 EX-711 manual checks in
`context/foundation/manual-checks.md` are unticked, and manual checks are a hard blocker for Done.

**Human-owned before the push** (agent does neither):

- Set `FLEET_NOTIFICATION_EMAIL` and `ADMIN_EMAIL` on Vercel preview + prod. Both are required in
  `env/schema.ts` and `(frontend)/layout.tsx` imports `serverEnv` as the build gate, so a deploy
  without them fails `next build`.
- EX-711's migration is **additive** → migrate prod (`pnpm db:migrate:prod`) BEFORE pushing the code.
