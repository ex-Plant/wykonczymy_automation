# Review-gate ledger — add-item-section-picker · 2026-08-31

Zakres: `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx`,
`src/components/ui/dropdown-menu.tsx` (commity 815a3097, d33de2ed, 831d5c3d).
Reszta zmian na tej gałęzi należy do równoległej sesji (`a58a404a`, delete-policy /
row-actions-menu / kolumny) — poza zakresem, nie recenzowana i nie ruszana.

Fan-out zredukowany do przeglądu w wątku głównym: diff to dwa pliki i ~50 linii, więc czterech
agentów recenzujących byłoby ceremonią bez zwrotu (reguła proporcjonalności nakładu).
Cztery kąty (`reuse` / `simplification` / `efficiency` / `altitude`) przeszedłem ręcznie.

## Findings

Przed przycięciem: 3 fixed, 1 deferred (EX-752), 2 dismissed, 2 dropped · 0 open.
Findingi „fixed" wycięte przy archiwizacji — ich trwałym zapisem są commity 815a3097 / d33de2ed /
831d5c3d; zostaje to, czego git nie niesie: decyzje o nierobieniu.

- [x] fixed · comment-noise · `kosztorys-add-menu.tsx:43` · sześciolinijkowy komentarz nad „Praca"
      skrócony do pięciu i odchudzony — treść trzymająca uzasadnienie (brak domyślnej sekcji,
      po co licznik, czemu nie puste podmenu) zostaje, narracja wypada
- [x] dropped · reuse · `kosztorys-add-menu.tsx:67` · „(n poz.)" renderuje się w trzech miejscach
      (`section-header-cell.tsx:113`, `add-sections-from-preset-dialog.tsx:219`, tutaj) — helper na
      interpolację jednego stringa miałby parametry równe swojemu ciału, a każdy z trzech ma inny
      markup; format celowo zgrany z paskiem sekcji
- [x] dropped · simplification · `kosztorys-add-menu.tsx:51,58` · `<Hammer /> Praca` powtórzone
      w obu gałęziach ternary — wyciągnięcie do fragmentu wprowadza wskaźnik na dwie linijki JSX
      i czyta się gorzej niż dwie samodzielne gałęzie
- [x] dismissed · altitude · `kosztorys-add-menu.tsx:50` · „Praca" bez sekcji woła `handleAddSection`,
      czyli to samo co pozycja „Sekcja" — nie duplikat logiki, tylko dwa wejścia do tej samej
      operacji; sekcja i tak rodzi się z pierwszą pozycją w środku, więc etykieta nie kłamie
- [x] dismissed · efficiency · `kosztorys-add-menu.tsx:60` · `subtotals.map` renderuje się przy
      każdym otwarciu menu; `subtotals` to istniejące memo nad pełnym zbiorem, lista sekcji jest
      rzędu dziesiątek, brak gorącej ścieżki
- [x] fixed · verify · `ui/dropdown-menu.tsx:204` · `DropdownMenuSubTrigger` nie miał stylów
      `data-[disabled]`, które niosą `Item` i `CheckboxItem`, więc `disabled` na podmenu niczego nie
      wyszarzało (ujawnione przez właściciela w przeglądarce) — poprawione w prymitywie, 831d5c3d
      test: no automated test · — czysta klasa CSS w prymitywie; asercja na string klas testowałaby
      implementację, nie zachowanie
- [x] fixed · verify · `kosztorys-add-menu.tsx:49` · pusta rozpiska pokazywała strzałkę podmenu nad
      listą, z której nic nie dało się wybrać — bez sekcji podmenu nie renderuje się wcale, 831d5c3d
      test: no automated test · — gałąź JSX bez modelu; ryzyko przeniesione do EX-752
- [x] deferred · gate · slice ma ryzyko browserowe (client → server action → DB), E2E odroczone
      i zgłoszone jako **EX-752** (`e2e-backlog`, projekt Wykonczymy)
      test: no automated test przy shipowaniu · e2e — dyspozycja zapisana w issue

## Simplify pass

`/simplify` przejechany w wątku głównym (zakres zawężony do dwóch moich plików, bo mutująca ścieżka
nie może dotknąć brudnych plików równoległej sesji) — 1 zastosowany, 0 wstrzymanych, 2 odrzucone,
2 porzucone. Bez osobnego raportu: findingi siedzą wyżej, otagowane źródłem.

## Tests & suite

- typecheck: ✓ (po każdej zmianie, ostatni raz po skróceniu komentarza)
- lint: 4 błędy, wszystkie zastane poza zakresem (`(legal)/privacy|terms|usuwanie-danych`, skrypt
  sortowań) — nie wprowadzone przez ten slice
- vitest: ✓ 2992 passed / 178 skipped (uruchomione przed poprawką pustej rozpiski; ta nie dotyka
  żadnego modułu objętego testami)
- e2e: nieuruchamiane — dług zapisany jako EX-752
