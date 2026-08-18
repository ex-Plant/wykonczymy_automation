# Fleet Module — Vehicles, Inspection Deadlines, Daily Reminder Digest

## Overview

A fleet register for the company cars, tracking five kinds of recurring deadline per vehicle and
mailing one daily digest when any of them approaches. Every piece of infrastructure it needs —
collections, forms, tables, mailer, cron, notification badge — already exists in this repo, so the
change is composition, not new plumbing.

## Current State Analysis

Nothing fleet-related exists. What exists and will be reused:

- **Collections + access**: `src/collections/cash-registers.ts` is the shape to copy — `read`/`create`/
  `update` = `isAdminOrOwnerOrManager`, `delete` = `isAdminOrOwner`, plus `makeRevalidateAfterChange` /
  `makeRevalidateAfterDelete` hooks from `src/hooks/revalidate-collection.ts`.
- **Migrations**: hand-written (`AGENTS.md` → Migrations). `src/migrations/20260815_0_add_kosztorys_client_view.ts`
  is the template, including the non-obvious `payload_locked_documents_rels` column every new
  collection owes — Payload's lock-check SELECT names a column per collection and throws without it.
- **Listing page**: `src/app/(frontend)/zgloszenia/page.tsx` — `requireAuth(MANAGEMENT_ROLES)` →
  `redirect('/')`, `PageWrapper`, a client data-table fed by a `src/lib/queries/*` read.
- **Cron**: `src/app/(payload)/api/cron/leads-reconcile/route.ts` — `isAuthorizedCronRequest`,
  `revalidateTag` (Route Handler context, never `updateTag`), a 500 on partial blindness so a
  half-broken run doesn't read as healthy in Vercel's log, and a best-effort failure alert.
- **Mail**: `payload.sendEmail({ to, subject, html })` via the nodemailer adapter configured in
  `src/payload.config.ts`. `src/lib/leads/notify.ts` shows the house style: a recipient from validated
  env, HTML assembled from small `row()` helpers, `escapeHtml` on every interpolated value.
- **Badge**: `src/lib/db/notifications.ts` carries `const LEADS_STREAM = 'leads'` with the comment
  _"The only notification stream so far. When a second one lands, promote to an `as const` map."_ —
  this change is that second stream.
- **Forms**: `useAppForm()` + a `<name>-schema.ts` sibling, per `src/components/forms/worker-form/`.
- **Env**: validated only through `src/lib/env/` — `serverEnv` for server-side reads, never raw
  `process.env`.

## Desired End State

`/flota` lists every company car, one row each, with five deadline columns coloured by urgency.
Opening a car shows its full inspection history and a button to record a new one. Recording an
inspection is one short form; the "next due" date is prefilled from the type's interval and
overwritable. Every morning a single email lands at `FLEET_NOTIFICATION_EMAIL` and `ADMIN_EMAIL`
listing only what actually needs attention — nothing on a quiet day. A nav badge marks unseen fleet alerts.

Verify by: seeding two vehicles with inspections at varying distances from today, running the cron
route locally with the cron secret, and confirming one digest arrives with the right rows in the
right sections — and that an immediate second run sends nothing.

### Key Discoveries

- `src/lib/db/notifications.ts:6` already anticipates a second stream — the `LEADS_STREAM` constant
  becomes an `as const` map, and `countUnreadLeads` / `markLeadsSeen` generalise over it.
- `src/lib/cache/tags.ts` is a flat `as const` map; two entries get appended.
- `MANAGEMENT_ROLES` (`src/lib/auth/roles.ts:14`) is exactly the OWNER/ADMIN/MANAGER set this module
  needs for page-level auth.
- The migration template's `payload_locked_documents_rels` note is the single most likely thing to be
  forgotten here, and its failure mode is a runtime throw on any admin-panel document view.

## What We're NOT Doing

- **No employee assignment** on the vehicle (explicitly dropped in brainstorming).
- **No periodic odometer readings.** Mileage is captured only as part of an inspection event.
- **No tyre inventory** — no sets, sizes, tread depth, or storage location. `TYRES` is a bare date.
- **No seasonal calendar logic** for tyres — the date is typed by hand like any other.
- **No AI intake.** The photo → OpenRouter → prefilled form path is step 2; this change only makes
  sure the schema it will populate exists.
