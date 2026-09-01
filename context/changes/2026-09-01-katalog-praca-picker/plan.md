# Picker „Dodaj pracę z katalogu" — plan wdrożenia

## Overview

Dialog wyboru prac z cennika jest dziś płaską listą kilkuset pozycji, po której da się poruszać
wyłącznie wpisywaniem tekstu. Zamiast dorabiać do niego drugą, uboższą przeglądarkę cennika,
**picker staje się tą samą tabelą, co ekran „Katalog prac"** — bez kolumn, których przy dodawaniu się
nie czyta („Akcje" i oba udziały procentowe), z kolumną zaznaczenia z przodu i ze stopką, w której
wybiera się sekcję docelową. Do tego drugie wejście: z menu wiersza, z sekcją już ustawioną.

## Current State Analysis

`src/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.tsx` (145 linii): select
sekcji → szukajka → jedna przewijana lista `<button>`ów → „Dodaj (n)". Wiersz to opis +
`· kategoria` szarym ogonem + `cena / j.m.` po prawej, cały `truncate`.

Obok, na `/katalog-prac`, ten sam cennik jest już pokazany jak należy
(`components/tables/work-catalogue.tsx` + `work-catalogue-data-table.tsx`): osiem kolumn, sortowanie
po każdej z nich, szukajka po opisie i kategorii, obie stawki **oraz** oba udziały procentowe z
czerwienią po przekroczeniu `MAX_CLIENT_SHARE`.

Zestawienie jednego z drugim wyznacza całą zmianę — picker różni się od katalogu wyłącznie tym, że
pozwala **zaznaczyć** pracę i wskazać, **dokąd** ma trafić:

- **Kategoria powtarza się przy każdej pracy** zamiast być kolumną, po której da się posortować, i
  zjada pół szerokości, przez co opisy są ucinane.
- **Nie widać, że to wybór wielokrotny** — ptaszek ma `opacity-0` do zaznaczenia (`:119`), a jedynym
  śladem zaznaczenia jest liczba na przycisku (`:137`), więc po zmianie frazy nie wiadomo, co się
  nazbierało.
- **Widać tylko cenę klienta** — nie widać obu stawek, choć obie są wstawiane razem z pracą.
- **Sekcja jest pierwsza, a decyduje się o niej ostatnio** (`:86`), i jej etykiety niosą licznik
  `(n poz.)` (`:47`) — ten sam, który właśnie zdjęliśmy z menu „Dodaj".
- **Jedno wejście** — tylko `KosztorysAddMenu`, choć klikając „…" na wierszu wiadomo, do której
  sekcji się celuje.

### Key Discoveries:

- **Kolumny cennika są jedną funkcją, gotową do współdzielenia.** `getWorkCatalogueColumns`
  (`components/tables/work-catalogue.tsx:41`) buduje osiem kolumn, z których `categorySuggestions`
  potrzebuje **wyłącznie** ostatnia — „Akcje" (`:101`). Reszta to niezależne definicje, które da się
  poskładać w drugą listę bez dotykania pierwszej.
- **`DataTable` nie ma modelu zaznaczania wierszy** (`ui/data-table/data-table.tsx:45-62` — brak
  `rowSelection`, `enableRowSelection`, `getRowId`). Nie potrzebuje: zaznaczenie to zwykła
  `col.display({ id: 'select' })` czytająca stan trzymany przez dialog. Zero nowej maszynerii tabeli.
- **`DataTable` ma za to wirtualizację** (`enableVirtualization`, `virtualRowHeight`) — cennik rośnie,
  a dziś lista renderuje wszystko naraz.
- **Tabela przewija się poziomo sama.** `DataTable` owija się w `overflow-x-auto`
  (`ui/data-table/data-table.tsx:161`), więc liczba kolumn nie jest ograniczeniem szerokości dialogu —
  szerokość to wygoda, nie warunek działania.
- **Serwer bierze wyłącznie identyfikatory.** `insertCatalogueItemsAction(sectionId, ids)`
  (`src/lib/actions/work-catalogue.ts:132`) sam odczytuje ceny z cennika, deduplikuje id i zwraca
  gotowy kawałek drzewa. Zmiana jest czysto prezentacyjna — akcja i jej kontrakt zostają bez zmian.
- **Kolejność zaznaczenia jest niesiona świadomie.** `selected` to tablica, nie `Set` (`:33`), bo
  prace lądują w rozpisce w kolejności klikania (`listCatalogueItemsByIds` „returns rows in the
  CALLER's order", `src/lib/db/work-catalogue.ts:30`). Zostaje tablicą.
- **Dialog nie może mieszkać pod pozycją menu.** `KosztorysActionsProvider`
  (`actions/kosztorys-actions-context.tsx:38`) opisuje to wprost: `DropdownMenuContent` odmontowuje
  dzieci przy zamknięciu, a `onSelect` zamyka menu, więc wyzwalacz i dialog nigdy nie są w jednym
  poddrzewie. Ten provider owija jednak wyłącznie menu „Opcje"
  (`toolbar/menus/kosztorys-actions-menu.tsx:39`), nie siatkę — dla wejścia z menu wiersza trzeba
  własnego, wąskiego seamu.
- **Provider edytora jest polem minowym.** AGENTS.md: nic nie przenosimy do
  `KosztorysEditorProvider` — churn identyczności wartości to regresja wydajności EX-496, raz już
  cofnięta.
- **Druga sesja robi stawkę „auto".** `context/changes/2026-08-31-katalog-prac-auto-rates/` czyni obie
  stawki nullowalnymi. Współdzielona lista kolumn działa tu na naszą korzyść: „auto" dojdzie **raz**,
  w `work-catalogue.tsx`, i pojawi się w obu miejscach jednocześnie.

## Desired End State

Właściciel otwiera „Dodaj pracę z katalogu" z toolbara albo z „…" na wierszu i widzi **swój katalog**
— opis, kategorię, j.m., cenę i obie stawki, sortowalne po każdej z tych kolumn — z checkboxami po
lewej. Zaznacza prace, przełączając sortowanie i frazę tak, jak mu wygodnie; zaznaczenie się kumuluje
i widać jego licznik. Na dole wybiera sekcję (albo ma ją już ustawioną, jeśli wszedł z wiersza) i
zatwierdza raz.

Sprawdzalne: wybór spod dwóch różnych filtrów ląduje jednym „Dodaj" w jednej sekcji, w kolejności
klikania, a przy każdej pracy widać cenę i obie stawki, których dziś nie widać.

## What We're NOT Doing

- **Drugiej przeglądarki cennika.** Żadnego układu dwupanelowego, własnego grupowania po kategorii ani
  własnego formatowania kwot — kategoria jest kolumną, po której się sortuje, a nie panelem.
- **Rozrzucania jednego zaznaczenia po wielu sekcjach** — jedno zatwierdzenie = jedna sekcja.
- **Edycji cennika z pickera** (poprawienia ceny w locie, dodania nowej pracy) — od tego jest ekran
  „Katalog prac". Dlatego kolumna „Akcje" w pickerze nie występuje.
- **Kolumn `% ceny klienta`.** To narzędzie do układania cennika, nie do wybierania pracy — przy
  dodawaniu nikt tego nie czyta. Skutek zapisany wprost: ostrzeżenie o przekroczonym pułapie udziału
  stawki zostaje tym, czym jest dziś — toastem PO wstawieniu.
- **Zmian w `insertCatalogueItemsAction`, `appendCatalogueItems` ani w kolekcji cennika** — to
  powierzchnia równoległej zmiany (stawka „auto").
- **Ustawiania przedmiaru przy dodawaniu** — prace nadal lądują bez przedmiaru, jak dziś.

## Implementation Approach

Dwie fazy: najpierw zawartość dialogu (współdzielone kolumny + `DataTable` + kolumna zaznaczenia),
potem jego obudowa (skąd się go otwiera i dokąd trafia wynik). Nie powstaje żaden nowy moduł logiki —
to jest miara tego, ile zmiana zawdzięcza reużyciu.

## Critical Implementation Details

**Kolumny definiujemy raz, składamy dwa razy.** Dwa ekrany chcą różnych podzbiorów w tej samej
kolejności (picker pomija oba `%` i „Akcje"), więc podział na „wspólny prefiks + ogon" nie wystarczy —
kolumny `%` stoją w środku. Każda kolumna zostaje więc osobną stałą w module, a nad nimi stoją dwa
składacze: dzisiejszy `getWorkCatalogueColumns` dla ekranu i lista pickera. Definicja kwoty, procentu
i czerwieni pozostaje jedna.

**Zaznaczenie żyje w dialogu, nie w tabeli.** Kolumna `select` renderuje checkbox z
`checked={selected.includes(id)}` i woła `toggle(id)` — stan zostaje w dialogu, więc przefiltrowanie
ani przesortowanie niczego nie odznacza, a kolejność klikania (i wstawiania) jest zachowana. Checkbox
w nagłówku działa na **widoczne po filtrze** wiersze: zaznacza wszystkie, gdy któryś jest
niezaznaczony, i odznacza je, gdy wszystkie już są.

**Otwarcie dialogu nie może przerenderować siatki.** Stan „otwarty dla sekcji X" nie wchodzi ani do
`KosztorysEditorProvider` (EX-496), ani do `KosztorysActionsProvider` (ten owija tylko menu „Opcje").
Rozdzielamy stan od dyspozytora: kontekst niesie wyłącznie stabilną funkcję `openCataloguePicker`,
której tożsamość nigdy się nie zmienia, a stan otwarcia mieszka w komponencie-gospodarzu będącym
**rodzeństwem** siatki. Otwarcie i zamknięcie przerysowuje gospodarza, nie grid.

## Phase 1: Picker to tabela katalogu

### Overview

Płaska lista znika; w jej miejsce wchodzi `DataTable` na współdzielonych kolumnach cennika, z kolumną
zaznaczenia z przodu.

### Changes Required:

#### 1. Druga lista kolumn — dla wybierania, nie dla układania cennika

**File**: `src/components/tables/work-catalogue.tsx`

**Intent**: Picker pokazuje cennik, ale go nie zmienia i nie służy do jego strojenia — odpadają więc
„Akcje" i oba `% ceny klienta`. Zamiast kopiować definicje, rozbijamy je na osobne stałe i składamy
dwie listy.

**Contract**: każda kolumna jako stała w module; `getWorkCatalogueColumns({ categorySuggestions })`
składa dzisiejszą ósemkę i nie zmienia zachowania ekranu „Katalog prac"; nowy eksport
`WORK_CATALOGUE_PICKER_COLUMNS` to opis, kategoria, j.m., cena j.m., stawka z narzędziami, stawka bez
narzędzi.

#### 2. Zawartość dialogu

**File**: `src/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.tsx`

**Intent**: `DataTable` na `WORK_CATALOGUE_PICKER_COLUMNS` zamiast ręcznej listy, z kolumną
zaznaczenia z przodu. Dialog dostaje więcej szerokości, bo sześć kolumn czyta się wygodniej szeroko —
ale to wygoda, nie warunek: nadmiar przewija się poziomo we własnym kontenerze tabeli. Szukajka
zostaje ta sama (`useSearchFilter` po opisie i kategorii — dokładnie jak na `/katalog-prac`), a nad
tabelą staje licznik „Wybrano: N", żeby zaznaczenie było widoczne niezależnie od filtra.

**Contract**: `PropsT` bez zmian w tej fazie; wewnątrz dochodzi kolumna
`col.display({ id: 'select' })` czytająca `selected: number[]` i wołająca `toggle`, checkbox nagłówka
działający na przefiltrowany zbiór, `initialSorting` po kategorii, a potem po opisie, oraz
`enableVirtualization` — cennik rośnie, a dziś nic go nie wirtualizuje.

### Success Criteria:

#### Automated Verification:

- **Brak testu zakresowego — świadomie.** Faza nie tworzy ani nie zmienia żadnej czystej logiki: to
  złożenie istniejącej tabeli z istniejącym zapytaniem. Testowalne byłoby wyłącznie „czy komponent
  renderuje kolumnę", czyli asercja o implementacji, nie o zachowaniu. Ryzyko jest przeglądarkowe i
  idzie do weryfikacji ręcznej oraz do zaległości E2E. Bramka całego drzewa stoi na końcu planu.

#### Manual Verification:

- Picker pokazuje opis, kategorię, j.m., cenę i obie stawki — bez „Akcji" i bez kolumn `%`
- Ekran „Katalog prac" wygląda i sortuje się dokładnie jak przed zmianą, z ośmioma kolumnami
- Sortowanie po „Kategoria" grupuje prace; sortowanie po dowolnej kolumnie nie gubi zaznaczenia
- Wpisanie frazy nie odznacza tego, co już zaznaczone; licznik „Wybrano: N" to pokazuje
- Checkbox w nagłówku zaznacza i odznacza wiersze widoczne po filtrze
- Prace lądują w sekcji w kolejności klikania, nie w kolejności sortowania

---

## Phase 2: Sekcja docelowa i drugie wejście

### Overview

Wybór sekcji ląduje na dole, obok „Dodaj", a dialog daje się otworzyć z menu wiersza z sekcją już
ustawioną.

### Changes Required:

#### 1. Sekcja w stopce dialogu

**File**: `src/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.tsx`

**Intent**: Select przenosi się z góry do stopki, obok przycisków, jako „Dodaj do: …" — bo to ostatnia
decyzja, nie pierwsza. Etykiety tracą licznik `(n poz.)`, tak jak straciło go menu „Dodaj". Dochodzi
opcjonalny `initialSectionId`, którym otwarcie z wiersza ustawia sekcję z góry.

**Contract**: `PropsT` rośnie o `initialSectionId?: number | null`; `confirmDisabled` bez zmian
(sekcja i co najmniej jedna praca). Reset przy zamknięciu wraca do `initialSectionId`, nie do `null`.

#### 2. Jeden gospodarz dialogu, dwa wyzwalacze

**File**: `src/components/kosztorys/editor/dialogs/use-catalogue-picker.tsx` (nowy),
`src/components/kosztorys/editor/kosztorys-editor-body.tsx`,
`src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx`

**Intent**: Dialog przestaje mieszkać w `KosztorysAddMenu` i dostaje jednego gospodarza, będącego
rodzeństwem siatki. Menu „Dodaj" i menu wiersza tylko go otwierają. Rozdział stanu od dyspozytora
trzyma siatkę z dala od przerysowań (patrz „Critical Implementation Details").

**Contract**: kontekst wystawia `{ openCataloguePicker: (sectionId?: number) => void }` o stabilnej
tożsamości; stan otwarcia i `AppendedCatalogueSliceT` idą przez gospodarza do
`handleAppendedCatalogueItems`. Provider owija toolbar i siatkę, ale **nie** jest częścią
`KosztorysEditorProvider`.

#### 3. Pozycja w menu wiersza

**File**: `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx`,
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: W grupie „Sekcja" dochodzi „Praca z katalogu…", otwierająca picker z sekcją tego wiersza.
Widoczna na tych samych zasadach co reszta grupy — czyli tylko w trybie edycji, przez ten sam gate
`editorOnly()`.

**Contract**: `SectionActionsT` rośnie o `onAddFromCatalogue: () => void`, dokładany w
`RowActionsCell` obok pozostałych callbacków sekcji; sortowanie nie blokuje tej pozycji (praca ląduje
na końcu sekcji, więc pozycja w tablicy nie ma znaczenia — inaczej niż przy „Wstaw powyżej/poniżej").

### Success Criteria:

#### Automated Verification:

- **Brak testu zakresowego — świadomie.** Faza to przepięcie wyzwalaczy i propsów; ryzyko (dwa
  wejścia, reset stanu między otwarciami) jest przeglądarkowe i idzie do weryfikacji ręcznej oraz do
  zaległości E2E.

#### Manual Verification:

- Select sekcji stoi w stopce, bez licznika pozycji przy nazwach
- „Dodaj" z toolbara otwiera picker bez ustawionej sekcji
- „…" na wierszu → „Praca z katalogu…" otwiera picker z sekcją tego wiersza; dodanie ląduje właśnie w niej
- Zamknięcie i ponowne otwarcie czyści zaznaczenie i szukajkę, a sekcję wraca do tej, z którą otwarto
- Otwarcie i zamknięcie dialogu nie rusza pozycji przewijania siatki ani aktywnej celi

---

## Testing Strategy

### Unit Tests

Brak — i to jest wynik, nie zaniedbanie. Zmiana nie tworzy żadnej czystej logiki: składa istniejącą
tabelę cennika z istniejącą akcją wstawiającą. Gdyby powstał tu moduł do przetestowania, znaczyłoby
to, że reużycie się nie udało.

### Integration Tests

Brak — nic tu nie dotyka bazy, a akcja wstawiająca zostaje bez zmian.

### Browser (E2E)

Ryzyko przeglądarkowe: „zaznaczenie zebrane spod dwóch różnych filtrów ląduje jednym zatwierdzeniem w
wybranej sekcji, w kolejności klikania, a wejście z menu wiersza ma tę sekcję ustawioną z góry". Do
napisania przy bramce przeglądowej albo odłożenia jako zgłoszenie z etykietą `e2e-backlog` w projekcie
„Wykonczymy". **Nie uruchamiać `pnpm test:e2e` bez wyraźnej prośby** — pełny przebieg to ok. godzina.

### Manual Testing Steps

1. Inwestycja z rozpisanym kosztorysem i niepustym cennikiem (`INV=6`), rola OWNER
2. Toolbar → „Dodaj" → „Praca z katalogu…": posortować po kategorii, zaznaczyć dwie prace, zmienić
   frazę, zaznaczyć kolejne dwie — sprawdzić, że licznik pokazuje cztery
3. Wybrać sekcję w stopce, zatwierdzić; sprawdzić, że cztery prace stoją na końcu tej sekcji w
   kolejności klikania, bez przedmiaru
4. „…" na wierszu innej sekcji → „Praca z katalogu…": sekcja ustawiona z góry, dodać jedną pracę
5. Otworzyć picker ponownie — zaznaczenie i fraza wyczyszczone
6. Zwęzić okno poniżej 768 px — tabela musi przewijać się poziomo we własnym kontenerze, a dialog nie
   może wychodzić poza ekran

## Performance Considerations

Cennik wczytuje się raz, przy otwarciu (`useListOnOpen`), i od tej zmiany renderuje się przez
`DataTable` z włączoną wirtualizacją — czyli lepiej niż dziś, gdzie lista renderuje wszystkie wiersze.
Jedyne realne ryzyko to przerysowanie siatki przy otwieraniu dialogu i przed nim broni rozdział stanu
od dyspozytora (patrz „Critical Implementation Details").

## Migration Notes

Brak. Nic nie idzie do bazy, kontrakt akcji zostaje, a dialog nie trzyma żadnego stanu między
otwarciami.

## References

- Tabela do reużycia: `src/components/tables/work-catalogue.tsx`,
  `src/components/work-catalogue/work-catalogue-data-table.tsx`
- Kontrakt tabeli (brak modelu zaznaczania, wirtualizacja, `meta.align`):
  `src/components/ui/data-table/data-table.tsx`
- Dlaczego wyzwalacz i dialog nie są rodziną: `editor/actions/kosztorys-actions-context.tsx:38`
- Stawka „auto" (równoległa zmiana): `context/changes/2026-08-31-katalog-prac-auto-rates/change.md`

## Phase 3: Ukrywanie prac już dodanych

### Overview

Picker otwiera się z zaznaczonym „Ukryj już dodane" i pokazuje przy tym licznik ukrytych pozycji.
Przełącznik, nie twarde odsianie — praca, która znika bez śladu, czyta się jak dziura w cenniku.

### Changes Required

- `src/lib/kosztorys/work-catalogue/already-in-kosztorys.ts` (nowy) — `kosztorysCatalogueKeys` składa
  klucze rozpiski, `partitionAlreadyInKosztorys` dzieli cennik na `fresh` / `alreadyAdded`. Rozdzielone,
  bo klucze zależą wyłącznie od rozpiski, a podział przelicza się na każdy znak w szukajce.
- `use-kosztorys-editor.ts` — wystawia `rows` (cała rozpiska, nie `viewRows`).
- `actions/catalogue-picker-host.tsx` → dialog dostaje `kosztorysItems={rows}`.
- Dialog — stan `hideAlreadyAdded`, pole wyboru z licznikiem obok szukajki.

### Decyzje

1. **Domyślnie włączone.** Owner otwiera picker po to, żeby dobrać nowe prace; już dodane są tłem.
2. **Zakres to cały kosztorys, nie sekcja docelowa.** Ta sama praca legalnie stoi w kilku pokojach, ale
   właściciel chce ją mieć z drogi — decyzja właściciela, wprost.
3. **Dopasowanie po `matchKey` katalogu**, czyli tą samą regułą co „Porównaj z katalogiem" i indeks
   UNIQUE. Znany skutek: pozycja z ręcznie zmienioną nazwą wraca na listę jako niedodana.
4. **Zaznaczona praca nigdy nie znika.** Właściciel dotarł do niej, odznaczając przełącznik; ukrycie
   zostawiłoby ją w ładunku „Dodaj (N)" bez wiersza, którym można ją odznaczyć.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/already-in-kosztorys.test.ts`

#### Manual Verification:

- [ ] Pięć pozycji w `context/foundation/manual-checks.md`, sekcja „Phase 3"

### Kontrakt

`AddItemsFromCatalogueDialog` rośnie o `kosztorysItems: readonly KosztorysItemRefT[]`.
`SectionActionsT` NIE rośnie o `onAddFromCatalogue` — po decyzji o przeniesieniu obu poleceń
katalogowych do grupy „Praca" callback siedzi w pakiecie `item` jako opcjonalny.

## Whole-tree Gate

Uruchomić **raz**, po ostatniej fazie:

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy jednostkowe: `pnpm test`
- Build: `pnpm build`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Picker to tabela katalogu

#### Automated

- [x] 1.1 Brak testu zakresowego — złożenie istniejących części (świadomie puste) — 173bbe92

### Phase 2: Sekcja docelowa i drugie wejście

#### Automated

- [x] 2.1 Brak testu zakresowego — przepięcie wyzwalaczy, ryzyko przeglądarkowe (świadomie puste) — 08393235

### Phase 3: Ukrywanie prac już dodanych

#### Automated

- [x] 3.1 `partitionAlreadyInKosztorys` — dopasowanie po kluczu katalogu, ta sama j.m. rozstrzyga
