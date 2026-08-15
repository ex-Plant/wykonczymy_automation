# Review-gate ledger — sheet-column-mapping (EX-690) · 2026-08-14

Zakres: `43e5caa3..HEAD` (5 commitów, 34 pliki). Krok 0.5 (przejście manualne w przeglądarce)
pominięty — repo nie ma skilla `verify-manual-checks`, a sterowanie przeglądarką jest tu zabronione
bez wyraźnej prośby. Checklista manualna czeka w `context/foundation/manual-checks.md`.

## Findings

- [x] 🔴 CRITICAL · fixed · `code-review` · `src/__tests__/lib/actions/kosztorys-compare-with-sheet.test.ts:28` · `vi.mock('@/lib/google/sheet-lookup')` wystawiał tylko `getInvestmentSheetId`, a akcja importuje teraz `getInvestmentSheet` + `MISSING_SHEET` — mock przepisany na `importOriginal` + `getInvestmentSheet`
      test: test-driven-debugging · integration — 12/12 zielonych na `db-test` (5435)
- [x] 🔴 CRITICAL · fixed · `code-review` · `src/__tests__/lib/actions/kosztorys-import.test.ts:26` · ten sam zepsuty mock — poprawiony tak samo
      test: test-driven-debugging · integration — jw.
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/kosztorys/sheet-import/resolve-columns.ts:211` · kolumna z numerem porządkowym (`firstColumn-2`) nie trafiała do `taken` — dopisana razem z `description` i `section`
      test: TDD · unit — dwa nowe testy (kandydat „Lp." pomijany; wskazanie na `B` odrzucane), 30/30 zielonych
- [x] 🟡 WARNING · fixed · `impl-review` · `sheet-problems-block.tsx:24` · werdykt rozdziela się na `canPoint` — bez kolumn do wskazania okno mówi „popraw nagłówki", nie obiecuje wyboru
      test: no automated test — treść komunikatu, pokryta checklistą manualną
- [x] 🟡 WARNING · fixed · `impl-review` · `sheet-problems-block.tsx` · blok odmowy wydzielony do jednego komponentu; oba okna podają tylko `consequence`
- [x] 🟡 WARNING · fixed · `impl-review` · `src/lib/actions/sheets.ts:194` · `isPointableColumn` (0…`LAST_COLUMN_INDEX`) w jednym miejscu, używane przez akcję i przez parser jsonb
      test: TDD · unit — walidacja wejścia akcji
- [x] 🔵 OBSERVATION · fixed · `code-review` · `sheet-import-dialog.tsx:165` · `clean` i werdykt liczą się z tego samego wyrażenia
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/google/sheet-access.ts:9` · `?? ''` przywrócone
      test: no automated test — ścieżka zepsutego env, tańsza do przejrzenia niż do pokrycia
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/actions/sheets.ts:214` · `field` obowiązkowe, martwa gałąź „czyść wszystko" usunięta (aneks w `plan.md`)
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `resolve-columns.ts:36` · `UnresolvedColumnsT` przeniesione do modułu, który go rodzi
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `sheet-lookup.ts:14` · jedna nazwa w całym łańcuchu: `sheetColumnMapping`
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `sheet-compare-dialog.tsx:80` · pusty payload renderuje zdanie zamiast pustego okna
- [x] fixed · `module-cohesion` · `sheet-import/sheet-column-mapping.ts` · kontrakt jsonb (`SheetColumnMappingT`, `parseSheetColumnMapping`, `isPointableColumn`) wydzielony z `columns.ts`
- [x] fixed · `module-cohesion` · `sheet-import/classify-sheet-failure.ts` · klasyfikacja błędów wydzielona z `read-sheet.ts` (spec przemianowany razem z modułem)
- [x] fixed · `structure-scatter` · `classify-sheet-failure.ts:10` · `SheetFailureT` stoi obok `SheetFailureReasonT`; `kosztorys-import.ts` tylko go re-eksportuje
- [x] fixed · `comment-noise` · 2 skreślenia (`sheets.ts` — JSDoc powtarzający nazwę akcji; `sheet-import-gate.ts` — komentarz nad `confirmDisabled`) + 4 przycięcia (`sheet-import-gate.test.ts`, `use-sheet-import.ts`, `sheet-import-dialog.tsx`, `build-import-plan.ts` — ogony opisujące nieistniejący już kod). Szacunek „7 przycięć" był zawyżony: reszta komentarzy przeszła strip test
- [x] 🟡 WARNING · skip · `code-review` · `src/lib/actions/kosztorys-import.ts:210` · źle wskazana kolumna Pomiaru nadpisuje zapisany Pomiar przy „Porównaj" — zapisany Pomiar jest kopią arkusza, odświeżaną przy każdym porównaniu, więc poprawione wskazanie naprawia go samo; blokowanie zapisu byłoby zmianą zachowania na niepewnej przesłance
      test: no automated test — świadomie nieblokowane, do potwierdzenia checklistą manualną
- [x] 🔵 OBSERVATION · skip · `code-review` · `resolve-columns.ts:208` · dwa pola wskazane na tę samą kolumnę: drugie po cichu przepada i zostaje w jsonb bez „Usuń wskazanie" — naprawa to nowy kanał raportowania odrzuconych wskazań, nie jednolinijkowa poprawka
- [x] 🔵 OBSERVATION · skip · `impl-review` · `src/lib/actions/kosztorys-import.ts:196` · nagłówek rozwiązywany trzy razy na jedno porównanie; przekazanie gotowego `ResolvedRobociznaT` do obu builderów to refaktor przez trzy moduły i ich specki
- [x] skip · `feature-first` / `structure-scatter` · `src/lib/google/sheet-lookup.ts:22` · odczyt Payloada z domeną kosztorysu w warstwie infrastruktury — zastane, pięciu importerów łącznie ze stroną; przeniesienie to osobna zmiana
- [x] skip · `module-cohesion` · `sheet-compare-dialog.tsx` · dziewięć komponentów w jednym pliku — zastane, ta zmiana dołożyła 61 linii, nie kształt
- [x] fixed · `impl-review` · `plan.md` · aneks „Kontrakty, które wylądowały inaczej" dopisany przed `## References`
- [x] fixed · `simplify` · `resolve-columns.ts:36` · jedno pojęcie miało dwie nazwy (`resolvedFromMapping` w resolverze, `pointedFields` w UI) — ujednolicone na `pointedFields`; trójka `missingFields`/`candidates`/`pointedFields` wpięta jako `UnresolvedColumnsT` w oba warianty wyniku zamiast trzeciego przepisania. Aneks w `plan.md` skorygowany
- [x] fixed · `simplify` · `resolve-columns.ts:143` · szerokość bloku liczona dwa razy (`resolveRobocizna` + `findCandidates`) — przekazywana raz
- [x] dropped · `simplify` · `sheet-column-picker-options.ts:25` · filtr pustych etykiet jest nieosiągalny (`findCandidates` już je odsiewa), ale to obrona na granicy renderu, tania i pokryta testem — usuwanie jej kosztuje więcej niż zostawienie
- [x] dismissed · `simplify` (reuse / altitude) · brak uwag: fallback wpięty w jedyny wspólny resolver obu okien, walidacja wskazania w jednym module, komponenty odmowy i wyboru współdzielone
- [x] dismissed · `tailwind-v4` · brak naruszeń w pięciu plikach zmiany; `text-amber-600` to zastana konwencja repo, nie dryf tej zmiany
- [x] dropped · `structure-scatter` · `editor/dialogs/` ma 19 plików, 8 z prefiksem `sheet-` — sygnał (N+1) na podkatalog, ale dziś to nie jest śmietnik