- **No fuel, service history beyond these five types, costs reporting, or leasing.**
- **No Playwright spec.** The risk in this module is arithmetic (thresholds, dedupe), not clicking —
  that risk is covered by unit tests. Browser coverage is a manual check, not deferred debt.

## Implementation Approach

The deadline model is deliberately derivation-only: a vehicle stores no "last / next inspection"
fields. The current deadline for a (vehicle, type) pair is always `nextDueAt` of the newest event of
that type. This is what makes "already done" free — entering the new event moves the deadline and the
old one stops existing as current, so nothing needs an acknowledge flag.

All deadline arithmetic lives in `src/lib/fleet/`, React-free and free of Payload, so the cron and the
listing consume identical functions. That is the point of ordering Phase 2 before Phase 3: two
implementations of "what does the deadline mean" would drift, and the drift would be invisible until
a mail contradicted the screen.

**Inspection types and their prefill interval:**

| Type         | UI label (PL)        | Interval prefill | Notes                                       |
| ------------ | -------------------- | ---------------- | ------------------------------------------- |
| `TECHNICAL`  | Przegląd techniczny  | 12 months        |                                             |
| `INSURANCE`  | OC                   | 12 months        |                                             |
| `OIL_CHANGE` | Wymiana oleju        | 12 months        | also carries a kilometre target — see below |
| `WARRANTY`   | Przegląd gwarancyjny | 24 months        |                                             |
| `TYRES`      | Wymiana opon         | none             | date typed by hand, no prefill              |

The prefill is a suggestion, never authoritative: the real next date is printed on the document
(badanie techniczne, polisa OC), so the form offers it and the human overwrites it freely.

## Critical Implementation Details

**Dates are dates, not timestamps.** `performedAt` and `nextDueAt` are SQL `date` columns and Payload
`date` fields with `dayOnly` picker appearance. A timestamp column plus a `Europe/Warsaw` UI makes
"is this due today" answer differently depending on the hour, and the resulting off-by-one is the
classic way this kind of module goes subtly wrong. Day comparison in the cron happens against today's
date in `Europe/Warsaw`, resolved once per run and threaded through — never `new Date()` re-read
inside the loop.

**The oil kilometre alarm is edge-triggered, not polled.** We never know the current mileage, so the
km leg of the oil deadline cannot be evaluated on a schedule. It is evaluated when a _new odometer
reading arrives_ — which happens whenever any inspection of any type is recorded for that vehicle,
one to three times a year for free. That makes the alarm late-but-honest, and it must be documented
as such in the code, because "the cron didn't warn me about the oil" is otherwise a bug report.

**Dedupe uses two independent axes.** The date leg and the kilometre leg can each fire for the same
oil-change row, so they cannot share one bookkeeping column. See Phase 1's schema.

## Phase 1: Schema, Collections, Access

### Overview

The two tables, the two Payload collections, the type union with its interval map, cache tags, and
the env var. Nothing renders yet.

### Changes Required

#### 1. Migration

**File**: `src/migrations/20260818_1_add_fleet.ts` (+ registration in `src/migrations/index.ts`)

**Intent**: Create the two fleet tables and give Payload's lock-check the columns it needs, following
the hand-written migration convention.

**Contract**:

- `vehicles`: `id serial pk`, `registration text NOT NULL UNIQUE`, `make text NOT NULL`,
  `model text NOT NULL`, `year integer`, `vin text`, `status text NOT NULL DEFAULT 'ACTIVE'`,
  `updated_at` / `created_at timestamptz NOT NULL DEFAULT now()`.
- `vehicle_inspections`: `id serial pk`, `vehicle_id integer NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE`,
  `type text NOT NULL`, `performed_at date NOT NULL`, `next_due_at date`, `odometer integer`,
  `next_due_odometer integer`, `cost numeric(10,2)`, `note text`,
  `notified_threshold smallint`, `notified_at timestamptz`, `odometer_notified_at timestamptz`,
  timestamps as above.
- Index on `vehicle_inspections (vehicle_id, type, performed_at DESC)` — every deadline read is
  "newest row for this pair", and the listing does it once per vehicle per type.
- Attachments are a Payload upload relation, so the join table Payload expects for
  `vehicle_inspections.attachments` is created here too, mirroring how existing upload relations are
  laid out in earlier migrations.
