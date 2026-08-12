---
date: 2026-08-12T10:14:52Z
researcher: ex-Plant
git_commit: 13d4bf9197d03a2a5473ed6544094a95f8c010bb
branch: konradantonik/ex-560-przeladuj-z-szablonu
repository: wykonczymy
topic: 'EX-557 — restore OTHER_DEPOSIT to the deposit dialog and make "never carries an investment" structural for OTHER_DEPOSIT / COMPANY_FUNDING'
tags: [research, codebase, transfers, deposits, validate-hook, transfer-constants]
status: complete
last_updated: 2026-08-12
last_updated_by: ex-Plant
---

# Research: EX-557 — investment-less deposits

**Date**: 2026-08-12T10:14:52Z
**Researcher**: ex-Plant
**Git Commit**: 13d4bf9197d03a2a5473ed6544094a95f8c010bb
**Branch**: konradantonik/ex-560-przeladuj-z-szablonu
**Repository**: wykonczymy

## Research Question

Per the owner's 2026-08-12 correction (see `change.md`): restore `OTHER_DEPOSIT` to the deposit
dialog for all roles, keep `COMPANY_FUNDING` ADMIN/OWNER-only, and make "neither type may ever carry
an investment" enforced in one place — **without** touching the three grandfathered rows
(1171 / 1196 / 1381). What breaks, what is already broken, and where does the guard belong?

## Summary

Four findings dominate the change.

1. **The naive fix is disqualified.** Removing both types from `INVESTMENT_TYPES`
   (`src/lib/constants/transfers.ts:420-431`) is the single edit that would turn off the field
   everywhere and turn on server-side enforcement — but the enforcement it turns on is
   `d.investment = null` (`src/hooks/transfers/validate.ts:75-77`), executed **unconditionally on
   every write, create and update alike**. The three grandfathered rows would lose their
   `investment_id` on their first unrelated edit (including an invoice-only edit via
   `setTransferInvoices`, `src/lib/actions/transfers.ts:311-315`). The rule must **reject a newly
   written investment**, not clear a stored one.

2. **The illegal state is produced by the form, not by a backfill.**
   `deposit-form.tsx:79` seeds `investment: investmentFromUrl` into `defaultValues`
   unconditionally; the type-change listener (`:112-116`) calls `form.resetField('investment')`,
   which resets _to that default_; the picker is hidden by a JSX literal (`:132`,
   `currentType === 'INVESTOR_DEPOSIT'`) which hides the field without clearing the value; `toData`
   (`:100`) still ships it. **A deposit added from `/inwestycje/<id>` carries that investment.**
   This is live for `COMPANY_FUNDING` today and `OTHER_DEPOSIT` inherits it the moment it returns
   to the picker — so the write-side block is load-bearing, not cosmetic.

3. **Two read surfaces already disagree, and the change makes a third move.** An investment-linked
   deposit inflates that investment's `totalIncome` → `bilans` via `sumAllInvestmentFinancials`
   (`src/lib/db/sum-transfers.ts:151-161`, bucketed by `financialBucket`, no type filter), while
   `getDepositTransactions` (`:314-323`) hard-filters `type = 'INVESTOR_DEPOSIT'` and omits it. Per
   the owner's ruling this stays as-is — a known, accepted discrepancy on three rows. Separately,
   **`/raporty` Wpłaty + Bilans will start rising again** with every new „Inna wpłata"
   (`raporty/page.tsx:36-52` is the one unscoped aggregate). Behaviour change, not breakage; owner
   informed.

4. **The role gate on `COMPANY_FUNDING` is client-only decoration.** `deposit-form.tsx:58-61` is the
   only role-filtered option list in the repo; the server accepts it from any of
   `MANAGEMENT_ROLES` (`src/lib/auth/roles.ts:14`) via `requireAuth`. Ruling 3 ("only ADMIN/OWNER")
   is not enforced today. Adjacent finding: the form persists a stale `vatPlane: 'NET'` on types
   that must not carry it — the default is unconditional, the listener resets only `investment`, the
   field is hidden, and `payload.create` spreads raw `...data` (`src/lib/actions/transfers.ts:50-58`)
   while `validate.ts` never clears `vatPlane`. Contradicts the prose invariant at
   `sum-transfers.ts:299`.

