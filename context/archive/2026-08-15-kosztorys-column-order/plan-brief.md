# Kolejność kolumn w edytorze kosztorysu — Plan Brief

> Pełny plan: `context/changes/2026-08-15-kosztorys-column-order/plan.md`
> Linear: EX-692

## What & Why

Właściciel czyta kosztorys w kolejności kolumn narzuconej przez arkusz. Chce własnej — bez ruszania
pickera widoczności, który jest używany często i jest prymitywem współdzielonym z pięcioma tabelami
TanStack. Dokładamy osobne okno „Ustaw kolejność kolumn…", otwierane jedną pozycją z menu „Kolumny".

## Starting Point

Kolejność kolumn w gridzie to po prostu kolejność tablicy `columns` — `react-datasheet-grid` nie ma
żadnego API reorderu. Pipeline jest już czysty: `assembleV2Columns` (kolejność arkusza) →
`selectV2Columns` (filtry osi/warstwy/ukrytych + szerokości) → grid, a `selectV2ToggleItems` zwraca
listę pickera w kolejności gridu. Stan kolumn żyje w dwóch bliźniaczych hookach nad
`createJsonMapStore` (szerokości, ukryte), oba na rzadkich mapach. Sortable DnD w aplikacji nie ma
dziś nigdzie — `framer-motion` 12 jest już w zależnościach.

## Desired End State

Menu „Kolumny" → „Ustaw kolejność kolumn…" otwiera okno z listą grup kolumn do przeciągania.
Puszczenie pozycji przestawia kolumny w gridzie. Kolejność przeżywa reload i jest wspólna dla
wszystkich kosztorysów. „Przywróć domyślną kolejność" wraca do układu arkusza. Widok klienta
kolejności nie honoruje.

## Key Decisions Made

| Decyzja                | Wybór                                                       | Dlaczego                                                                                                                | Źródło  |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| Powierzchnia gestu     | Okno z listą, nie drag nagłówków w gridzie                  | Kolumny są wirtualizowane poziomo, a nagłówek ma już dwa gesty (menu + resize) — godziny zamiast 2–3 dni z ryzykiem     | Analiza |
| Wejście                | Jedna pozycja-komenda w `KosztorysViewMenu`                 | Rzadka czynność nie może obciążać często używanego pickera; współdzielony `ColumnToggleMenu` zostaje nietknięty         | User    |
| Jednostka reorderu     | Grupa z `toggleKey`, nie surowe id                          | Kolumny etapów mają dynamiczne id i muszą przenosić się blokiem; ta lista już istnieje jako `columnToggleItems`         | Analiza |
| Model rang             | Rzadka mapa `klucz → ranga`, rangi ułamkowe, zapis 1 klucza | Gęsty zapis zamroziłby dzisiejszą kolejność domyślną u każdego — ten sam argument, co w `useHiddenColumns`              | Plan    |
| Kotwice                | `actions` + `description` na stałych slotach                | Trzy powierzchnie kotwiczą etykietę na `description`; „stały slot", nie „na czoło", żeby nie przestawić dziś „Rozjazdu" | User    |
| Ukryte kolumny w oknie | Widoczne, wyszarzone, przeciągalne                          | Pozwala ustawić miejsce kolumny zanim się ją pokaże; lista już niesie flagę `visible`                                   | User    |
| Zakres okna            | Sam reorder, bez przełączania widoczności                   | Dwie powierzchnie na tę samą preferencję rozjeżdżają się w wyglądzie i zachowaniu                                       | User    |
| Zasięg preferencji     | Globalny w localStorage, nie per kosztorys                  | Kolejność jest właściwością czytającego, nie dokumentu — jak szerokości i ukryte                                        | Plan    |

## Scope

**W zakresie:** czysta funkcja porządkująca + hook stanu; wpięcie w `buildV2Grid`; okno z DnD;
pozycja-komenda w menu „Kolumny"; reset do kolejności arkusza; testy jednostkowe obu warstw.

**Poza zakresem:** `ColumnToggleMenu` i jego adapter (5 tabel TanStack); lista widoczności w menu
kosztorysu; drag nagłówków w gridzie; zapis kolejności do DB; osobna kolejność per widok.

## Architecture / Approach

`useColumnOrder` (rzadka mapa `klucz grupy → ranga`, `createJsonMapStore`) → `columnRanks`
w `columnOpts` → nowy krok `orderAssembled()` między `assembleV2Columns` a filtrem. Sort **przed**
filtrem, bo filtr zachowuje kolejność względną — jeden przebieg obsługuje grid i listę pickera,
a `layerGap` zostaje doklejony na końcu jak dziś. Preview omija sort w całości. Okno konsumuje tę
samą listę `columnToggleItems` i po dropie zapisuje jedną rangę przez `rankForMove`.

## Phases at a Glance

| Faza                             | Co dowozi                                              | Główne ryzyko                                                        |
| -------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| 1. Prymityw kolejności           | Czysta funkcja porządkująca + hook, w pełni otestowane | Round-trip rang ułamkowych — pokryte testem                          |
| 2. Wpięcie w budowę kolumn       | Grid i picker honorują rangi                           | Kotwice liczone z bieżącej listy; preview musi ominąć sort           |
| 3. Okno „Ustaw kolejność kolumn" | Gest DnD i wejście z menu                              | Dialog otwierany z Radix `DropdownMenu` — musi żyć poza treścią menu |

**Prerekwizyty:** brak — wszystko lokalne, bez migracji i bez nowych zależności.
**Szacowany rozmiar:** jedna sesja, ~3 fazy.

## Open Risks & Assumptions

- Zakładamy, że jedna kolejność dla wszystkich widoków wystarczy. Jeśli właściciel zechce innej
  w „bez narzędzi" niż w widoku klienta, mapa rang będzie musiała dostać wymiar widoku.
- `framer-motion` `Reorder` to pierwszy sortable DnD w tej aplikacji — nie ma lokalnego precedensu,
  na którym można się oprzeć przy zachowaniu na dotyku.
- Zmiana jest browser-level, więc należy jej się E2E; autorstwo albo `e2e-backlog` zapada na bramce
  przeglądowej.

## Success Criteria (Summary)

- Przeciągnięcie pozycji w oknie przestawia kolumny w gridzie i przeżywa reload.
- Grupa etapów przenosi się blokiem; „Opis prac" i kolumna akcji zostają na miejscu.
- Widok klienta pokazuje kolejność arkuszową niezależnie od ustawień właściciela, a picker
  widoczności działa dokładnie jak przed zmianą.
