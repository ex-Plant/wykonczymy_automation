# Review-gate ledger — 2026-08-18-flota-przeglady (EX-711) · 2026-08-19

Scope: `staging...HEAD` — 58 files, 9 commits (`28d6923f`..`f7c34939`), plus the fixes applied by this gate.
Fan-out: 7 checks, all applicable, all returned. Step 0.5 skipped — no `verify-manual-checks` skill.
Note: `3f8a2f2e feat(inwestycje)` on this branch is another agent's commit; recorded in `change.md` as an
out-of-band inclusion rather than cherry-picked out.

## Findings

- [x] 🟡 WARNING · fixed · `code-review` · `src/components/forms/inspection-form/inspection-form.tsx:81` · attachment upload had no `try/catch` — a partial batch threw out of `submit()` (no toast, dialog frozen) and leaked uploaded pages in Blob. Now mirrors `edit-transfer-form.tsx:96-105`: catch → `discardOrphanedUploads(err.uploadedIds)` → `{success:false}`, plus discard on a failed create.
      test: no automated test · — client-side upload error path has no seam short of an E2E; covered by the manual-checks entry added below.
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/fleet/should-notify.ts:69` · `odometerNotifiedAt` was never cleared, so correcting a mistyped „Następna wymiana przy (km)" silenced that row's mileage alarm for the life of the oil change. Added `resetNotificationBookkeeping` + a `beforeChange` hook on `vehicle-inspections` clearing the stamps whose announced figure changed (both axes).
      test: TDD · unit — `src/__tests__/lib/fleet/reset-notification-bookkeeping.test.ts`, 6 cases incl. the corrected-target repro.
- [x] 🟡 WARNING · skipped · `code-review`,`impl-review` · `src/components/tables/investments.tsx:22` · `hasKosztorysReading` infers "no kosztorys" from `totalLaborCosts !== 0`, but that figure is _executed_ robocizna — a real kosztorys with przedmiar and no etap progress renders „brak danych" on five v2 columns. Real, but it is commit `3f8a2f2e`, another agent's in-flight work; surfaced to the user rather than edited under them.
      test: TDD · unit — owed with the fix in `shape-investments`, which already knows the truth (`kosztorysTotalsRecord[id] === undefined`).
- [x] ⚠️ WARNING · fixed · `impl-review`,`code-review` · `src/components/tables/fleet.tsx:41` · `sortUndefined: 'last'` was a no-op — the accessor returned `number | null` and table-core tests `=== undefined`, so "brak danych" sorted as _most_ urgent, inverting the comment's intent. Accessor now yields `?? undefined`.
      test: no automated test · — TanStack sort wiring; asserting it would test the library, not the code.
- [x] ⚠️ WARNING · fixed · `impl-review` · `src/components/forms/inspection-form/inspection-form.tsx:91` · hidden `nextDueOdometer` shipped anyway — a TECHNICAL row could persist an oil target (repeat of `lessons.md:1094`). The type listener now clears it for every non-`OIL_CHANGE` type.
      test: no automated test · — form-state wiring; the persisted-lie consequence is guarded one layer down by `odometerLegFires`' type check.
- [x] ⚠️ WARNING · fixed · `impl-review`,`code-review` · `src/lib/fleet/sweep-io.ts:8` · the digest loader read `limit: 500` / `5000` with no completeness guard, unlike its query-layer twin — past the cap the sweep silently stops warning and still answers `ok: true`. Both reads now wrapped in `assertCompletePage`.
      test: no automated test · — `assertCompletePage` has its own coverage; this is a call-site parity fix.
- [x] ⚠️ WARNING · fixed · `impl-review` · `src/lib/db/notifications.ts:70` · badge judged the 30-day window against Postgres `now()` (UTC) while every other clock read goes through `warsawToday()` — badge and listing disagreed for the last two hours of every day. The Warsaw day is now threaded in as a bound param from `lib/actions/notifications.ts`.
      test: no automated test · — the SQL has no unit seam; a DB spec is filed below with the finding it shares.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/db/notifications.ts:74` · a deadline _entered_ already inside the 30-day window (a policy recorded today, expiring in five days) had a window-entry instant older than any cursor, so the most urgent thing in the fleet could never reach the badge. Entry instant is now `GREATEST(next_due_at - 30d, created_at)`.
      test: no automated test · — see the open box below; this SQL owes a DB spec alongside the leads twin.
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `src/app/(frontend)/flota/[id]/page.tsx` · the detail page never called `markSeen` while the badge hid on any `/flota*` path, so arriving from the digest mail onto one car restored the same unread count. It now marks seen like the listing does.
      test: no automated test · — one call added to an existing, already-exercised path.
