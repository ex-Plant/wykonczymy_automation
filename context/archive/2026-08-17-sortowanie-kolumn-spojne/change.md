---
change_id: sortowanie-kolumn-spojne
title: Spójne sortowanie w nagłówkach wszystkich kolumn siatki kosztorysu
status: archived
created: 2026-08-17
updated: 2026-08-18
archived_at: 2026-08-18T08:45:00Z
branch: null
worktree: null
---

## Notes

Dziś sortowanie jest wybiórcze — wisi na helperze `title()` w
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`, więc każda kolumna, która nie
przechodzi przez ten helper (albo przechodzi z `sortable = false`), zostaje bez sortowania.

Braki do domknięcia:

- kolumny ilości etapów — renderują `StageHeader`, który w ogóle nie ma pozycji sortowania
- „<etap> netto" / „<etap> brutto" — `stageValueHeader`, celowo bez sortowania, bo `columnSortValue`
  nie ma case'a dla dynamicznych id per etap
- „Komentarz" — `title('note', opts, false)`, bez zapisanego powodu
- „Źródło ceny wykonawcy" i „Mnożnik" — `sortable = false`

Kluczowe ustalenie z rozpoznania: przy „Źródle ceny" i „Mnożniku" podany w komentarzu powód
(wartości kategorialne / z myślnikami) NIE jest prawdziwą blokadą. Prawdziwa jest taka, że id tych
kolumn (`priceMode`, `priceCoeff`) nie są polami wiersza — pola są per-plan (`OVERRIDE_FIELDS`),
więc gałąź `default` w `sort-value.ts` czytałaby `undefined` i sortowanie po cichu nie robiłoby nic.
To klasa EX-487.

Cel zmiany jest systemowy, nie punktowy: sortowanie ma być właściwością KAŻDEJ kolumny domyślnie,
a brak sortowania — świadomym, uzasadnionym wyjątkiem, nie skutkiem ubocznym tego, którego helpera
nagłówka użyto.
