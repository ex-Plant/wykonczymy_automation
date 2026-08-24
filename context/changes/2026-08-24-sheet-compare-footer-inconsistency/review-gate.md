# Review-gate ledger — sheet-compare-footer-inconsistency · 2026-08-24

Zakres: cały branch `sheet-compare-footer-inconsistency` vs `staging` (2 commity, 9 plików,
+275/−24). Fan-out: `/code-review`, `comment-noise-audit` (flag-only, diff-scoped),
audyt struktury (feature-first + module-cohesion + structure-scatter, diff-scoped).
Odpadły: `/10x-impl-review` (brak `plan.md`), `tailwind-v4-audit` (diff nie dodaje klas).

## Findings

- [x] 🟡 WARNING · fixed · code-review · `sheet-import-gate.ts:27` · dwa okna wciąż przeczyły sobie,
      tylko odwrotnie: import ✓ zielony tam, gdzie porównanie ⚠ (arkusz, którego „R netto" ląduje na
      sumie oferty). Naprawione u źródła, nie w widoku — `CANDIDATES` w `footer-totals.ts` jest teraz
      per-wiersz: „wartość netto" nadal szuka wśród wszystkich figur, „R netto" tylko wśród swojej
      imiennej. Oba okna zgadzają się z definicji, `againstNamedFigure` zniknął.
      test: TDD · unit — `footer-totals.test.ts` „refuses „R netto" a figure its label does not name"
- [x] 🟡 WARNING · fixed · code-review · `sheet-compare-dialog.tsx:228` · arkusz bez kolumny Pomiar
      (opcjonalna w nagłówku) dostawał „Arkusz nie zgadza się sam ze sobą" z pięciocyfrową różnicą,
      bo `appValue` spadał na sumę Przedmiaru. `appValue` jest teraz `number | null`,
      `footerDisagreements` pomija wiersz bez odpowiednika, oba okna renderują „nie policzyliśmy".
      test: TDD · unit — dwa przypadki w `footer-totals.test.ts` (wiersz + `footerDisagreements`)
- [x] 🔵 OBSERVATION · fixed · code-review · `sheet-footer-report.ts:22-27` · `matches` nadpisywane
      bez `matchedAgainst` łamało niezmiennik typu. Zniknęło razem z plikiem — nie ma już mutacji
      po fakcie.
      test: TDD · unit — pokryte przez pierwszy przypadek wyżej (`matchedAgainst: null`)
- [x] 🔵 OBSERVATION · fixed · code-review · `sheet-compare-dialog.tsx:227` · martwe `?? 0` przy
      `sheetValue` — filtr zawęża teraz typem (`total is … & { sheetValue: number }`).
- [x] 🔵 OBSERVATION · fixed · code-review · `sheet-compare-dialog.tsx:129-131` · „Rozjazd" liczył się
      z podanego „R netto" nawet wtedy, gdy blok niżej właśnie uznał tę kwotę za nieswoją. Ten sam
      strażnik co przy „wartość netto": wiersz wchodzi tylko przy `matchedAgainst === 'executedNet'`.
      Pre-existing, nie regresja — naprawione, bo jedna linia i ta sama przyczyna.
- [x] fixed · structure · `sheet-footer-report.ts` · logika domenowa w katalogu widoków (jedyny plik
      w `dialogs/` operujący na `FooterComparisonT`, a bliźniaczy `footerDisagreements` ten sam commit
      już przeniósł do `footer-totals.ts`). Plik skasowany, zachowanie wciągnięte do `CANDIDATES`.
- [x] fixed · structure · `calc.ts` · 0,005 deklarowane w pięciu miejscach pod trzema nazwami
      (`MATCHES` ×2, `TOLERANCE`, goły literał w `sheet-rates-block.tsx:319`) → jeden
      `MONEY_TOLERANCE` w `calc.ts`. `QTY_TOLERANCE` i `TOLERANCE` z `subcontractor-price-guard.ts`
      celowo NIE złożone — inne osie.
- [x] fixed · structure · `__tests__/…/dialogs/sheet-footer-report.test.ts` · spec przeniesiony do
      `__tests__/lib/kosztorys/sheet-import/footer-totals.test.ts` razem z logiką, którą opisuje.
- [x] fixed · comment-noise · `sheet-import-dialog.tsx:265` · komentarz twierdził, że „R netto"
      dodatkowo mierzy się z etapami, które import zastąpi — nieprawda, obie strony tego wiersza
      pochodzą z arkusza. Zdanie usunięte.
- [x] fixed · comment-noise · `sheet-import-gate.ts:9` · „Footer sums the sheet and the app disagree
      on" opisywał porównanie, którego już nie ma. Przepisane na arkusz-kontra-arkusz.
- [x] dismissed · comment-noise · pozostałe wskazania audytu (5 delete / 5 trim / 6 flagged) ·
      raport zginął przy kompaktowaniu kontekstu; przeszedłem diff komentarz po komentarzu ręcznie
      i poza dwoma wyżej nic nie łamie STRIP TESTU — komentarze w tym diffie niosą „dlaczego"
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