## Simplify pass

`/simplify` (4 agenty: reuse / simplification / efficiency / altitude) — 2 zastosowane, 1 pominięte
(potrójne rozwiązywanie nagłówka, już zapisane wyżej jako `skip`), 1 dropped, reuse i altitude bez
uwag. Każda pozycja wpisana wyżej w `## Findings` z tagiem `simplify`; osobnego raportu nie ma —
ledger jest jedynym.

## Tests & suite

- Bramka całodrzewna po fazie 4: `pnpm typecheck` czysty, `pnpm lint` bez nowych błędów
  (2 pre-existing w `test.js` w korzeniu repo), `pnpm test` 2228 zielonych, `pnpm build` przechodzi.
- Bramka powtórzona po poprawkach z przeglądu: `pnpm typecheck` czysty, `pnpm lint` te same 2
  pre-existing błędy, `pnpm test` 2230 zielonych (111 pominiętych — specki DB), `pnpm build`
  przechodzi. Dwa nowe testy resolvera (kolumna porządkowa) i dwa naprawione mocki
  `sheet-lookup` zweryfikowane osobno na `db-test` (5435): 12/12.
- E2E nieuruchamiane (~1h, tylko na wyraźną prośbę). Ta zmiana nie ma jeszcze specki E2E — obsługa
  wskazywania kolumny jest przejściem przeglądarkowym z `manual-checks.md`.

## Stan slice'a

**In review, nie Done.** Kod, przegląd i bramka zamknięte; zostaje przejście manualne
(`context/foundation/manual-checks.md` — pozycje tej zmiany nieodhaczone). Bez nich slice nie idzie
do `Done` i nie jest archiwizowany.
