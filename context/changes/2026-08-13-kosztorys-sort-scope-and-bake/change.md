---
change_id: kosztorys-sort-scope-and-bake
title: Zakres sortowania w menu kolumny + utrwalanie kolejności całego kosztorysu
status: implemented
created: 2026-08-13
updated: 2026-08-13
archived_at: null
branch: konradantonik/ex-682-sort-within-sections
worktree: null
---

## Notes

rozdzielenie sortowania na „w sekcjach" / „w całym kosztorysie" w menu kolumny (globalne = tylko
widok, nigdzie nie utrwalane) oraz wariant „Utrwal kolejność w całym kosztorysie" zapisujący
display_order we wszystkich sekcjach naraz

### Ustalenia z rozmowy (2026-08-13)

Buduje na EX-682/EX-683 (branch `konradantonik/ex-682-sort-within-sections`), gdzie sortowanie
zostało zamienione na wyłącznie wewnątrzsekcyjne — ta zmiana przywraca sortowanie globalne jako
świadomy, nazwany tryb obok tamtego.

- **Menu kolumny**: 4 pozycje sortowania + „Wyczyść sortowanie". Zakres wprost w etykiecie
  („rosnąco w sekcjach" / „rosnąco w całym kosztorysie" itd.), znacznik przy aktywnej pozycji.
  Bez podmenu i bez osobnego przełącznika trybu — kierunek i zakres wybiera się jednym gestem.
- **Nic z samego sortowania nie jest utrwalane** — ani w localStorage, ani w bazie. Sortowanie
  zostaje soczewką; jedyną trwałą kolejnością jest `display_order`.
- **Dlaczego nie zapisywać reguły sortowania**: zapisana reguła jest żywa i przebija pozycje —
  po ▲/▼ i przeładowaniu przesunięcie wiersza znika, bo reguła sortuje go z powrotem. Dwa
  źródła prawdy o kolejności. Zapisujemy wynik (`display_order`), nie regułę.
- **Sortowanie globalne nie jest utrwalane nigdzie** — przeplata wiersze różnych sekcji, a
  `display_order` wyraża tylko pozycję wewnątrz sekcji; utrwalenie oznaczałoby przenoszenie prac
  do cudzych sekcji. Przy aktywnym sortowaniu globalnym „Utrwal kolejność" jest wyszarzona z tym
  uzasadnieniem; ▲▼ i wstawianie pozostają wyłączone jak przy każdym sortowaniu.
- **Nowy wariant**: „Utrwal kolejność w całym kosztorysie" — ten sam planner przelatuje po
  wszystkich sekcjach, refy sklejone w jeden zapis i jedno cofnięcie. `renumberDisplayOrder`
  przyjmuje dowolną listę id→indeks, więc mechanizm już to unosi.

### Wycofane po implementacji (2026-08-13)

„Utrwal kolejność w całym kosztorysie" **usunięte wraz z całym wiringiem** — decyzja właściciela już
po zaimplementowaniu fazy 2 i 3. Zostaje wyłącznie „Utrwal kolejność" w grupie „Sekcja" (EX-683).

Usunięte: grupa „Kosztorys" w menu wiersza, `onPersistKosztorysOrder`, `handlePersistKosztorysOrder`,
`planKosztorysRenumber`, `renumberKosztorysOrderAction` wraz ze specem bazodanowym, oraz podział
schematu na `renumberDisplayOrderSchema` / `renumberDisplayOrderAcrossBlocksSchema` (wrócił jeden
schemat jednoblokowy). Zostaje faza 1 w całości — wybór zakresu sortowania w menu kolumny.

Wnioski z fazy 2/3, gdyby wariant kiedyś wrócił: `renumberDisplayOrder` przyjmuje dowolną listę
id→indeks i pisze ją jednym `UPDATE … FROM (VALUES …)`, więc obsłużyłby zapis całego kosztorysu bez
zmian; jedyne, co trzeba by ruszyć, to strażnik (`investment_id` zamiast `section_id`) i schemat,
który dziś zabrania powtórzonego indeksu — a przy wielu sekcjach każda zaczyna numerację od zera.
