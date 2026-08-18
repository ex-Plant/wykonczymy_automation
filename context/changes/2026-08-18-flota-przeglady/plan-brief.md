# Fleet Module — Plan Brief

> Full plan: `context/changes/2026-08-18-flota-przeglady/plan.md`
> Decisions record: `context/changes/2026-08-18-flota-przeglady/change.md`
> Linear: EX-711

## What & Why

The company cars have five recurring deadlines each — badanie techniczne, OC, oil change, warranty
inspection, tyre change — and nothing tracks them. A missed OC is a legal and financial problem, and
today the only defence is somebody remembering. This adds a register for those deadlines and one
daily email that names whatever is coming up.

## Starting Point

Nothing fleet-related exists, but every ingredient does: Payload collections with role access, the
`useAppForm()` form stack, TanStack tables in listings, a configured nodemailer adapter, a working
cron pattern (`leads-reconcile`), and a notification-badge helper whose own code comment says it is
waiting for a second stream. The change is composition, not plumbing.

## Desired End State

`/flota` lists every car with five deadline columns coloured by urgency. Opening a car shows its full
history; one short form records a new inspection, with the next-due date prefilled from the type's
interval and freely overwritable. Each morning a single digest reaches `FLEET_NOTIFICATION_EMAIL` and
`ADMIN_EMAIL` listing only what needs attention — and nothing at all on a quiet day.

## Key Decisions Made

| Decision         | Choice                                                                   | Why                                                                                                                                                   | Source     |
| ---------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Deadline driver  | Dates, not mileage                                                       | Nobody will enter odometer readings on a schedule; a mileage model would be fed by fiction                                                            | Brainstorm |
| Next-due date    | Typed by hand, prefilled from a per-type interval                        | The truth is printed on the document; a computed date would silently lie on the two-year warranty                                                     | Brainstorm |
| Storage shape    | Event table; no last/next fields on the vehicle                          | Derivation makes "already done" free — the new event moves the deadline, so no acknowledge flag exists to forget                                      | Brainstorm |
| Inspection types | Fixed union of five, not an editable dictionary                          | Mirrors the transfer-type union; a type-management UI is a module nobody asked for                                                                    | Plan       |
| Tyres            | Bare date, no interval, no seasonal logic                                | The ask was literally "wpisać termin, żeby szło przypomnienie" — anything more is invented scope                                                      | Plan       |
| Oil change       | Date target **and** kilometre target                                     | It genuinely runs on mileage; the km leg is evaluated whenever any inspection contributes a fresh odometer reading, so it costs nobody any extra work | Plan       |
| Email cadence    | One digest per day, nothing on empty days                                | Per-event mail at ~10 cars × 5 types is spam that stops being read; a mail that always arrives stops being read too                                   | Brainstorm |
| Recipients       | `FLEET_NOTIFICATION_EMAIL` + `ADMIN_EMAIL` from env, one send            | Mirrors `LEADS_NOTIFY_EMAIL`; immune to someone adding an account and suddenly receiving fleet mail. Two addresses on one mail, not two sends         | Owner      |
| Dedupe           | `notifiedThreshold` + `notifiedAt`, plus a separate `odometerNotifiedAt` | Without it one deadline sends thirty mails; the two legs fire independently so they cannot share a column                                             | Plan       |
| Access           | Read/write OWNER/ADMIN/MANAGER, delete OWNER/ADMIN                       | Same posture as cash registers                                                                                                                        | Brainstorm |
| Tests            | Unit on the arithmetic, no Playwright spec                               | The risk is threshold/dedupe maths, not clicking; a CRUD E2E would cost an hour per run to re-verify existing patterns                                | Plan       |

## Scope

**In scope:** `vehicles` + `vehicle_inspections` collections and migration · deadline/threshold/dedupe
logic with unit tests · `/flota` listing and vehicle detail · vehicle and inspection forms with
attachments · daily cron + digest email · weekly missing-data section · nav badge on a second
notification stream.

**Out of scope:** employee assignment · periodic odometer readings · tyre inventory (sets, sizes,
tread) · seasonal tyre calendar · AI photo intake (step 2) · fuel, leasing, cost reporting · Playwright
spec.

## Architecture / Approach

Vehicles hold identity only; every deadline is derived from the newest inspection event of that type.
All the arithmetic lives in `src/lib/fleet/` as React-free, Payload-free pure functions with injected
dates, and both consumers — the listing and the cron — call the same ones. That shared core is why
Phase 2 lands before the UI: two implementations of "what the deadline means" would drift, and the
drift would only surface as an email contradicting the screen.

## Phases at a Glance

| Phase             | What it delivers                                                            | Key risk                                                                                    |
| ----------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. Schema         | Migration, two collections, type union + intervals, cache tags, env         | Forgetting the `payload_locked_documents_rels` columns — throws on any admin document view  |
| 2. Deadline logic | Pure functions + unit tests for deadlines, thresholds, dedupe, missing data | The only place this module can be wrong silently; written test-first                        |
| 3. UI             | Listing, detail page, both forms, nav entry                                 | Prefill fighting the user when they change type after typing a date                         |
| 4. Daily digest   | Sweep, email template, cron route, schedule                                 | Stamping the bookkeeping columns before a send succeeds would silence a deadline for a week |
| 5. Nav badge      | Second `fleet` stream on `notification_reads`                               | Widening the helpers must not disturb the existing leads badge                              |

**Prerequisites:** `FLEET_NOTIFICATION_EMAIL` and `ADMIN_EMAIL` — done 2026-08-18, locally and on Vercel
(Production + Preview). The migration is additive, so a human applies it to prod **before** the code is
pushed.
**Estimated effort:** ~2-3 sessions across the five phases.

## Open Risks & Assumptions

- **The kilometre alarm is late by design.** It can only fire when a fresh odometer reading arrives,
  which happens one to three times a year. It is honest, not timely — and it must be documented in the
  code, or "the cron didn't warn me about the oil" becomes a bug report.
- **A deadline nobody enters does not exist.** The module reminds about the app's knowledge, not the
  world's. The weekly missing-data section is the only guard against a car silently tracking nothing.
- Assumed intervals: technical 12 months, OC 12, oil 12, warranty 24, tyres none. These are prefill
  suggestions only — being wrong costs one edit, not a migration.

## Success Criteria (Summary)

- Every car's five deadlines are visible on one screen, with "no data" distinguishable from "fine".
- An approaching or passed deadline produces exactly one email per urgency step, and recording the
  work stops the reminders without anyone dismissing anything.
- A quiet day produces no email at all.
