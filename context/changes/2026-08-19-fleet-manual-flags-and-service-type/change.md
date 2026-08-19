---
change_id: fleet-manual-flags-and-service-type
title: Manual "needs replacing" flags per vehicle + a standalone SERVICE inspection type
status: implemented
created: 2026-08-19
updated: 2026-08-19
archived_at: null
branch: fleet-manual-flags-and-service-type
worktree: null
---

## Notes

Owner wants to mark by hand that a vehicle needs its oil changed or its tyres changed — today both
are only derived (oil from km/date; tyres from a hand-typed next date, i.e. effectively nothing).

Shaped with the owner (2026-08-19):

- Flags live on the vehicle, cover **all** inspection types, and are edited only from the vehicle
  detail page.
- A flag clears itself when an inspection of that type is recorded, and can also be unticked by hand.
- Visible as a badge on the fleet table (next to the registration, beside the existing „Olej +X km")
  and on the vehicle page. **No** email digest, **no** unread badge.
- Sixth inspection type `SERVICE` — „Serwis" — an ad-hoc repair/service with no interval and no
  deadline column in the table. It still lands in the history and the Koszty tab, and it is flaggable
  like the rest. Owner's distinction: TECHNICAL = the yearly mandatory przegląd okresowy,
  WARRANTY = service performed while the warranty still runs, SERVICE = plain ad-hoc service.
