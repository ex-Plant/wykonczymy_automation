# Review-gate ledger — katalog-praca-picker · 2026-09-01

Zakres: commity `173bbe92`, `08393235`, `5c7a4330`, `83014e3d` + niezacommitowana faza 3
(„Ukryj już dodane"). Fan-out: `10x-impl-review`, `code-review`, `tailwind-v4-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.

Step 0.5 (przebieg przeglądarkowy) pominięty na polecenie właściciela — przeglądarkę zajmuje
równoległy agent. Ręczna weryfikacja zostaje w `context/foundation/manual-checks.md`.

## Findings

- [x] 🔴 CRITICAL · fixed · impl-review · `src/lib/kosztorys/work-catalogue/already-in-kosztorys.ts:19`
      · `prace` / `praca` / `KosztorysPracaT` łamią `local/no-domain-drift`, `pnpm lint` padał na 5
      błędach — przemianowane na `kosztorysItems` / `item` / `KosztorysItemRefT`
      test: no automated test · — lint jest testem tej reguły i jest w bramce
- [x] 🟡 WARNING · fixed · code-review · `add-items-from-catalogue-dialog.tsx:126` · odrzucone RPC
      (zerwane połączenie, klient na starym deployu) nie rozwiązuje się do `{success:false}`, więc
      „Dodaj" zostawało wyłączone na zawsze i bez komunikatu — `try/catch/finally` + toast
      test: no automated test · unit — nie ma tu harnessu do renderu komponentów; ścieżka wchodzi
      do manual-checks jako pozycja o zachowaniu przy błędzie
- [x] 🟡 WARNING · fixed · code-review · `add-items-from-catalogue-dialog.tsx:104` · zaznaczona praca
      mogła zostać ukryta przez przełącznik, dalej licząc się do „Dodaj (N)" i lądując w rozpisce bez
      wiersza do odznaczenia — zaznaczone pozycje nie są ukrywane nigdy
      test: no automated test · e2e — czysto interakcyjne; wpisane do manual-checks
- [x] 🟡 WARNING · fixed · code-review + impl-review · `already-in-kosztorys.ts:19` · cała rozpiska
      przefałdowywana na każdy znak w szukajce (~45 przebiegów na pozycję × 1000 pozycji) —
      `kosztorysCatalogueKeys` wydzielone, cache'uje się na samej rozpisce
- [x] 🟡 WARNING · fixed · impl-review + comment-noise ·
      `kosztorys-row-actions-menu.tsx:49` · komentarz twierdził, że `onAddFromCatalogue` dzieli bramkę
      z `savableItemId` — nieprawda i sprzeczność z `kosztorys-v2-columns.tsx:247`
- [x] 🟡 WARNING · fixed · impl-review · `plan.md` · faza 3 istniała wyłącznie jako wiersz w Progress —
      dopisana sekcja z decyzjami (domyślnie ukryte, zakres = cały kosztorys, dopasowanie po
      `matchKey`, zaznaczone nigdy nie znika) i kontraktem
- [x] fixed · structure-scatter + feature-first · `editor/dialogs/use-catalogue-picker.tsx` · piąty
      wariant wzorca „wyzwalacz w menu + dialog, który nie może być jego dzieckiem", z powtórzonym
      uzasadnieniem — przeniesione do udokumentowanego domu jako
      `editor/actions/catalogue-picker-host.tsx`, komentarz wskazuje na `KosztorysActionsProvider`
- [x] fixed · module-cohesion · `add-items-from-catalogue-dialog.tsx:25` · typ kontraktu zadeklarowany
      dwa razy — `KosztorysItemRefT` eksportowany z helpera i użyty w propsie
- [x] fixed · module-cohesion + feature-first · `add-items-from-catalogue-dialog.tsx:16` · dwa osobne
      `import type` z tego samego modułu + jedyny import względny w slicie — scalone, alias
- [x] fixed · impl-review · `kosztorys-add-menu.tsx:33` · `pickerOpen` po przeniesieniu pickera trzymał
      już tylko dialog szablonów — `presetDialogOpen`
- [x] fixed · impl-review · `already-in-kosztorys.test.ts` · `matchKey` wyliczany funkcją, którą test
      bada, więc asercja o fałdowaniu nie mogła paść; brak przypadku `unit: null`; zduplikowane id —
      klucze wpisane wprost, dwa nowe przypadki, rozłączne id
- [x] fixed · code-review · `add-items-from-catalogue-dialog.tsx:173` · „Ukryj już dodane (0)" nad
      „Ładowanie katalogu…" — licznik wstrzymany do czasu wczytania cennika
- [x] fixed · comment-noise · `kosztorys-row-actions-menu.tsx:87` · komentarz o `size-full` nad
      elementem, który tej klasy nie ma; pełniejsza wersja stoi w `cell-menu-trigger.tsx:8`
- [x] fixed · comment-noise · `add-items-from-catalogue-dialog.tsx:67`, `:164`,
      `kosztorys-add-menu.tsx:31`, `:45`, `already-in-kosztorys.ts` · zdania powtarzające kod przycięte,
      uzasadnienia zostawione
- [x] fixed · feature-first · `AGENTS.md:267` · reguła „katalog hooka idzie za liczbą katalogów
      konsumentów" podawała nieaktualną ścieżkę `useInlineRename` (`src/hooks/` → `editor/hooks/`)
- [x] dismissed · impl-review · `kosztorys-row-actions-menu.tsx:51` · `onAddFromCatalogue` siedzi w
      pakiecie `item`, a nie w `SectionActionsT` jak mówił kontrakt fazy 2 — mechaniczny skutek
      zatwierdzonej decyzji „oba polecenia katalogowe w grupie »Praca«"; kontrakt poprawiony w planie
- [x] dropped · impl-review · `kosztorys-add-menu.tsx:77` vs `kosztorys-row-actions-menu.tsx:107` · ten
      sam dialog pod dwiema nazwami („Praca z katalogu…" / „Wybierz pozycję z katalogu prac") — obie są
      spójne ze swoim menu (rzeczowniki po „Dodaj →" vs symetria z „Zapisz pozycję…"), etykiety wybrał
      właściciel; poprawiony tylko nieaktualny wiersz w manual-checks
- [x] dropped · tailwind · `add-items-from-catalogue-dialog.tsx:158` · `max-h-[55vh]` powtórzone w
      trzech dialogach — jednostka viewport nie ma odpowiednika w skali, a token `@theme` na jeden
      wymiar okna kosztuje więcej pośrednictwa, niż daje
- [x] dropped · code-review · `add-items-from-catalogue-dialog.tsx:97` · pusta sekcja nie pojawia się
      jako cel — sekcje bez pozycji są niewidoczne w całym edytorze (`sectionRepresentatives`), picker
      to dziedziczy; sprzed slice'a
- [x] dropped · code-review · `use-kosztorys-editor.ts:962` · dodane prace mogą wpaść pod aktywny filtr
      siatki i nie pokazać się mimo toastu — istniejący kontrakt filtrów, ten sam co przy „Dodaj → Praca"
- [x] skipped · impl-review · `add-items-from-catalogue-dialog.tsx:179` · zaznaczenie wykluczone przez
      szukajkę wciąż liczy się do „Dodaj (N)" — kumulacja mimo zmiany frazy jest zamierzona i stoi
      wprost w manual-checks; przycisk „Wyczyść zaznaczenie" to nowa funkcja, nie poprawka
- [x] skipped · structure-scatter · `editor/hooks/use-sheet-import.ts` · trzyma stan otwarcia w
      `KosztorysEditorBody`, więc otwarcie importu przerysowuje siatkę — dokładnie to, przed czym broni
      wzorzec hosta; migracja to osobna zmiana poza tym slice'em
- [x] dismissed · module-cohesion · `src/components/tables/work-catalogue.tsx` · dwie listy kolumn w
      jednym pliku to dwa złożenia tego samego zbioru, nie dwie sprawy; rozdzielenie rozwidliłoby
      definicje kolumn

- [x] filed · reuse-scan · `add-items-from-catalogue-dialog.tsx:51` · zaznaczanie wierszy obchodzi
      brak modelu w `DataTable` (kolumna `select` + `SelectedIdsContext`) — zmiana współdzielonego
      prymitywu używanego przez kilkanaście tabel, własny przegląd — filed EX-759
      test: TDD · unit — zapisane w zgłoszeniu
- [x] filed · gate · e2e · przepływ przeglądarkowy slice'a (zaznaczanie, filtr, sekcja docelowa,
      przełącznik) nie ma specyfikacji Playwrighta — filed EX-760 (etykieta `e2e-backlog`)