- `payload_locked_documents_rels` gains `vehicles_id` and `vehicle_inspections_id` integer columns
  with `ON DELETE CASCADE` FKs and their indexes.
- `down()` drops both tables and both lock columns.

#### 2. Inspection type union and intervals

**File**: `src/lib/fleet/inspection-types.ts`

**Intent**: One place naming the five types, their Polish labels, and their prefill intervals — the
same "union in code, not an editable dictionary" call the transfer types make.

**Contract**: An exported `INSPECTION_TYPES` const array and a derived `InspectionTypeT`; a label map
keyed by type; an interval map keyed by type whose value is a month count or `null` for `TYRES`. The
`null` is meaningful — it is what the form reads to decide not to prefill — so it is a documented
member of the type, not an accident.

#### 3. Collections

**File**: `src/collections/vehicles.ts`, `src/collections/vehicle-inspections.ts` (+ registration in
`src/payload.config.ts`)

**Intent**: Standard Payload collections following `cash-registers.ts`: Polish labels, an admin group,
role access, and revalidation hooks.

**Contract**: `vehicles` uses `registration` as `useAsTitle`, `defaultColumns` registration / make /
model / status. `vehicle-inspections` relates to `vehicles`, exposes `type` as a select over the union
from step 2, and hides the three notification-bookkeeping fields from the admin UI — they are
machinery, not data anyone edits. Access on both: read/create/update `isAdminOrOwnerOrManager`, delete
`isAdminOrOwner`. Both get `makeRevalidateAfterChange` / `makeRevalidateAfterDelete` with the new tags.

#### 4. Cache tags

**File**: `src/lib/cache/tags.ts`

**Intent**: Register the two collections so the revalidation helpers have tags to bump.

**Contract**: `vehicles: 'collection:vehicles'` and `vehicleInspections: 'collection:vehicle-inspections'`.

#### 5. Env

**File**: `src/lib/env/schema.ts`

**Intent**: The digest recipient, validated like every other secret.

**Contract**: `FLEET_NOTIFICATION_EMAIL` and `ADMIN_EMAIL` as `z.string().min(1)` on the **server**
schema, mirroring `LEADS_NOTIFY_EMAIL`.

**Done up front (2026-08-18)**: both are in `.env` and on Vercel (Production + Preview, matching where
`LEADS_NOTIFY_EMAIL` lives — Development has neither). `FLEET_NOTIFICATION_EMAIL` points at
`bartek@wykonczymy.com.pl`, the same inbox as leads, until the owner wants the two split;
`ADMIN_EMAIL` is `admin@wykonczymy.com.pl`. The digest goes to **both** — see Phase 4.

### Success Criteria

#### Automated Verification

- Migration applies against the local DB: `pnpm payload migrate`
- Types regenerate without error: `pnpm generate:types`

#### Manual Verification

- Both collections appear in the Payload admin under the fleet group, and opening a vehicle document
  does not throw (the `payload_locked_documents_rels` check).
- A MANAGER can create and edit, but not delete, a vehicle.

---

## Phase 2: Deadline Logic (React-free, test-first)

### Overview

Every rule about what a deadline _is_ and when it _deserves an email_, as pure functions over plain
data. This phase is the one with real risk, and it is fully unit-testable, so it is written test-first.

### Changes Required

#### 1. Current deadline resolution

**File**: `src/lib/fleet/deadlines.ts`

**Intent**: Reduce a vehicle's inspection history to its current state: for each of the five types,
the newest event and the deadline it implies.

**Contract**: Given a vehicle's inspection rows, return one entry per type containing the newest
event (or `null`), its `nextDueAt`, and the distance travelled since the previous event of that same
type. The distance is `null` — never `0` — when either odometer reading is missing; a missing reading
and a genuinely stationary car are different facts and the UI must be able to tell them apart.

#### 2. Threshold classification

**File**: `src/lib/fleet/thresholds.ts`

**Intent**: Turn a due date plus today's date into the urgency bucket the digest groups by.

**Contract**: Buckets are `OVERDUE`, `1`, `7`, `30`, or none. Ordering is by urgency, with `OVERDUE`
strictly the most urgent, because the dedupe rule in step 3 is expressed as a comparison over this
order. Both inputs are dates in `Europe/Warsaw`, and today's date is a parameter — never read from the
clock inside the function, so the tests can pin it.

