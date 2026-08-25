---
change_id: kosztorys-percent-rabat-bulk-apply
title: Percent global rabat becomes a one-shot bulk-apply; subcontractor views go rabat-free
status: archived
created: 2026-07-22
updated: 2026-07-25
archived_at: 2026-07-25T18:47:38Z
branch: staging
---

Owner decision: percent global rabat stops being stored state and becomes a one-shot bulk-apply
writing X% into every item's per-item rabat. Amount-mode global rabat keeps current semantics.
Snapshot format drops globalDiscountType/Value.

Scope added mid-implementation (owner, 2026-07-24): **rabat is a client-only concept** — subcontractor
views (`w_tools`/`own_tools`) must hide the per-item discount columns AND price gross of any rabat, so
the grid matches the rule the subcontractor summary already enforces (`executedWorkNetPreRabat`,
"rabat absorbed by company margin, not passed to the subcontractor"). Tracked here as Phase 0.
