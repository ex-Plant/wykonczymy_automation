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

## Kept from `research.md` / `plan.md` (both deleted 2026-08-08)

**The evidence chain that made this a deletion rather than an unbuilt feature** — four independent
lines, in case anyone re-proposes a per-pozycja cost variant:

1. Zero genuine reads. All ~60 non-generated references were carriers (DDL, SQL, mapper, type, zod
   branch, seed literal, fixture). Settlement keys off `stage.plane`; pricing keys off the active
   `view`, and `calc.ts` never saw a section or a `costVariant` at all.
2. The only consumer, `effectiveCostVariant(item, section)`, landed in `76587b21` and was deleted **39
   minutes later** in `6bd7c745`, a `calc.ts` dead-code sweep ("0 refs") that never looked at the
   schema. Inert since 2026-07-08 23:28 — **not** since EX-489, which explains why they'll never come
   back, not when they died.
3. The owner refuted the grain on 2026-07-21: „grain wyboru wariantu to **etap**, nie praca".
4. The concept shipped on `kosztorys_stages.plane` (EX-565) without consulting, migrating from, or
   deprecating `cost_variant` — it was bypassed.

**Why nothing in the persistence layer broke**: no spread-into-INSERT, no `jsonb_populate_record`, no
zod `.parse()` on a stored payload — `presets.ts` / `snapshots.ts` are bare `as` casts, so an extra key
in an old payload is silently ignored, and the action schemas are non-strict `z.object().partial()`, so
a stale browser tab posting the removed key degrades to a `payload.update` no-op rather than an error.
**Tolerance in a restore path is a property of how the mapper is written, not a promise** — the same
drop against a strict parse would have been breaking. Read the mapper before assuming either.

**The compiler was the completeness proof.** `ITEM_FIELDS` is
`as const satisfies readonly (keyof ItemPatchT)[]`, so removing the field from `ItemPatchT` failed
`pnpm typecheck` until every carrier was gone — the self-verifying deletion shape.

The generalisations went to `context/foundation/lessons.md`: the type-merge laundering effect, the
stale-OTWARTE-doc trap, the `SNAPSHOT_SCHEMA_VERSION` non-bump rule, and the migration filename sort.
