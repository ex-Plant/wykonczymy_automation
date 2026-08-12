# EX-557 — Investment-less deposits — Plan Brief

> Full plan: `context/changes/2026-08-12-ex-557-legacy-deposit-types/plan.md`
> Research: `context/changes/2026-08-12-ex-557-legacy-deposit-types/research.md`
> Owner rulings: `context/changes/2026-08-12-ex-557-legacy-deposit-types/change.md`

## What & Why

The July change removed the wrong thing. The intent was to stop „Inna wpłata" carrying an
investment; what shipped removed the type from the deposit dialog entirely — one day after a live
row was booked with it. Since then, cash entering a register without an investment has had no type a
manager can book. This restores the type and enforces the actual rule — **neither „Inna wpłata" nor
„Zasilenie z konta firmowego" may ever carry an investment** — in one predicate on the server rather
than in one form's JSX.

## Starting Point

Both types are still in `INVESTMENT_TYPES`, so the edit dialog and the Payload admin offer an
investment picker and the validate hook waves it through. The deposit form leaks worse than that: it
seeds the investment from the URL, hides the field on type change without clearing the value, and
submits it anyway — which is where the three garbage rows from 2026-03-25 came from. The same shape
leaks a stale `vatPlane`. Meanwhile the hook's existing auto-clear assigns `null` unconditionally on
every write, so the obvious fix would wipe those three rows on their next edit.

## Desired End State

„Inna wpłata" is selectable again; „Zasilenie" stays ADMIN/OWNER-only in the dialog. No server path —
action, REST, GraphQL, admin, script — can write an investment onto either type, and no deposit but
„Wpłata od inwestora" persists a netto/brutto plane. Rows 1171 / 1196 / 1381 keep their stored
investment through arbitrary edits, and the parity golden master does not move.

## Key Decisions Made

| Decision                     | Choice                                                                               | Why                                                                                            | Source   |
| ---------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------- |
| Scope of the July regression | Restore the type, remove only the investment variant                                 | The EDIT's intent was the variant, not the type                                                | Owner    |
| Grandfathered rows           | Left untouched — block new writes, never clear stored                                | Owner ruling; a clear would rewrite real history                                               | Owner    |
| Enforcement mechanism        | Separate rule for the two deposit types: incoming investment **ignored**, not nulled | Keeps the existing clear correct for `OTHER` / `REGISTER_TRANSFER`; no ID-based exceptions     | Owner    |
| Enforcement layer            | Predicate + validate hook (not zod, not SQL)                                         | Two DB specs deliberately insert the forbidden shape by raw SQL; a constraint would break them | Research |
| `COMPANY_FUNDING` role gate  | Stays client-only                                                                    | Owner: "client jest good enough"                                                               | Owner    |
| Stale `vatPlane` leak        | Fixed here                                                                           | Same root cause as the investment leak — hiding a field is not clearing it                     | Owner    |
| Deposit-dialog E2E           | Deferred to `e2e-backlog`                                                            | Owner                                                                                          | Owner    |

## Scope

**In scope:** `DEPOSIT_UI_TYPES` restore · `INVESTMENT_TYPES` narrowing · new `ignoresInvestment`
predicate · validate-hook rule + regression guard · deposit-form conditionals and submitted payload ·
four affected spec files · two false comments · one Linear backlog issue.

**Out of scope:** touching the three legacy rows · removing either type from the union, labels, or
filters · server-side role hardening · sheet type lists · `/raporty` bucketing · browser E2E.

## Architecture / Approach

One predicate carries the rule; every consumer reads it. Narrowing `INVESTMENT_TYPES` switches the
field off in the edit dialog and the admin panel for free. A new `ignoresInvestment(type)` names the
narrower set whose incoming `investment` is **deleted from the write payload** rather than nulled —
so a create can never plant one and an update can never clear one. The form stops submitting what it
hides, and its type conditional switches from a hardcoded type to the predicate.

## Phases at a Glance

| Phase                          | What it delivers                                                   | Key risk                                                                                          |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1. Constants and predicates    | Type restored, investment set narrowed, predicate added            | The two hand-written membership tables must be updated by hand — deriving them destroys the guard |
| 2. Validation hook             | The ignore rule + its regression guard                             | Branch must sit **before** the existing clear and skip it, or the three rows are wiped            |
| 3. Form and write-side cleanup | Hidden fields stop being submitted; false-green action specs fixed | `transfer-actions.test.ts` currently asserts the forbidden shape succeeds                         |
| 4. Docs and backlog            | False comments corrected, E2E deferral filed                       | None                                                                                              |

**Prerequisites:** none — no migration, no schema change, no prod step.
**Estimated effort:** one session across four phases.

## Open Risks & Assumptions

- `/raporty` Wpłaty + Bilans will start rising again with every new „Inna wpłata" — correct
  company-wide, but a figure that has been still for ~4 months starts moving. Owner informed.
- The three legacy rows keep inflating their investments' bilans while the wpłaty list omits them —
  an accepted, now-documented discrepancy, not a defect to fix here.
- Assumption: deleting the key from the hook's `data` leaves the stored column untouched on a
  partial update. Phase 2's manual check on row 1171 is the verification.

## Success Criteria (Summary)

- A manager can book cash into a register under „Inna wpłata" again, and it lands with no investment
  even when added from an investment page.
- No dialog, panel, or API call can attach an investment to either deposit type.
- Rows 1171 / 1196 / 1381 survive an edit unchanged, and `pnpm test:parity` stays green.
