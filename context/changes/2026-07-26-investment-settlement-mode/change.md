---
change_id: investment-settlement-mode
title: Store how an investment is settled (netto / brutto / mieszane) on the investment
status: implemented
created: 2026-07-26
updated: 2026-07-26
archived_at: null
branch: investment-settlement-mode
worktree: ../wykonczymy-worktrees/investment-settlement-mode
---

## Notes

Nowhere in the schema do we record how a given investment is settled. The Podsumowanie panel's
netto / brutto / mieszane pick lives in the person's localStorage (`useSummaryAxis`), and the only
persisted trace of the distinction is `vatPlane` on a single INVESTOR_DEPOSIT — a fact about one
transaction, not a decision about the investment.

Owner's ruling (2026-07-26): `MIXED` is a **selectable mode**, not a derived state — the three modes
are `NET` / `GROSS` / `MIXED`. An earlier attempt to infer the mode from the deposits' `vatPlane` mix
was rejected as a workaround for the missing field and has been reverted.

Immediate trigger: the client view had to hide „Wybierz jak rozliczana będzie inwestycja" (committed
in `64aa2721`), which leaves the client reading the axis out of the OWNER's localStorage — a stopgap
until the mode is stored on the investment.

Settled in the plan: a `GROSS` deposit on a `NET` investment (and vice versa) records normally but
**screams** in the Podsumowanie, owner-only — same affordance as the existing robocizna/rabat mismatch.
`MIXED` never screams. Also settled: the stored mode is the ONLY truth (`useSummaryAxis` is deleted,
not layered), every existing investment starts `NET`, and the mode drives the client's grid columns —
so the client's Netto/Brutto toggle from `ee0667fb` comes back out.