#### 3. Dedupe decision

**File**: `src/lib/fleet/should-notify.ts`

**Intent**: Decide whether a given inspection row earns a place in today's digest, so a deadline
generates at most four emails over its final month instead of thirty.

**Contract**: Two independent legs, each with its own bookkeeping column.

- _Date leg_: notify when the row has a bucket and either it has never been notified, or the current
  bucket is strictly more urgent than `notifiedThreshold`. Once overdue, re-notify when `notifiedAt`
  is more than 7 days old — an overdue deadline that goes quiet after one mail is worse than no mail.
- _Kilometre leg_ (`OIL_CHANGE` only): given the newest odometer reading known for the vehicle,
  notify when `nextDueOdometer` minus that reading is `<= 1000` (including negative, i.e. passed) and
  `odometerNotifiedAt` is unset. Once fired, it stays quiet until a newer oil change supersedes the
  row.

The function returns which legs fired, so the caller knows which columns to stamp. It writes nothing
itself.

#### 4. Missing-data detection

**File**: `src/lib/fleet/missing-data.ts`

**Intent**: Find the hole the deadline logic structurally cannot see — an active vehicle with no event
of a given type has no deadline, so the cron would never mention it.

**Contract**: Given active vehicles and their inspections, return the (vehicle, type) pairs with zero
events. Consumed only by the weekly section of the digest.

#### 5. Tests

**Files**: `src/__tests__/lib/fleet/deadlines.test.ts`, `thresholds.test.ts`, `should-notify.test.ts`,
`missing-data.test.ts`

**Intent**: Pin the arithmetic, since it is the only part of this module that can be wrong silently.

**Contract**: Cover — a type with no events at all; two events where the older one has the later
`nextDueAt` (newest-by-`performedAt` must win, not newest-by-due-date); each threshold boundary
exactly on its day and one day either side; a bucket that has already been notified at the same level
(silence) versus one that escalated (notify); overdue re-nagging at day 8 but not day 6; the oil km
leg firing at exactly 1000 km remaining, when already passed, and staying silent on a second run; a
mileage delta with one reading missing yielding `null`.

### Success Criteria

#### Automated Verification

- Fleet unit specs pass: `pnpm exec vitest run src/__tests__/lib/fleet`

#### Manual Verification

- None — this phase renders nothing.

---

## Phase 3: UI

### Overview

The listing, the vehicle detail page with history, and the two forms.

### Changes Required

#### 1. Reads

**File**: `src/lib/queries/fleet.ts`

**Intent**: Server reads for the listing and the detail page, shaped by the Phase 2 functions so the
screen and the email agree by construction.

**Contract**: One read returning every vehicle with its five resolved deadlines (listing), one
returning a single vehicle with its full inspection history ordered newest first. Both follow
`src/lib/queries/leads.ts` for caching and auth posture.

#### 2. Mutations

**File**: `src/lib/actions/fleet.ts`

**Intent**: Create/update a vehicle and record an inspection, through the house mutation pattern.

**Contract**: `protectedAction()` wrappers returning `ActionResultT`, with `updateTag()` on the two new
cache tags (server-action context — `updateTag`, not `revalidateTag`). Recording an inspection also
clears `odometerNotifiedAt` on the superseded oil row when a new `OIL_CHANGE` lands, so the next cycle
can alarm again.

#### 3. Forms

**Files**: `src/components/forms/vehicle-form/` and `src/components/forms/inspection-form/`
(each a `*-form.tsx` + `*-schema.ts` pair)

**Intent**: The two entry points, on `useAppForm()`.

**Contract**: Vehicle form — registration, make, model, year, VIN, status. Inspection form — vehicle,
type, performed date, next due date, odometer, next-due odometer (shown only for `OIL_CHANGE`), cost,
note, attachments. Choosing a type prefills the next-due date from the interval map and leaves it
editable; `TYRES` prefills nothing. The prefill must not fight the user: once the field is touched, a
later type change does not silently overwrite it.

#### 4. Pages and table

**Files**: `src/app/(frontend)/flota/page.tsx`, `src/app/(frontend)/flota/[id]/page.tsx`,
`src/components/fleet/fleet-data-table.tsx`, `src/components/fleet/inspection-history.tsx`

**Intent**: The screens, following the `/zgloszenia` shape.

