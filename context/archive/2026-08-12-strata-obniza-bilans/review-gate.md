# Review-gate ledger — strata-obniza-bilans (EX-675) · 2026-08-13

Naprawione ustalenia usunięte przy archiwizacji (2026-08-13) — są już po prostu kodem.
Poniżej zostają tylko te, które niosą decyzję: odrzucone, porzucone, pominięte i zgłoszone.

## Findings

- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/hooks/transfers/validate.ts:133` · poszerzony
      fallback każe `needsExpenseCategory` czytać inwestycję ze _stanu zapisanego_, więc legacy
      `CORRECTION` z inwestycją i bez kategorii odrzuciłby PATCH samej faktury. Zapytanie na
      lokalnej kopii produkcji (docker 5433, restore z dumpa): **0 takich wierszy**. Nie ma kogo
      zepsuć. (Nie odpytuję Neona — to reguła projektu.)

- [x] skipped · impl-review · `src/lib/kosztorys/summary-economics.ts` · argument o wymuszeniu
      propa dotyczy też domyślnego `loss = 0` w `computeDoZaplatyRM` / `computeMixedSettlement` —
      ale to ostatni parametr pozycyjny z 35 miejscami wywołania, więc wymuszenie go dopisuje `, 0`
      w kilkunastu specach bez zysku: obie funkcje są wołane wyłącznie z komponentów, które właśnie
      uszczelniono.

- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/investments/financial-stats.tsx:24`
      · routing kafelków kredyt/koszt idzie po stringu etykiety, więc kategoria wydatku nazwana
      dokładnie „Strata" trafiłaby do zielonego wiersza i chowałaby się razem z kafelkiem straty.
      Mechanizm sprzed tej zmiany (`Wpłaty`, `Rabat netto` niosły go tak samo), a plik sam opisuje
      ten kompromis. Odnotowane, bo ta zmiana dokłada najbardziej kolizyjną nazwę.

- [x] filed · impl-review · `e2e/` · brak jakiegokolwiek spec-a Playwrighta dotykającego straty, a
      zmiana jest przeglądowa na trzech powierzchniach (listing / v1 / v2 + podgląd klienta).
      Zgłoszone jako **EX-684** z etykietą `e2e-backlog`, ze scenariuszami i ryzykiem trzech
      mechanizmów. (E2E nie odpalane — pełny przebieg to ~1h i wymaga wyraźnej prośby.)

- [x] filed · module-cohesion + structure-scatter · `src/lib/db/map-category-costs.ts` ·
      `src/lib/kosztorys/summary-economics.ts:215-260` · dwa moduły-worki sprzed tej zmiany:
      trzy rodzaje eksportów w pliku kształtującym widok wewnątrz warstwy danych, oraz polityka
      klasyfikacji wpłat doklejona do arytmetyki rozliczenia. Zgłoszone jako **EX-685** —
      wieloplikowy refaktor, za duży na tę bramkę i bez związku ze stratą.

- [x] dropped · structure-scatter · `src/hooks/` · dwie niepowiązane rzeczy pod jedną nazwą (hooki
      Reacta w korzeniu, hooki kolekcji Payloada w `transfers/`, plus dwa pliki-sieroty w korzeniu).
      Sprzed tej zmiany, 5 plików, edycja slice'a trafiła do właściwego — za mała dźwignia.

- [x] dropped · comment-noise · `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:44`
      · klauzula pozycyjna („the deduction step between the wpłaty and the closing figure")
      powtarza to, co widać w `buildSettlementGroups`; nośna jest tylko druga połowa („Face value on
      both axes"). Kosmetyka nieprzekraczająca progu zmiany.

- [x] dismissed · comment-noise · `src/lib/kosztorys/types.ts:161`,
      `src/components/kosztorys/summary/summary-panel-content.tsx:68`,
      `src/components/investments/investment-summary-panel.tsx:79` · to samo uzasadnienie (prop poza
      bramką `financials`) trzy razy wzdłuż łańcucha propsów. Każde z osobna przechodzi STRIP TEST, a
      bramka jest widoczna tylko w panelu — powtórzenie jest tu celowe, nie szum.

- [x] dismissed · comment-noise · `src/components/kosztorys/summary/settlement-groups.ts:25` ·
      ogon nagłówka `lossRows` opisuje `if (lossAmount === 0) return []`, ale niesie powód
      („investment with no strata says nothing"), którego kod nie mówi. Zostaje.

- [x] dismissed · tailwind-v4 · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:173,287`
      · `h-[calc(100dvh-…)]` i `style={{ left: guideX }}` — obie poza tym diffem i obie poprawne:
      żaden token nie przechodzi przez nawiasy, a offset guide'a liczy się per klatkę.

- [x] dismissed · simplify · `src/components/kosztorys/summary/settlement-groups.ts:92,107` ·
      podpowiedź składana z fragmentu zależnego od danych (`'wpłaty netto i stratę'`). Rozpisanie obu
      wariantów w całości podwaja tekst, a wariant bez straty to najczęstszy przypadek — splice
      zostaje.

- [x] dropped · simplify · `src/components/kosztorys/summary/settlement-groups.ts:27` ·
      `lossRows(lossAmount, span)` z nienazwanym boolem. Dwa wywołania w jednym pliku, funkcja
      prywatna — kosmetyka poniżej progu zmiany.

- [x] dismissed · simplify · `src/lib/kosztorys/types.ts:164` · `investmentLoss` / `lossAmount` /
      `totalLoss` na trzech warstwach. Dokładna kalka istniejącego łańcucha rabatu — zmiana jest
      zgodna z sąsiadem, a nie nowatorska; ujednolicanie to osobny refaktor.

- [x] dismissed · simplify · `/raporty` · stare straty bez inwestycji dalej wchodzą do raportu
      globalnego jako kafelek podnoszący bilans. Wymóg inwestycji pilnuje tylko nowych wierszy;
      zapytanie na lokalnej kopii produkcji pokazało **0 takich wierszy** (patrz ustalenie wyżej).

## Simplify pass

Dwa przebiegi `/simplify` (reuse+efficiency, simplification+altitude) — 5 naprawionych,
3 odrzucone jako celowe, 1 porzucona kosmetyka, 1 pominięta (pozycyjne `loss` w
`summary-economics.ts`, patrz ustalenie wyżej).

## Tests & suite

- `pnpm typecheck` — czysto poza trzema błędami `importMap.js` sprzed tej zmiany (plik generowany, gitignore).
- `pnpm lint` — 0 błędów, 79 ostrzeżeń, wszystkie sprzed tej zmiany.
- `pnpm test` — 2154 zielone, 105 pominiętych (specy DB idą osobno).
- `pnpm test:integration` — 102 zielone (33 pliki, baza 5435).
- `pnpm test:parity` — 3 zielone. Za pierwszym razem czerwone na podłodze zbioru
  (`0 kosztorysItems`): `db-test` był świeżo po `db:import:test` z pustym kosztorysem, więc
  zgodnie z AGENTS.md dosiany `pnpm seed:kosztorys:test`.
- `pnpm build` — przechodzi.
- E2E: **nie odpalane** (pełny przebieg ~1h, wymaga wyraźnej prośby); brakujący spec zgłoszony jako
  **EX-684** z etykietą `e2e-backlog`.