## Detailed Findings

### Write surface — where an investment can reach these types

Nine paths accept the illegal state today: `createTransferAction` / `updateTransferAction`
(raw `...data` / `...fields` spread), Payload REST + GraphQL, the admin panel field
(`src/collections/transfers.ts:183`, gated on `showsInvestment`), the edit dialog
(`edit-transfer-form.tsx:153`, same predicate), the deposit form's hidden-but-submitted default,
and scripts via the Local API.

The zod layer is **silent**: `src/lib/schemas/transfer-validation.ts:31-64` has rules for
`needsSourceRegister`, `needsTargetRegister`, `requiresInvestment`, `needsWorker`,
`needsExpenseCategory` — there is no "must NOT have an investment" rule anywhere. `showsInvestment`
is not consumed by the schema layer at all.

`validate.ts` semantics that decide the design:

- wired as `beforeValidate` (`src/collections/transfers.ts:75`) → runs on create **and** update;
- `originalDoc` is consulted only for `type` (`:33`) and `netAmount`/`amount` (`:110-115`), never
  for `investment`;
- a partial update's `data` does **not** backfill `investment` from `originalDoc`, so the
  unconditional `d.investment = null` at `:75-77` is a true wipe, not a no-op.

**Recommended shape:** a new `forbidsInvestment(type)` predicate plus a **reject** in `validate.ts`
gated on `'investment' in d && d.investment` — covers every server path, leaves stored values alone.

### Read surface — blast radius of investment-less deposits

| Surface                                             | Behaviour                                                                                                                                            | Verdict                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Kasa saldo (`sum-transfers.ts:43,75`)               | both types are in `DEPOSIT_TYPES` → `THEN amount` arm, credits the register                                                                          | inert                                                                   |
| `sumAllInvestmentFinancials`, `/inwestycje` listing | `WHERE investment_id IS NOT NULL`                                                                                                                    | inert                                                                   |
| Investment detail, kosztorys Podsumowanie           | scoped `investment = $id`                                                                                                                            | inert                                                                   |
| `Rozliczenie wpłat` / client wpłaty list            | hard `type = 'INVESTOR_DEPOSIT'`                                                                                                                     | inert                                                                   |
| Google Sheets (both tabs)                           | three independent guards (`sync-sheet.ts:20-28`, `sheets-sync.ts:392-418`, `tab-rows.ts:95`); `TRANSFERS_SUMMARY_TYPES` is a separate frozen literal | inert — **do not touch either sheet list**                              |
| Table / filters / CSV / print                       | `investmentName` is a pre-mapped string, link guarded; renders `—`                                                                                   | inert                                                                   |
| Cache tags                                          | `resolveId` → `undefined`, call guarded `if (investmentId)` — no malformed tag                                                                       | inert                                                                   |
| **`/raporty` Wpłaty + Bilans**                      | `fetchFilteredByType(statsWhere)`, URL filters only → investment-less rows selected, bucketed `income`                                               | **degrades — a figure that has been still for ~4 months starts moving** |

`calculateMargin` reads no `totalIncome` and is untouched throughout.

### Test & guard surface

**Hard failures on the two edits (must be updated in the same commit):**

- `src/__tests__/transfer-constants.test.ts:241-243` — exact-array pin on `DEPOSIT_UI_TYPES`.
  Label-sorted restore ⇒ `['OTHER_DEPOSIT', 'INVESTOR_DEPOSIT', 'COMPANY_FUNDING']`.
- `src/__tests__/transfer-constants.test.ts:68-82` — the hand-written `showsInvestment.trueFor`
  membership table (`:75-76`). This is the **only** pin on `showsInvestment` for these types; it is
  deliberately authored independently of the source (`lessons.md`: an exhaustiveness assertion only
  protects while both sides are authored independently) — hand-update it, never derive it.