- [x] 🔵 OBSERVATION · fixed · `impl-review`,`code-review` · `src/lib/fleet/sweep-io.ts:44` · `stampNotified` used `Promise.all`, so one rejected update made the route answer 500 on a digest that was delivered — indistinguishable in the cron log from "nothing was sent". Now `Promise.allSettled`, returning the failed ids; the route logs them under the `TODO(EX-449) SENTRY-REQUIRED:` marker and returns `200 { stampFailures }`.
      test: no automated test · — Payload-bound I/O with no seam; the data outcome was already safe, only the reporting changed.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/dialogs/add-inspection-dialog.tsx:22` · `prefillNextDue` was wired only to the type field's `onChange`, so the dialog's default `TECHNICAL` — the most common case — opened with no suggested „Następny termin". The default value now carries the 12-month prefill.
- [x] 🔵 OBSERVATION · skipped · `code-review`,`impl-review` · `src/lib/actions/fleet.ts:28` · `updateVehicleAction` has no caller, so `RETIRED` is unreachable in-app and the only "remove this car" gesture is an admin Delete that cascades the inspection history. Real and worth doing, but it adds UI (an edit dialog) and changes what a user MAY DO — surfaced for your call rather than auto-applied.
      **Rozstrzygnięte 2026-08-24 (właściciel): potrzebna edycja pojazdu i wycofywanie.** `EditVehicleDialog` na karcie pojazdu wywołuje `updateVehicleAction`; „Wycofany" jest odtąd osiągalny po założeniu auta.
      test: no automated test · unit — `vehicle-update.test.ts` pilnuje PERSISTED stanu akcji (wycofanie, nietknięte znaczniki, odrzucona walidacja); samo okno to wiring bez logiki.
      Strażnik `beforeDelete` na `vehicles` **nie** wchodzi — nie był proszony; kasowanie w adminie dalej kaskaduje historię (osobna pozycja niżej).
      test: TDD · e2e — owed with whichever fix you pick (edit dialog, or a `beforeDelete` guard mirroring `preventDeleteWithTransactions`).
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/lib/env/schema.ts:34` · `FLEET_NOTIFICATION_EMAIL` and `ADMIN_EMAIL` ship as required, and `(frontend)/layout.tsx` imports `serverEnv` as the build gate — any Vercel env without them fails `next build` on merge. Not a code fix; recorded as a deploy prerequisite in `change.md`.
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `src/lib/fleet/notify.ts:10` + `src/components/fleet/deadline-cell.tsx:14` · `daysLabel` duplicated byte-for-byte between the mail and the cell — the exact "mail contradicts the screen" drift the phase order was designed to prevent. Hoisted to `src/lib/fleet/deadline-label.ts`.
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `context/changes/2026-08-18-flota-przeglady/plan.md:96` · the plan asserted SQL `date` columns; the migration shipped `timestamptz` (correct — the DB's day-only convention, enforced by `toWarsawDay`). Plan amended so the archived doc stops teaching the opposite.
- [x] fixed · `module-cohesion`,`structure-scatter`,`feature-first`,`impl-review` · `src/lib/fleet/reminder-sweep.ts:13` · the pure domain tier imported `toInspectionEvent` from the Payload-bound query layer, which booted the whole Payload config (and a Nodemailer connection attempt) before a single assertion in the sweep spec. Mapper moved to `src/lib/fleet/map-inspection.ts`; its spec moved to the matching mirror path.
- [x] fixed · `module-cohesion`,`feature-first` · `src/lib/fleet/reminder-sweep.ts` · pure digest logic and Payload I/O in one module, against the `lib/leads/` per-file precedent. `loadFleetHistories` / `stampNotified` split out to `src/lib/fleet/sweep-io.ts`.
- [x] fixed · `module-cohesion`,`feature-first` · `src/lib/fleet/inspection-types.ts` · grab-bag: vehicle status lived in a file named for inspection types, and the two `OIL_*_KM` thresholds had a competing home in the sibling `thresholds.ts`. Split into `vehicle-status.ts`; the thresholds moved to `thresholds.ts`.
- [x] fixed · `module-cohesion` · `src/lib/fleet/missing-data.ts:10` · `VehicleHistoryT` declared twice (exported in `reminder-sweep.ts`, re-declared privately here). One declaration, now in `src/lib/fleet/types.ts`.
- [x] fixed · `feature-first` · `src/lib/fleet/notify.ts:4` · `escapeHtml` reached into `@/lib/leads/` from a sibling feature. Promoted to `src/lib/utils/escape-html.ts`; both leads call sites repointed.
- [x] fixed · `code-review` · `src/lib/fleet/inspection-types.ts:58` · `isInspectionType` had no caller — deleted.
- [x] fixed · `comment-noise` · `src/components/fleet/vehicle-costs.tsx:19` · doc comment narrated the render order — deleted.
- [x] fixed · `comment-noise` · `src/lib/fleet/days.ts:34`, `api/cron/fleet-reminders/route.ts:14`, `(frontend)/flota/page.tsx:16`, `src/lib/db/notifications.ts:80` · four comments restated their own symbol; trimmed to the part the code cannot say.
- [x] dismissed · `feature-first` · `src/lib/fleet/costs.ts:2` · imports the view type `InspectionHistoryEntryT` from `@/types/fleet`. Benign: `costs.ts` is a view aggregator whose only consumer is `vehicle-costs.tsx` — the view shape is genuinely its input, not a leak.
- [x] dismissed · `tailwind-v4-audit` · — · zero findings across all 15 touched files: no `var(--token)` in arbitrary classes, no inline styles, no arbitrary bracket values, no raw colour literals.
- [x] dropped · `feature-first` · `src/lib/fleet/days.ts` · generic Warsaw-day helpers filed under a feature, and `warsawToday()` shadows `lib/utils/date.ts`'s UTC `today()`. Every consumer today is fleet, so promoting it now is premature — revisit at the second feature that needs a Warsaw day.
- [x] dropped · `feature-first` · `src/lib/actions/notifications.ts:20`, `src/app/(frontend)/flota/page.tsx:19` · a read living in `lib/actions`, and a page writing straight to `lib/db`. Both are pre-existing conventions mirrored from the leads twin; changing them is a cross-cutting refactor, not this slice's.
- [x] dropped · `module-cohesion` · `src/lib/queries/fleet.ts` · still mixes pure shaping (`toRow`, `historyOfType`) with cached reads. Much reduced by moving the mapper out; the remainder is genuinely this query's view shape.
- [x] dropped · `impl-review` · `src/lib/queries/fleet.ts:135`, `src/lib/fleet/sweep-io.ts:29` · O(vehicles × events) per-vehicle filter. The plan explicitly declares "tens of vehicles, no scale story to design for".
- [x] dropped · `tailwind-v4-audit`,`comment-noise` · `src/components/nav/sidebar.tsx:48,53,98` · `lg:flex` at 1280 and two layout-narration comments — all pre-existing (2026-03), untouched by this slice.

- [x] 🔴 CRITICAL · fixed · `simplify` · `src/collections/vehicle-inspections.ts:20` · **regression introduced by this gate's own `beforeChange` fix.** Payload hands a collection `beforeChange` the RAW PATCH, unmerged (`payload/dist/collections/operations/utilities/update.js:117-125` — the merge with `originalDoc` happens later, in the field hooks). `stampNotified` writes only the three `notified*` fields, so every announced figure arrived `undefined`, the reset read that as "cleared", and the spread erased the stamp in the same write — the digest would re-announce every deadline every day, forever. Two agents flagged it independently; verified in Payload's source before fixing. The helper now takes a patch: a field is compared only when `field in patch`.
      test: test-driven-debugging · unit — the spec case that encoded the wrong reading ("undefined as null") is replaced by two: an explicit `null` still clears, and a patch naming no announced figure clears nothing.
- [x] fixed · `simplify` · `src/lib/fleet/sweep-io.ts:8` + `src/lib/queries/fleet.ts:32` · three agents converged: the sweep and the query layer ran two copies of the same two `payload.find` calls (same limits, `depth: 0`, `overrideAccess`, `assertCompletePage`, mapper, per-vehicle regroup) differing only in caching. Whichever one someone edits, the digest mail and the screen quietly stop describing the same fleet — and "the mail can never word a figure differently from the screen" is this module's whole premise. Extracted `src/lib/fleet/dataset.ts`: `loadFleetDataset(payload)` (takes `payload` instead of importing `@payload-config`, which is what let the sweep share it) + a generic `groupByVehicle`; `getFleetDataset` is now just its `unstable_cache` wrapper. The sweep also gains the `sort: '-performedAt'` it was missing.
- [x] fixed · `simplify` · `src/lib/fleet/deadlines.ts:4` · `TypeDeadlineT` carried three fields that were dead or derived: `type` restated the record key, `nextDueAt` was `latest?.nextDueAt`, and `kmSincePrevious` was computed for all five types on every vehicle and read by **nobody** (`historyOfType` computes its own). Collapsed to `latestByType(events) → Record<type, event | null>`; the three specs that only exercised the unread field went with it.
- [x] fixed · `simplify` · `src/components/nav/unread-fleet-badge.tsx` · near-verbatim clone of `unread-leads-badge.tsx` — same effect, role gate, on-page short-circuit, `result.success ? … : 0` — differing in a path constant and a fetcher. Both are now one-line wrappers over `UnreadStreamBadge({ path, fetchCount })`; a third stream no longer copies the file.
- [x] fixed · `simplify` · `src/lib/fleet/reminder-sweep.ts:124` · `oilTarget` was a hand-copied mirror of the target logic in `should-notify.ts` — the comment said so out loud. Exported from `should-notify.ts`; deciding and announcing now read one target. The two warn distances stay different on purpose, and the comment now says why (a typed target is a commitment, a derived one a guess).
- [x] fixed · `simplify` · `src/lib/fleet/deadline-label.ts:6,8` · rendered „za 1 dni" / „za 2 dni" — `pluralize` in `src/lib/utils/polish-plural.ts` exists for exactly this and its own comment names the bug class.
- [x] fixed · `simplify` · `src/lib/queries/fleet.ts:94`, `:172`, `deadlines.ts:26` · three `Object.fromEntries(...) as Record<…>` casts building the same per-type record. One `byInspectionType(valueOf)` in `inspection-types.ts`; all three casts gone.
- [x] fixed · `simplify` · `src/components/tables/fleet.tsx:55` · the vehicle status badge was inlined from `investment-status-badge.tsx`'s class-map shape while `flota/[id]/page.tsx` printed the bare label. One `VehicleStatusBadge`, both sites.
- [x] fixed · `simplify` · `src/lib/fleet/costs.ts:39` · `summariseCosts` rescanned the costed list once per type after `flatMap` had already grouped it, reduced the whole list again for the total, and spread a freshly-built local before sorting it. One `groupInOrder` pass; the total sums the buckets.
- [x] fixed · `simplify` · `src/lib/fleet/notify.ts:11` · three section builders repeated the empty-check, the `.map().join('\n      ')` and the heading wrapper — the triplicated indent literal is what made them read as copy-paste. One `section(title, entries, tag, row, lead)`.
- [x] fixed · `simplify` · `src/lib/queries/fleet.ts:22` + `src/types/fleet.ts:16` · the same shapes spelled twice: the mapper's return type vs `FleetDatasetT['events']`, and `FleetRowT` re-listing all five `VehicleSummaryT` fields. Named once as `InspectionRecordT` / `VehicleRecordT` in `lib/fleet/types.ts`.
- [x] fixed · `simplify` · `src/components/forms/inspection-form/inspection-form.tsx:126` · an IIFE computing one value; `optionalNumber` (line 46) already returns `undefined` for blank, so the `Number.isFinite` guard collapsed. Two plain consts.
- [x] fixed · `simplify` · `src/__tests__/lib/fleet/missing-data.test.ts:6`, `reminder-sweep.test.ts:12` · the same `vehicle()` factory written twice (and a `history()` beside it) while both files already imported the sibling `event()` from `__tests__/helpers/fleet.ts`. Moved there.
- [x] skipped · `simplify` · `src/components/forms/inspection-form/inspection-form.tsx:82` · the upload-then-create + orphan-discard block is now a **fourth** copy (`edit-transfer-form.tsx:93`, `expense-form.tsx:178`, `hooks/use-invoice-upload.ts`). Extracting `withInvoiceUpload(files, action)` is right, but it rewrites the submit path of two money-entry forms — a review-worthy refactor, not a gate edit.
- [x] fixed · `simplify` · `src/components/forms/inspection-form/inspection-form.tsx:82` · this call site skipped the `ingestFiles` / `reportBlockedFiles` pair that `use-invoice-upload.ts` runs alongside `resolveInvoicePageIds`, so an inspection attachment got no HEIC conversion and no blocked-file message. **Rozstrzygnięte 2026-08-24: ingest przeniesiony na moment WYBORU pliku**, wzorem `use-invoice-upload.ts` i `use-invoice-ingest.ts` — plus busy state, bo bez niego submit w trakcie konwersji HEIC zapisywał przegląd bez załącznika. Submit jest blokowany w `FormFooter` i sprawdzany ponownie w `action` (Enter omija przycisk).
      test: no automated test · e2e — HEIC → konwersja i plik >4 MB → komunikat to ryzyko przeglądarkowe; dopisane do rejestru manual-checks, spec do EX-716.
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
  needed `pnpm db:migrate:test` first: `20260819_0_add_service_type_and_vehicle_flags` lives on this
  branch and had never been applied there.

## Close-out

**21 fixed · 1 filed · 5 dismissed · 8 dropped · 3 skipped · 0 open.**

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
