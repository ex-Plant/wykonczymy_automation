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
leaks a stale `vatPlane`.

> **Korekta (2026-08-12).** Trzy śmieciowe wiersze zostały na prodzie **anulowane** — zero aktywnych
> `OTHER_DEPOSIT` / `COMPANY_FUNDING` z inwestycją. Nie ma już czego chronić przed automatycznym
> zerowaniem, więc predykat `ignoresInvestment` wypada z zakresu: oba typy idą istniejącą ścieżką
> `showsInvestment === false → investment = null`.

## Desired End State

„Inna wpłata" is selectable again; „Zasilenie" stays ADMIN/OWNER-only in the dialog. No server path —
action, REST, GraphQL, admin, script — can write an investment onto either type, and no deposit but
„Wpłata od inwestora" persists a netto/brutto plane. The parity golden master does not move.

## Key Decisions Made

| Decision                     | Choice                                                                           | Why                                                                                            | Source   |
| ---------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Scope of the July regression | Restore the type, remove only the investment variant                             | The EDIT's intent was the variant, not the type                                                | Owner    |
| Grandfathered rows           | Not touched by this change — cancelled on prod 2026-08-12, problem settled there | Cancelling took them out of every sum; their stored `investment_id` no longer matters          | Owner    |
| Enforcement mechanism        | The existing auto-clear — `showsInvestment === false → investment = null`        | Nothing left to preserve, so the second write semantic (`ignoresInvestment`) buys nothing      | Owner    |
| Enforcement layer            | Predicate + validate hook (not zod, not SQL)                                     | Two DB specs deliberately insert the forbidden shape by raw SQL; a constraint would break them | Research |
| `COMPANY_FUNDING` role gate  | Stays client-only                                                                | Owner: "client jest good enough"                                                               | Owner    |
| Stale `vatPlane` leak        | Fixed here                                                                       | Same root cause as the investment leak — hiding a field is not clearing it                     | Owner    |
| Deposit-dialog E2E           | Deferred to `e2e-backlog`                                                        | Owner                                                                                          | Owner    |

## Scope

**In scope:** `DEPOSIT_UI_TYPES` restore · `INVESTMENT_TYPES` narrowing · validate-hook regression
guard · deposit-form conditionals and submitted payload · three affected spec files · three false
comments · one Linear backlog issue.

**Out of scope:** touching the three legacy rows · removing either type from the union, labels, or
filters · server-side role hardening · sheet type lists · `/raporty` bucketing · browser E2E.

## Architecture / Approach

One predicate carries the rule and every consumer already reads it. Narrowing `INVESTMENT_TYPES`
switches the field off in the edit dialog and the admin panel **and** routes both types into the
validate hook's existing auto-clear — one array edit, no new branch, no new export. The form stops
submitting what it hides, and its type conditional switches from a hardcoded type to
`showsInvestment`.

## Phases at a Glance

| Phase                          | What it delivers                                                   | Key risk                                                                                          |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1. Constants and predicates    | Type restored, investment set narrowed                             | The two hand-written membership tables must be updated by hand — deriving them destroys the guard |
| 2. Validation hook             | Regression guard over the auto-clear + its corrected comment       | No behaviour change here; the guard is the only new asset                                         |
| 3. Form and write-side cleanup | Hidden fields stop being submitted; false-green action specs fixed | `transfer-actions.test.ts` currently asserts the forbidden shape succeeds                         |
| 4. Docs and backlog            | False comments corrected, E2E deferral filed                       | None                                                                                              |

**Prerequisites:** none — no migration, no schema change, no prod step.
**Estimated effort:** one session across four phases.

## Open Risks & Assumptions

- `/raporty` Wpłaty + Bilans will start rising again with every new „Inna wpłata" — correct
  company-wide, but a figure that has been still for ~4 months starts moving. Owner informed.
- The three legacy rows are cancelled, so they no longer inflate any bilans — the discrepancy this
  brief originally carried is closed. Their stored `investment_id` stays in the column and would be
  cleared by an edit from the Payload admin; accepted, they are cancelled junk.

## Success Criteria (Summary)

- A manager can book cash into a register under „Inna wpłata" again, and it lands with no investment
  even when added from an investment page.
- No dialog, panel, or API call can attach an investment to either deposit type.
- `pnpm test:parity` stays green — the golden master does not move.
