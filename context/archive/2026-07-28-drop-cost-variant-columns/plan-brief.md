# Drop the dead costVariant / defaultCostVariant columns — Plan Brief

> Full plan: `context/changes/2026-07-28-drop-cost-variant-columns/plan.md`

## What & Why

`kosztorys_items.cost_variant` and `kosztorys_sections.default_cost_variant` carry a per-pozycja /
per-sekcja subcontractor cost variant that **nothing reads**. Their only consumer was deleted 39
minutes after the columns were born (`6bd7c745`, "0 refs") in a `calc.ts` sweep that never looked at
the schema. The concept they were meant to carry shipped on `kosztorys_stages.plane` (EX-565), at the
**etap** grain the owner confirmed on 2026-07-21. A later type merge (`8ef4a3e5`) gave the two dead
fields the same `ToolPlaneT` name as the live carrier, so they now read as load-bearing. Delete them —
and correct the docs that still present the abandoned cascade as open design.

## Starting Point

~60 non-generated references, all carriers: DDL, SQL select, mapper, TS type, zod branch, seed literal,
test fixture. No grid column binds `costVariant`, so `ITEM_FIELDS`'s entry and both zod branches are
unreachable. Both fields are nevertheless editable in the Payload admin — an owner can type anything
into „Domyślny wariant kosztu" and it persists and does nothing. Three docs state falsehoods, one of
them (`01-domain-distillation.md`) a living map citing `file:line` as current truth.

## Desired End State

Columns gone from the DB and every carrier. `ToolPlaneT` has exactly one carrier and says so.
`grep -ri cost_variant` hits only `context/archive/**` and the birth migration. Docs describe the
per-etap plane as **shipped**, not open. EX-430's planned fixture no longer asks for a dead column.

## Key Decisions Made

| Decision                    | Choice                            | Why                                                                                                           | Source   |
| --------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| `SNAPSHOT_SCHEMA_VERSION`   | Hold at 1, amend the comment      | `20260724_1` set the precedent; a bump hard-rejects every snapshot **and** the preset library, asymmetrically | Research |
| „OTWARTE" doc section       | Rewrite as RESOLVED in place      | It is the only record of _why_ per-pozycja was wrong — collapsing it destroys the escalation reasoning        | Owner    |
| `01-domain-distillation.md` | Surgical edit to `:64-65` only    | Those are its only two mentions; the rest was verified on `2562a2e1`                                          | Owner    |
| EX-430 collision            | Fix its plan inside this change   | It can't author a fixture on a dropped column; also strips a second stale axis (section coeffs, `20260724_1`) | Owner    |
| Sweep width                 | Everything, JSON fixture included | Clean `grep` — no future reader resurrects the concept from a fixture                                         | Owner    |
| Backfill / compat shim      | None                              | Kosztorys data is throwaway until dogfooding lands on `main`                                                  | AGENTS   |

## Scope

**In scope:** one hand-written migration; 2 Payload fields; 4 TS carriers; ~14 prod files; 7 seed
scripts; ~30 test fixture literals + the 337-key JSON fixture; the snapshot-format comment;
`kosztorys-editor-domain-notes.md`, `01-domain-distillation.md`, and EX-430's plan/change docs.

**Out of scope:** `kosztorys_stages.plane` and the live settlement path; snapshot/preset payload
migration; `context/archive/**`; the prod migration (human, at ship time); reopening the per-etap model.

## Risk

One edit can corrupt data silently: the `insert-rows.ts` VALUES tuple and its column list must stay
index-aligned (Phase 3.2). The roundtrip and preset specs catch a shift immediately. Everything else
is compiler-verified — `ITEM_FIELDS` is `satisfies readonly (keyof ItemPatchT)[]`, so `pnpm typecheck`
enumerates any missed carrier.

## Phases

1. Migration `20260728_0_drop_kosztorys_cost_variant.ts` + apply to local (5433) and test (5435)
2. Payload fields + the 4 TS carriers + the `ToolPlaneT` doc-comment → typecheck becomes the worklist
3. Clear carriers: SQL/mappers, insert tuples, `ITEM_FIELDS`/denorm, row-ops/constants/preset, zod, editor hook
4. Fixtures, 7 seed scripts, JSON fixture
5. `SNAPSHOT_SCHEMA_VERSION` comment amendment (no bump)
6. Docs: domain notes, DDD map, EX-430's plan

## Testing

No new tests — this deletes unreachable code. Existing suites are the net: roundtrip/preset specs guard
the insert-tuple alignment, `kosztorys-tree.db.test.ts` guards the SELECT/mapper edits, `pnpm typecheck`
proves carrier completeness.
