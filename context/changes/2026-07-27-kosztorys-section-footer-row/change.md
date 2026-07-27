---
change_id: kosztorys-section-footer-row
title: Move the section's totals out of its header into a footer row under their own columns
status: implemented
created: 2026-07-27
updated: 2026-07-27
branch: ex-607-kosztorys-section-footer-row
---

## Notes

Owner's ask, verbatim: "owner does not like totals in the section name / he want it moved to rows
under each column".

Reverts the layout decision taken in `30a095de` ("move the section band's total into its label
cell"), which folded the band's netto/brutto into the section name because the money columns were
hidden per axis and the figure vanished. The answer this time is a second row rather than a
relocated label: the header keeps identity, a footer carries the figures under the columns they
belong to.

Constraint the owner set explicitly: **only the columns we can already total**. No new figure math —
the footer reads `SectionSubtotalT`, which is what the archived
`kosztorys-section-header-rows` plan also refused to touch.
