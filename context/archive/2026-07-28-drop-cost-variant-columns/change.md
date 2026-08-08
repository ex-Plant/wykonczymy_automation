---
change_id: drop-cost-variant-columns
title: Drop the dead costVariant / defaultCostVariant columns
status: archived
created: 2026-07-28
updated: 2026-07-28
archived_at: 2026-07-28T19:11:40Z
branch: staging
worktree: null
---

## Notes

Linear **EX-575** (Backlog, Low, project Wykonczymy). Filed at the 2026-07-25 staging post-merge
review gate (`.review-gate/staging-post-merge-kosztorys-refactors.md`) and deferred there as a schema
change deserving its own review.

Delete `kosztorys_items.cost_variant` and `kosztorys_sections.default_cost_variant`, their two Payload
fields, the TS fields they feed (`KosztorysItemT.costVariant`, `KosztorysSectionT.defaultCostVariant`),
and the `sectionDefaultCostVariant` key denormalized onto every grid row.

Scope also covers the **docs**: the per-pozycja/per-sekcja direction was dropped outright, so
`context/reference/kosztorys-editor-domain-notes.md` (the „OTWARTE" section at `:385-478` plus
`:183-188`, `:198-199`, `:599`) and `context/domain/01-domain-distillation.md:64-65` must stop
presenting it as live. The in-flight EX-430 plan's cost-variant fixture axis is stripped here too.

Research: `research.md`. Plan: `plan.md` / `plan-brief.md`. Verdict — dead code, not an unbuilt feature: the owner refuted the per-item
grain on 2026-07-21 („grain wyboru wariantu to etap, nie praca") and the concept shipped on
`kosztorys_stages.plane` instead (EX-565).