- `src/__tests__/transfer-constants.test.ts:146-155` — `covers every exported predicate`, derived
  from the module's exports. **A new `forbidsInvestment` export fails this test until registered**
  in `HELPERS` or `NOT_A_BOOLEAN_PREDICATE` (`:143`). Useful tripwire, not an obstacle.

**Silently satisfied — will NOT catch the change:**

- `src/__tests__/transfer-spec-table.test.ts:99-105` guards `DEPOSIT_UI_TYPES` with a **subset**
  check only; `OTHER_DEPOSIT` has `deposit: true` so it passes. Its comment (`:100-101`, "a strict
  subset by design — „Inna wpłata" was dropped") becomes factually false and must be rewritten.
- `INVESTMENT_TYPES` has **no spec-table column at all** (by design, `transfers.ts:415-418`), so no
  consistency test can see that edit.

**False-green risk — the sharpest one:** `src/__tests__/transfer-actions.test.ts:212-221`. Both
tests send `investment: 1` on `COMPANY_FUNDING` / `OTHER_DEPOSIT` and assert `success: true`, with
`payload.create` mocked (`:26`, `:76`) so the hook never runs. A hook-only guard leaves them green
**while they assert that the forbidden shape is accepted**. They must be rewritten to assert
rejection, or the guard must also sit at the schema/action layer.

**Vacuous / blind, per `lessons.md:1020-1040`:**

- `hooks/sync-sheet.test.ts:83-95` feeds `{type: 'COMPANY_FUNDING'|'OTHER_DEPOSIT', investment: 2}`
  and asserts nothing about `investment`.
- A DB-backed "no live row has these types with an investment" assertion is **vacuously green for
  `COMPANY_FUNDING`** (0 of 26 rows) and **guaranteed red for `OTHER_DEPOSIT`** (the three protected
  rows). Unwritable as stated — it must be scoped to newly written rows.
- `src/__tests__/lib/db/get-deposit-transactions.test.ts:47-51` and
  `deposit-transactions-where-scope.test.ts:47` deliberately insert investment-bearing rows of both
  types by **raw SQL**, bypassing the hook. A zod/hook guard leaves them green; a DB-level CHECK
  constraint or trigger would break them. **Argues against enforcing in SQL.**
- `financial-golden-master-db.test.ts` (parity leg, `pnpm test:parity`) freezes the three rows'
  `totalIncome` contribution on Łomianki Staszica 20a/3, Szaserów 30b/32, Meander 22/25. Under the
  "leave them untouched" ruling it must stay unchanged — **a golden-master diff on those three
  investments is the signal that the guard over-reached into stored data.**

**Where a new spec goes** (`AGENTS.md:225-238`, full path mirroring; the two top-level files above
are grandfathered and may not gain siblings): `src/lib/constants/transfers.ts` →
`src/__tests__/lib/constants/transfers.test.ts` (dir does not exist yet);
`src/hooks/transfers/validate.ts` → `src/__tests__/hooks/transfers/<name>.test.ts` (precedent:
`delete-invoice-media.test.ts`). Nearest shape precedents inside `validate-hook.test.ts`:
`:144-154` (investment nulled for `OTHER` / `REGISTER_TRANSFER`) and `:246-256` (a smuggled field
stripped past the early return). Today there is **zero coverage of what the hook does with an
investment on these two types**, in either direction.

The "the three rows survive an unrelated update" half of the rule has **no unit-testable surface** —
it is a claim about an UPDATE not clearing a stored column, observable only through a DB round-trip.
The only existing spec that writes through the real path (action → `payload.create` → hook) is
`src/__tests__/lib/actions/payout-without-stages.test.ts:30-90`; a DB-backed guard must copy that
pattern and carry the literal `skipIf(!ENV_READY)` marker or `scripts/test-integration.sh:45` never
discovers it.

**E2E:** no spec under `e2e/` drives the deposit dialog — `transfer-create.spec.ts` drives „Wydatek"
(fed by `TRANSACTION_TRANSFER_TYPES`), and there is no `nth()` on a type select or option-count
assertion anywhere. Restoring the option breaks nothing. Correspondingly the deposit dialog — the
role gate at `deposit-form.tsx:58-61` and the investment condition at `:132` — is an **uncovered
browser surface**; per `AGENTS.md:244` this slice owes an E2E or an `e2e-backlog` Linear issue.

