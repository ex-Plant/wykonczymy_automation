# Picker „Dodaj pracę z katalogu" — Plan Brief

> Pełny plan: `context/changes/2026-09-01-katalog-praca-picker/plan.md`

## What & Why

Dodawanie prac z cennika to dziś płaska lista kilkuset pozycji, po której da się poruszać wyłącznie
wpisywaniem tekstu: kategoria powtarza się przy każdej pracy i zjada miejsce na opis, zaznaczenie
ucieka spod filtra, widać tylko cenę (nie stawki i nie ich udział), sekcję wybiera się na samym
początku, a otworzyć picker można tylko z toolbara.

Sedno: ten sam cennik jest już pokazany jak należy na `/katalog-prac`. Picker różni się od tamtego
ekranu **wyłącznie** tym, że pozwala pracę zaznaczyć i wskazać, dokąd ma trafić — więc nie budujemy
drugiej przeglądarki, tylko reużywamy tę, pomijając kolumny, których przy dodawaniu się nie czyta.

## Starting Point

`add-items-from-catalogue-dialog.tsx` (145 linii): select sekcji → szukajka → lista `<button>`ów →
„Dodaj (n)". Obok: `getWorkCatalogueColumns` z ośmioma kolumnami, sortowaniem, obiema stawkami i
oboma udziałami procentowymi kolorowanymi po przekroczeniu pułapu. Serwer nie wymaga niczego nowego —
`insertCatalogueItemsAction` bierze same identyfikatory i sam odczytuje ceny.

## Desired End State

Picker pokazuje katalog: opis, kategorię, j.m., cenę i obie stawki, sortowalne po każdej kolumnie, z
checkboxami po lewej. Bez „Akcji" i bez kolumn `%`. Zaznaczenie kumuluje się przez zmiany filtra i
sortowania, z licznikiem „Wybrano: N". Na dole sekcja docelowa — wybrana albo ustawiona z góry, gdy
picker otwarto z „…" na wierszu.

## Key Decisions Made

| Decyzja                  | Wybór                                                          | Dlaczego                                                                                                             |
| ------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Kształt pickera          | Ta sama tabela co `/katalog-prac`, nie własny układ            | Różnica to checkbox i sekcja; wszystko inne byłoby uboższą kopią — sortowanie po kategorii zastępuje panel kategorii |
| Podział kolumn           | Każda kolumna osobną stałą + dwa składacze                     | Picker pomija „Akcje" **i** oba `%`, a `%` stoją w środku — prefiks z ogonem by nie wystarczył                       |
| Kolumny `% ceny klienta` | Poza pickerem                                                  | To narzędzie do układania cennika, nie do wybierania pracy; ostrzeżenie o pułapie zostaje toastem po wstawieniu      |
| Zaznaczanie              | Kolumna `col.display` czytająca stan dialogu                   | `DataTable` nie ma modelu `rowSelection` i nie musi mieć; stan w dialogu przeżywa filtr i sortowanie                 |
| „Zaznacz wszystkie"      | Checkbox w nagłówku nad przefiltrowanym zbiorem                | Działa przy każdym filtrze, nie tylko przy kategorii                                                                 |
| Kolejność zaznaczenia    | `number[]`, nie `Set`                                          | Kolejność klikania = kolejność wstawiania; sortowanie tabeli jej nie zmienia                                         |
| Kolumna „Akcje"          | Nieobecna w pickerze                                           | Edycja cennika to robota ekranu „Katalog prac", nie okna dodawania                                                   |
| Sekcja docelowa          | Jedna na całe zatwierdzenie, w stopce, bez licznika `(n poz.)` | To ostatnia decyzja, nie pierwsza; licznik zdjęty tak samo jak z menu „Dodaj"                                        |
| Gdzie mieszka dialog     | Gospodarz obok siatki + kontekst z samym stabilnym `open…`     | `DropdownMenuContent` odmontowuje dzieci, więc wyzwalacz i dialog nie mogą być rodziną; stan w kontekście = EX-496   |

## Scope

**W zakresie:** druga lista kolumn cennika (bez „Akcji" i bez obu `%`); picker przebudowany na
`DataTable` z kolumną zaznaczenia, licznikiem wyboru i wirtualizacją; select sekcji w stopce z
`initialSectionId`; gospodarz dialogu obok siatki i pozycja „Praca z katalogu…" w menu wiersza.

**Poza zakresem:** druga przeglądarka cennika (panele, własne grupowanie, własne formatowanie);
rozrzucanie jednego zaznaczenia po wielu sekcjach; edycja cennika z pickera; zmiany
`insertCatalogueItemsAction` / kolekcji cennika (powierzchnia równoległej zmiany „stawka auto");
przedmiar przy dodawaniu.

## Architecture / Approach

Dwie fazy: zawartość dialogu (współdzielone kolumny + `DataTable` + kolumna zaznaczenia), potem jego
obudowa (skąd się otwiera, dokąd trafia wynik). Nie powstaje żaden nowy moduł logiki — to jest miara
tego, ile zmiana zawdzięcza reużyciu. Otwarcie dialogu nie może przerysować siatki, więc stan
otwarcia mieszka w gospodarzu będącym **rodzeństwem** siatki, a kontekst niesie wyłącznie stabilną
funkcję otwierającą.

## Phases at a Glance

| Faza                       | Co dowozi                                                           | Kluczowe ryzyko                                                   |
| -------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Picker to tabela        | Kolumny cennika w dialogu, checkboxy, licznik wyboru, wirtualizacja | Rozbicie wspólnych kolumn nie może ruszyć wyglądu „Katalogu prac" |
| 2. Sekcja i drugie wejście | Select w stopce, wejście z menu wiersza z sekcją z góry             | Otwarcie dialogu nie może przerysować siatki (EX-496)             |

**Prerekwizyty:** brak — bez schematu, migracji i nowej zależności.
**Szacowany wysiłek:** ~1 sesja.

## Open Risks & Assumptions

- **Założenie:** jedno zatwierdzenie = jedna sekcja. Rozrzucanie wyboru po sekcjach to inna
  konstrukcja i osobna zmiana.
- Rezygnacja z kolumn `%` zostawia ostrzeżenie o przekroczonym pułapie udziału stawki tam, gdzie jest
  dziś — w toaście PO wstawieniu. Świadoma decyzja właściciela, nie przeoczenie.
- Równoległa zmiana `2026-08-31-katalog-prac-auto-rates` czyni obie stawki nullowalnymi. Współdzielona
  lista kolumn działa na naszą korzyść — „auto" dojdzie raz i pojawi się w obu miejscach — ale obie
  sesje dotykają tego samego pliku.
- Zdjęcie licznika `(n poz.)` z selecta zabiera jedyny sygnał odróżniający dwie sekcje o tej samej
  nazwie — tak samo jak przy menu „Dodaj", gdzie właściciel to zaakceptował.

## Success Criteria (Summary)

- Picker pokazuje opis, kategorię, j.m., cenę i obie stawki; „Katalog prac" zostaje bez zmian.
- Zaznaczenie zebrane spod dwóch różnych filtrów ląduje jednym „Dodaj" w jednej sekcji, w kolejności
  klikania.
- Wejście z „…" na wierszu ma sekcję ustawioną z góry.