**Contract**: `requireAuth(MANAGEMENT_ROLES)` → `redirect('/')` on both pages, `PageWrapper`, a client
data-table with one row per vehicle and five deadline columns. Each cell shows the due date and the
distance to it, coloured red when overdue, amber at 30 days or less, muted grey when there is no data
at all — the third state is distinct because "no data" is not "fine". Retired vehicles are visually
separated and excluded from urgency colouring. The detail page lists history grouped by type with the
mileage delta per entry.

#### 5. Navigation

**File**: `src/components/nav/top-nav.tsx`

**Intent**: Reach the module.

**Contract**: A "Flota" entry pointing at `/flota`, visible to `MANAGEMENT_ROLES`.

### Success Criteria

#### Automated Verification

- Fleet component/query specs pass: `pnpm exec vitest run src/__tests__/lib/queries/fleet.test.ts`

#### Manual Verification

- Adding a vehicle, then an inspection of each type, produces the expected five columns on the listing.
- Choosing `TECHNICAL` prefills next-due 12 months out; choosing `TYRES` leaves it empty; overwriting
  the prefilled date and then switching type does not clobber the typed value.
- A car with no oil-change entry shows grey "brak danych" in that column, not a false green.
- A retired vehicle is visibly set apart and carries no urgency colouring.

---

## Phase 4: Daily Digest

### Overview

The cron route, the email, and the schedule.

### Changes Required

#### 1. Sweep

**File**: `src/lib/fleet/reminder-sweep.ts`

**Intent**: Compose the Phase 2 functions into "what goes in today's mail", and stamp the bookkeeping
columns for what was sent.

**Contract**: Load active vehicles and their inspections; resolve deadlines; ask `should-notify` per
row; group survivors into overdue / ≤7 days / ≤30 days plus the kilometre-triggered oil rows. On
Mondays, also compute the missing-data pairs. Return the grouped result plus the rows to stamp. The
stamp is written **after** a successful send, never before — a mail that failed to leave must not mark
its deadline as announced, or the deadline goes silent for a week.

#### 2. Email template

**File**: `src/lib/fleet/notify.ts`

**Intent**: One digest, in the house style of `src/lib/leads/notify.ts`.

**Contract**: Sections in urgency order — po terminie / w ciągu 7 dni / w ciągu 30 dni — each a table
of registration, type label, due date, and days remaining; the kilometre-triggered oil rows carry
their own line explaining the reading they were judged against, since an alarm the reader can't
account for reads as a bug. The Monday-only "brak danych" section comes last. Every interpolated value
passes through `escapeHtml`. Recipients are **both** `serverEnv.FLEET_NOTIFICATION_EMAIL` and
`serverEnv.ADMIN_EMAIL`, as one message with two addresses in `to` — not two sends, so the dedupe
stamp still describes one delivery. Empty digest → the caller does not send at all.

#### 3. Cron route

**File**: `src/app/(payload)/api/cron/fleet-reminders/route.ts`

**Intent**: The scheduled entry point, shaped exactly like `leads-reconcile`.

**Contract**: `isAuthorizedCronRequest` gate returning 401; run the sweep; send when non-empty; stamp;
return `{ ok: true, sent, sections }`. A failure to load or send is logged with a
`// TODO(EX-449) SENTRY-REQUIRED:` marker and returns 500, so a dead reminder job reads as a failed
run in Vercel's cron log rather than a healthy no-op — which matters more here than anywhere, because
the module's whole value is a mail that arrives.

#### 4. Schedule

**File**: `vercel.json`

**Intent**: Run it daily, early enough to be read with morning coffee.

**Contract**: `{ "path": "/api/cron/fleet-reminders", "schedule": "0 5 * * *" }` — UTC, so roughly
07:00 local in summer and 06:00 in winter. The exact local hour does not matter; that the comparison
date is resolved in `Europe/Warsaw` does.

### Success Criteria

#### Automated Verification

- Sweep spec passes: `pnpm exec vitest run src/__tests__/lib/fleet/reminder-sweep.test.ts` — covering
  an empty day producing no send, a mixed day grouping rows into the right sections, and a second
  immediate run producing nothing.

#### Manual Verification

- With seeded deadlines at 45 / 30 / 7 / 1 / −3 days, one digest arrives containing exactly the last
  four, in the right sections. Re-running the route immediately sends nothing.
