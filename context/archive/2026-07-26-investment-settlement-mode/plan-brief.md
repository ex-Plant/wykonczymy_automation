# Plan Brief: investment-settlement-mode

**Goal.** Store `settlementMode` (`NET` / `GROSS` / `MIXED`) on the investment and make it the only
source of truth for the Podsumowanie panel's money axis and the client view's grid columns. Today that
pick lives in the reader's `localStorage`, so the same investment reads differently per browser and a
client reads whatever the owner's browser remembered.

**Shape.** Copy the `vatRate` vertical end to end: collection field → hand-written migration (pg enum,
`NOT NULL DEFAULT 'NET'`) → `KosztorysTreeT` denormalization → server action → the panel's existing
select as the edit surface. Then delete the layer it replaces.

**Phases**

1. **Store it** — `settlementMode` on `src/collections/investments.ts` beside `vatRate`; migration
   modelled on `20260724_2_add_plane_to_kosztorys_stages.ts`; carried on the tree at
   `src/lib/queries/kosztorys.ts:150`. No UI, no behavior change.
2. **Owner writes it** — `updateInvestmentSettlementModeAction`; the panel select reads/writes the
   investment; **`use-summary-axis.ts` deleted** — no per-person override survives.
3. **Client reads it** — the stored mode drives the grid too, so the Netto/Brutto toggle comes back out
   of the client header (`MoneyAxisToggle` + `toClientAxis` deleted); `MIXED` shows the client the full
   invoiced/cash split.
4. **Scream on contradiction** — a `GROSS` deposit on a `NET` investment (and vice versa) raises an
   owner-only mismatch warning in the panel, following `reconciliation.ts`; `MIXED` never offends.

**Decisions already fixed** (owner, 2026-07-26): `MIXED` is a selectable mode, not derived; every
existing investment starts `NET` (no backfill); the stored mode is the sole truth — `localStorage` is
deleted, not layered; the mode sets the grid columns and the client does not toggle; a contradicting
deposit screams rather than settling quietly.

**Not doing.** No field on the investment form; no inference from deposit history; no rejection of a
contradicting deposit; no change to the owner's own „Kwoty" column preference; no E2E in this change.

**Tests.** Unit only: the mode → panel-axis / grid-axis projections, and the plane-mismatch rule across
all three modes (reusing `bucketDepositsByPlane`, so the null→netto ruling stays single-sourced).

**Migration.** Hand-written; `NOT NULL DEFAULT 'NET'` is the whole backfill. `pnpm db:migrate:prod` is a
human step owed at ship time, not during implementation.

Full plan: `context/changes/2026-07-26-investment-settlement-mode/plan.md`