- [x] dismissed · reuse-scan · `add-items-from-catalogue-dialog.tsx:168` · „czwarty ręcznie sklecony
      checkbox + label" — trzy istniejące miejsca mają trzy różne style (wiersz menu z hover, stopka
      formularza, przełącznik filtra); wspólny komponent to `<label className={…}><Checkbox/>{children}</label>`,
      czyli parametry równe kodowi
- [x] dismissed · reuse-scan · `add-items-from-catalogue-dialog.tsx:114` · przełączanie elementu w
      tablicy — drugie, nie trzecie miejsce (`filter-multi-select.tsx:151`); jednolinijkowy ternar
      wyniesiony do `lib/utils` nic nie oszczędza
- [x] dropped · reuse-scan · `add-items-from-catalogue-dialog.tsx:177` · komunikat ładowania/pustki
      dzieli klasy z `add-sections-from-preset-dialog.tsx:118` — powtarza się sam `className`, teksty są
      różne; osobny `DialogNotice` na cztery użycia to więcej pośrednictwa niż zysku
- [x] dismissed · reuse-scan · `add-items-from-catalogue-dialog.tsx:104` · ta sama reguła co
      `activeOrSelected` (`lib/utils/is-active-ref.ts:11`, lekcja EX-643), ale tamten bierze JEDEN
      `selectedId` i nie oddaje licznika; rozszerzenie pogorszyłoby trzy istniejące wywołania
- [x] dismissed · reuse-scan · `add-items-from-catalogue-dialog.tsx:155` · własny kontener przewijania
      mimo `max-h-[90vh] overflow-y-auto` w `DialogContent` — celowy wariant tych dwóch dużych okien,
      identyczny z `add-sections-from-preset-dialog.tsx:111`: stopka i szukajka mają stać w miejscu

## Simplify pass

`/simplify` jest poleceniem wbudowanym CLI i nie da się go wywołać programowo z tej sesji — przebieg
mutujący przeszedł ręcznie, na tym samym materiale: wszystkie znaleziska fix-first z fan-outu
zaaplikowane powyżej, plus `primitive-reuse-scan` jako druga soczewka na reuse.

## Tests & suite

- `pnpm typecheck` — PASS
- `pnpm lint` — PASS dla slice'a; zostały 4 błędy sprzed niego (`src/app/(legal)/**` `<a>` zamiast
  `<Link>`, `console` w `test.js`)
- `pnpm test` — PASS, 226 plików / 3145 testów (54 pliki / 197 testów pominiętych)
- `pnpm build` — PASS
- `pnpm test:e2e` — NIE uruchamiane (ok. godzina na przebieg, tylko na wyraźną prośbę); pokrycie
  odłożone do EX-760