- Recording the inspection that a row was nagging about stops the nagging on the next run.
- The Monday-only missing-data section appears on a Monday and not on a Tuesday.

---

## Phase 5: Nav Badge

### Overview

The second notification stream the existing code was written to expect.

### Changes Required

#### 1. Generalise the stream

**File**: `src/lib/db/notifications.ts`

**Intent**: Promote the single `LEADS_STREAM` constant to the `as const` map its own comment asks for,
and generalise the count/mark helpers over it.

**Contract**: A `STREAMS` map with `leads` and `fleet`; the count and mark functions take a stream key.
The fleet count is the number of active deadlines currently in an urgency bucket that the user has not
seen since their cursor. Existing lead call sites keep working unchanged — this is a widening, not a
rewrite. The `LEADS_EPOCH` cursor-fallback trick is reused for `fleet` with its own epoch, so nobody
gets a startling badge count on rollout.

#### 2. Badge + action

**Files**: `src/lib/actions/notifications.ts`, `src/components/nav/unread-fleet-badge.tsx`

**Intent**: Surface the count next to the Flota nav entry, mirroring `unread-leads-badge.tsx`.

**Contract**: Same shape as the leads badge, pointing at `/flota`; opening the page advances the
`fleet` cursor.

### Success Criteria

#### Automated Verification

- Notification specs still pass after the widening: `pnpm exec vitest run src/__tests__/lib/db/notifications.test.ts`

#### Manual Verification

- A car crossing into the 30-day window raises the badge; opening `/flota` clears it.
- The leads badge still behaves exactly as before.

---

## Testing Strategy

### Unit Tests

The whole of Phase 2 plus the sweep — deadline resolution, threshold boundaries, dedupe on both legs,
overdue re-nagging, mileage deltas with missing readings, missing-data detection, empty-day silence.
These are pure functions with injected dates, so every case is a table row.

### Integration Tests

None beyond the sweep spec. The DB-backed layer here is ordinary Payload CRUD over two flat tables
with no cross-collection invariants, which the existing patterns already cover.

### Manual Testing Steps

1. Seed two vehicles; give one a full set of five inspections and the other only a technical one.
2. Confirm the listing colours: red / amber / grey in the right cells, second car grey in four columns.
3. Run the cron route locally with the cron secret; confirm the digest contents, then confirm an
   immediate re-run sends nothing.
4. Record the inspection the digest nagged about; confirm the next run is silent about it.
5. Retire a vehicle; confirm it drops out of the digest but keeps its history.

## Performance Considerations

Fleet size is tens of vehicles, so the sweep is a single query plus in-memory grouping; there is no
scale story to design for. The one index that matters is `(vehicle_id, type, performed_at DESC)`,
because both the listing and the sweep do "newest row per pair" once per vehicle per type.

## Migration Notes

Two new tables, no existing data touched, nothing to backfill. Per `AGENTS.md`, this is an **additive**
migration — it must be applied to prod **before** the code that reads the new tables is pushed, and a
human runs `pnpm db:migrate:prod`, never the agent.

## Whole-tree Gate

Run once, after Phase 5.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change identity and brainstormed decisions: `context/changes/2026-08-18-flota-przeglady/change.md`
- Cron + alert pattern: `src/app/(payload)/api/cron/leads-reconcile/route.ts`
- Mail style: `src/lib/leads/notify.ts`
- Collection + access shape: `src/collections/cash-registers.ts`
- Migration template incl. lock-table trap: `src/migrations/20260815_0_add_kosztorys_client_view.ts`
- Listing page shape: `src/app/(frontend)/zgloszenia/page.tsx`
- Notification stream, pre-marked for a second entrant: `src/lib/db/notifications.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, Collections, Access

#### Automated

- [x] 1.1 Migration applies against the local DB — 28d6923f
- [x] 1.2 Types regenerate without error — 28d6923f

### Phase 2: Deadline Logic

#### Automated

- [x] 2.1 Fleet unit specs pass — c6ffab6f

### Phase 3: UI

#### Automated

- [x] 3.1 Fleet query specs pass — 76f22c25

### Phase 4: Daily Digest

#### Automated

- [x] 4.1 Sweep spec passes

### Phase 5: Nav Badge

#### Automated

- [ ] 5.1 Notification specs still pass after the widening
