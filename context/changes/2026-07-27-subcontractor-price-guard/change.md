---
change_id: subcontractor-price-guard
title: Guard the subcontractor price against eating the client margin
status: implemented
created: 2026-07-27
updated: 2026-07-27
archived_at: null
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
  every total — only the colour changes.
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
