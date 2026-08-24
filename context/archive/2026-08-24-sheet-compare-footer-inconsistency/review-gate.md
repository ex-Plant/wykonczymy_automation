# Review-gate ledger — sheet-compare-footer-inconsistency · 2026-08-24

Zakres: cały branch `sheet-compare-footer-inconsistency` vs `staging` (2 commity, 9 plików,
+275/−24). Fan-out: `/code-review`, `comment-noise-audit` (flag-only, diff-scoped),
audyt struktury (feature-first + module-cohesion + structure-scatter, diff-scoped).
Odpadły: `/10x-impl-review` (brak `plan.md`), `tailwind-v4-audit` (diff nie dodaje klas).

Przycięte przy archiwizacji (2026-08-24). Tally przed przycięciem: **10 fixed, 3 dismissed · 0
otwartych**. Naprawione znaleziska wypadły — ich trwałym zapisem jest commit `3e4a184c` i sam kod;
zostaje to, czego git nie trzyma: decyzje o NIE-zmienianiu czegoś i powód.

## Findings

- [x] dismissed · comment-noise · pozostałe wskazania audytu (5 delete / 5 trim / 6 flagged) ·
      raport zginął przy kompaktowaniu kontekstu; przeszedłem diff komentarz po komentarzu ręcznie
      i poza dwoma naprawionymi nic nie łamie STRIP TESTU — komentarze w tym diffie niosą „dlaczego"
      (który wiersz arkusza, dlaczego osobny blok, dlaczego nie ta kolumna).
- [x] dismissed · code-review · `MoneyBlock`, arkusz bez wierszy stopki, refaktor bramki ·
      sprawdzone jawnie: brak osieroconych bindingów po usunięciu akapitu, blok zwraca `null`,
      `report` jest nieopcjonalny więc stare i nowe wyrażenie nie mogą się rozjechać.
- [x] dismissed · structure · `footerDisagreements`, prop `sides`, `SheetFooterBlock` w swoim
      dialogu, folder zmiany · umiejscowione poprawnie.

## Simplify pass

Krok wykonany w głównym wątku razem z triage (findings wyżej są jego zapisem — 10 fixed, 3 dismissed,
0 otwartych). Osobnego raportu `/simplify` nie ma: wszystkie fixy to te same znaleziska z fan-outu,
zastosowane od razu, bez drugiej listy do synchronizowania.

## Tests & suite

- `pnpm typecheck` — zielony
- `pnpm test` (vitest, cały zestaw jednostkowy) — zielony
- `pnpm exec eslint` na dotkniętych plikach — czysty
- `pnpm test:e2e` — nieuruchamiane (nie proszono; ~1h)
