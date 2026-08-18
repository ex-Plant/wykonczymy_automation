---
change_id: flota-przeglady
title: Fleet module — vehicles, inspection deadlines, daily reminder email
status: new
created: 2026-08-18
updated: 2026-08-18
archived_at: null
branch: null
worktree: null
---

## Notes

New module for the company car fleet. Two collections: `vehicles` (registration, make,
model, year, VIN, ACTIVE/RETIRED — no employee assignment) and `vehicle-inspections`
(one row per event: vehicle, type, performedAt, nextDueAt, odometer, cost, note,
attachments).

Four inspection types as a fixed union, mirroring the transfer-type union:
`TECHNICAL` / `INSURANCE` / `OIL_CHANGE` / `WARRANTY`.

Decisions taken in brainstorming (2026-08-18):

- Deadlines are **date-driven**, not mileage-driven. Odometer is a note, captured per
  event; "distance since last inspection" is the delta between two consecutive events of
  the same type, and reads "—" when either reading is missing.
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
- **One digest email per day** to `FLEET_NOTIFY_EMAIL` (env, mirroring
  `LEADS_NOTIFY_EMAIL`), sectioned overdue / ≤7 days / ≤30 days — never one mail per
  event.
- Known hole, addressed deliberately: a vehicle with no event of a given type has no
  deadline and is invisible to the cron. Covered by a weekly "brak danych" section in the
  digest.
- `/flota` listing: one row per vehicle, four deadline columns, urgency colouring.
  Access as per cash registers (read/write OWNER/ADMIN/MANAGER, delete OWNER/ADMIN).
  Nav badge reuses `notification_reads` with a second stream, `fleet`.

Step 2, out of scope here but the schema assumes it: photo → OpenRouter vision → JSON →
prefilled form, reusing the `scan-receipt.ts` / `/api/extract-receipt` pattern. It adds a
second entry path to the same form, not a schema change.
