---
change_id: subcontractor-price-guard
title: Guard the subcontractor price against eating the client margin
status: archived
created: 2026-07-27
updated: 2026-07-28
archived_at: 2026-07-28T17:47:06Z
branch: ex-607-kosztorys-section-footer-row
worktree: null
---

## Notes

blokada ceny podwykonawcy powyżej 80% ceny klienta (błąd) + ostrzeżenie powyżej ceny z globalnego mnożnika

Design agreed in conversation (2026-07-27):

- One pure rule in `src/lib/kosztorys/subcontractor-price-guard.ts`, threshold a code constant
  (`MAX_CLIENT_SHARE = 0.8`), not a per-investment setting.
- `error` when the subcontractor price exceeds 80% of the client price; `warning` when it merely
  exceeds the price the investment's global coefficient would produce. Warning still counts into
  every total — only the colour changes. **(The warning tier was dropped at the review gate — see
  the rulings below. What shipped is the error rung alone.)**
- Skip the check when the client price is ≤ 0 — there is no margin to measure against.
- Compare with a half-grosz tolerance so a flat amount typed at exactly the coefficient price does
  not go amber on a floating-point remainder.
- Three consumers of that one rule:
  1. **Write rejected at the input** — the „Mnożnik" and „Cena" cells refuse a value that would
     breach 80%; red cell + tooltip naming the reason and the maximum price, mirroring the
     `removeBlockReason` tooltip pattern in `kosztorys-row-actions-menu.tsx`.
  2. **Standing row state** — the „Cena" cell renders red / amber with a tooltip whenever the rule
     says so, whatever put the price there. This is what catches a lowered client price or a raised
     global coefficient, which the input guard alone cannot see.
  3. **Settings** — `kosztorys-global-settings.tsx` rejects a global coefficient above 0.8, since
     one field would otherwise breach the rule across every „auto" row at once, unfixable row-side.
- Deliberately out: no summary banner, no bad-row counter, no DB column for the threshold. Totals
  are untouched.

## Refinements after the three planned phases (2026-07-27)

Eight commits of follow-up, then the review gate. What changed from the design above:

- **„Cena" is editable in EVERY mode, and a typed price WRITES „kwota stała"** („Mnożnik" then shows
  „—"). The owner rejected back-computing a multiplier from a typed price: the column you type into
  is what picks the source, so nobody has to visit „Źródło" first.
- **Rejection is a draft machine, not a blocked write.** Keystrokes commit as they go, so a refused
  final keystroke would otherwise leave the last accepted PREFIX standing as the user's choice. Both
  editable cells now share `useOverrideEdit` over the pure `priceKeystroke`/`priceSettle` pair in
  `src/lib/kosztorys/subcontractor-price-edit.ts`: the entry snapshot is restored on blur and a toast
  says so out loud. Escape abandons the edit; Enter hands over to blur so there is one settle path.
- **Switching „Źródło" re-seeds from the price on screen** (`modeChange`). The two modes read the
  same value slot differently, so carrying the number across unread turned a 200 zł flat price into a
  multiplier of 200. The switch now changes the source, not the price.
- **The guard grew a negative floor**, ahead of the zero-client-price short-circuit that used to let
  negative prices through on exactly the rows still being priced. The settings fields grew `min={0}`
  to match.
- **A refusal is marked by colour AND a shared `AlertIcon` glyph** on the trailing edge of the cell —
  colour alone can't carry a verdict to a colour-blind reader, and across a thousand rows a tinted
  number reads as a formatting quirk.

Owner rulings at the gate (2026-07-28):

- **The 80% ceiling measures against the list price, before any rabat.** The rabat is the company
  giving away part of its own cut; letting it drag the ceiling down would make a discount
  retroactively re-price the subcontractor, who never agreed to fund it.
- **The amber warning tier is gone entirely** — not restyled, removed. Typing a flat price above the
  global multiplier is an ordinary thing to do, so the tier lit up across rows that were all
  perfectly fine and the colour stopped meaning anything. `checkSubcontractorPrice` now returns
  `string | null` (a refusal or nothing) instead of a severity ladder, and `--color-warning` plus
  `AlertIcon`'s second tone went with it as dead code. The two rules that remain — the 80% ceiling
  and the negative floor — both refuse a write.

Review gate: `review-gate.md` (all findings closed; E2E owed as EX-614). Slice is **in review** —
the manual checks are still unticked.
