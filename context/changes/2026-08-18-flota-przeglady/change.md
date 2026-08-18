---
change_id: flota-przeglady
title: Fleet module — vehicles, inspection deadlines, daily reminder email
status: planned
created: 2026-08-18
updated: 2026-08-18
archived_at: null
branch: null
worktree: null
---

## Notes

Linear: **EX-711** — https://linear.app/ex-plant/issue/EX-711/modul-floty-przeglady-pojazdow-i-przypomnienia-mailowe

New module for the company car fleet. Two collections: `vehicles` (registration, make,
model, year, VIN, ACTIVE/RETIRED — no employee assignment) and `vehicle-inspections`
(one row per event: vehicle, type, performedAt, nextDueAt, odometer, cost, note,
attachments).

Five inspection types as a fixed union, mirroring the transfer-type union:
`TECHNICAL` / `INSURANCE` / `OIL_CHANGE` / `WARRANTY` / `TYRES`. Prefill intervals are
12 / 12 / 12 / 24 months; `TYRES` has none — the ask was only "be able to type a date so a
reminder goes out", so it carries no interval and no seasonal logic.

Decisions taken in brainstorming (2026-08-18):

- Deadlines are **date-driven**, not mileage-driven. Odometer is a note, captured per
  event; "distance since last inspection" is the delta between two consecutive events of
  the same type, and reads "—" when either reading is missing.
- **Exception, added after the owner pushed back: the oil change genuinely runs on
  mileage.** It keeps a date target _and_ a `nextDueOdometer` target. The kilometre leg
  cannot be polled — we never know the current mileage — so it is edge-triggered: every
  inspection of any type contributes a fresh odometer reading, and that reading is compared
  against the pending oil target (fires at <= 1000 km remaining, or once passed). One to
  three readings a year, for no extra work from anyone. Late by design, and documented as
  such so "the cron didn't warn me about the oil" isn't filed as a bug.
- `nextDueAt` is **typed by hand, prefilled from a per-type interval** (variant C). The
  truth about the next date is printed on the document (badanie techniczne, polisa OC),
  so the system must not compute it authoritatively — a two-year warranty inspection
  would silently be wrong.
- No "last/next inspection" fields on the vehicle — always derived from the newest event
  of that type. This is also what makes "already done" free: entering the new event moves
  the deadline, so nothing needs an "acknowledged" flag.
- Daily cron `0 6 * * *` → `/api/cron/fleet-reminders`, shaped after `leads-reconcile`.
  Thresholds 30 / 7 / 1 days plus overdue, deduplicated via `notifiedThreshold` +
  `notifiedAt` on the inspection row; overdue re-nags every 7 days.
- **One digest email per day**, sectioned overdue / ≤7 days / ≤30 days — never one mail per
  event. It goes to **two** recipients in one send (owner, 2026-08-18):
  `FLEET_NOTIFICATION_EMAIL` (`bartek@`, the same inbox as leads) and `ADMIN_EMAIL` (`admin@`).
  Both are env vars, mirroring `LEADS_NOTIFY_EMAIL`, so adding an app account never silently
  subscribes someone to fleet mail.
- Known hole, addressed deliberately: a vehicle with no event of a given type has no
  deadline and is invisible to the cron. Covered by a weekly "brak danych" section in the
  digest.
- `/flota` listing: one row per vehicle, four deadline columns, urgency colouring.
  Access as per cash registers (read/write OWNER/ADMIN/MANAGER, delete OWNER/ADMIN).
  Nav badge reuses `notification_reads` with a second stream, `fleet`.

Step 2, out of scope here but the schema assumes it: photo → OpenRouter vision → JSON →
prefilled form, reusing the `scan-receipt.ts` / `/api/extract-receipt` pattern. It adds a
second entry path to the same form, not a schema change.