### Exhaustiveness assertions over `TransferTypeT`

Only two exist repo-wide, neither affected (the union is unchanged):
`src/collections/transfers.ts:39-46` (every union member has an admin option) and
`src/lib/constants/transfers.ts:239` (`satisfies Record<TransferTypeT, TransferSpecT>`). The second
bites only if the change adds a **new spec column** — then all thirteen rows must answer it and the
hand-typed `columns` list at `transfer-spec-table.test.ts:31-41` must be extended in the same commit.

## Code References

- `src/lib/constants/transfers.ts:269-271` — `DEPOSIT_UI_TYPES`, the restore target (comment is false)
- `src/lib/constants/transfers.ts:420-443` — `INVESTMENT_TYPES` / `showsInvestment`
- `src/lib/constants/transfers.ts:415-418` — why predicates are deliberately not in the spec table
- `src/hooks/transfers/validate.ts:75-77` — the unconditional `d.investment = null` wipe
- `src/components/forms/deposit-form/deposit-form.tsx:58-61,79,112-116,132,147` — role gate, seeded default, listener, JSX literal conditions
- `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:153` — back door via the edit dialog
- `src/collections/transfers.ts:183` — back door via the admin panel
- `src/lib/db/sum-transfers.ts:151-161,294-300,314-323` — the two disagreeing read paths + the now-false comment
- `src/app/(frontend)/raporty/page.tsx:36-52` — the one unscoped aggregate
- `src/lib/actions/transfers.ts:50-58,252-265,311-315` — raw spread on create/update; the invoice-only update path

## Architecture Insights

- **Predicates, not spec columns, own the `investment` axis.** The spec table covers five axes;
  `investment` uses three of them across two type sets, which is why it was deliberately left out
  (`transfers.ts:415-418`). Consequence: consistency tests are blind here and the hand-written
  membership table in `transfer-constants.test.ts` is the only guard. A new predicate must be
  registered there.
- **`beforeValidate` normalises rather than rejects.** Every existing field rule in `validate.ts`
  either errors on a _missing_ required field or silently nulls a _forbidden_ one. A "reject a
  forbidden value" rule is a new shape in this hook — deliberate, because normalisation is exactly
  what the grandfathering ruling forbids.
- **Hiding a field in JSX is not clearing it.** The deposit form's three type-conditional blocks all
  hide without resetting, and `toData` submits the whole value object. Same root cause for the
  `investment` leak and the stale `vatPlane`.

## Historical Context (from prior changes)

- `change.md` (this change) — the owner's 2026-08-12 correction of the July EDIT, the prod
  measurement, and the six binding rulings.
- Commit `72ddc5d7` (2026-07-21) removed `OTHER_DEPOSIT` from `DEPOSIT_UI_TYPES` one day after row
  `id=3898` was created with it — the regression this change reverses.
- `context/foundation/lessons.md` priors applied above: "before filing 'X isn't validated', follow X
  to its READ path"; "an exhaustiveness assertion only protects while both sides are authored
  independently"; "a guard running on REAL data is still blind if the real data predates the
  feature"; "treat sheet column positions as a frozen external contract".

## Open Questions

1. **Which layer rejects?** Hook-only leaves `transfer-actions.test.ts:212-221` green while it
   asserts the forbidden shape is accepted. Schema-level rejection turns those two red immediately
   (good signal) but must not fire on the _stored_ value during a partial update. Likely answer:
   both — zod rejects an explicitly supplied `investment`, the hook is the backstop for REST/admin.
2. **Is the client-only ADMIN/OWNER gate on `COMPANY_FUNDING` in scope?** Ruling 3 says "stays as
   is", but "as is" is currently unenforced server-side. Needs an owner call: harden, or record as
   accepted.
3. **Stale `vatPlane` on non-`INVESTOR_DEPOSIT` deposits** — adjacent defect, same root cause. Fix
   here or file separately.
4. **E2E** for the deposit dialog — author at the review gate, or file to `e2e-backlog`.
