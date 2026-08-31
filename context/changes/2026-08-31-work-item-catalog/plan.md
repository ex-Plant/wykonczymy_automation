# Katalog prac — plan wdrożenia

## Overview

Globalny katalog prac („cennik") — jeden wiersz na pracę: opis, kategoria, j.m., „Cena j.m."
i dwie **zamrożone kwotowo** stawki podwykonawców. Z katalogu wstawia się pojedyncze prace do
otwartego kosztorysu; pracę z rozpiski da się do katalogu zapisać albo nadpisać nią istniejącą
pozycję. Katalog startuje napełniony z istniejącego szablonu-wzoru.

## Current State Analysis

- Najmniejsza jednostka do wzięcia z szablonu to **sekcja** — `appendPresetSectionsAction`
  (`src/lib/actions/kosztorys-presets.ts:96`) + `appendPresetSections`
  (`src/lib/kosztorys/append-preset-sections.ts:27`). Wstawianie POJEDYNCZEJ pracy z zapisanych
  danych nie istnieje; „Dodaj → Praca" (`toolbar/menus/kosztorys-add-menu.tsx`) tworzy pusty wiersz.
- Szablon niesie opis, j.m., `clientPrice` i cztery pola nadpisań stawek; zeruje przedmiar, rabat,
  notatkę i etapy (`src/lib/kosztorys/serialize-preset.ts:10`).
- **Nie ma ścieżki „wstaw N pozycji do istniejącej sekcji"** — jest `insertItems`
  (`src/lib/kosztorys/insert-rows.ts:115`, zwraca id w kolejności wejścia po kluczu naturalnym
  `(section_id, display_order)`), `sectionOwnerAndNextItemOrder` (`create-item.ts:27`) i
  `createBlankItem` (`create-item.ts:45`, pisze sztywne pustki — nie przyjmuje wartości pól).
- Stawka: `subcontractorPrice(row, plane)` (`src/lib/kosztorys/calc.ts:69`) — jednostkowa, netto,
  niezaokrąglona; `'coeff'` mnoży `clientPrice`. Zamrożenie: `modeChange(row, 'amount', plane)`
  (`subcontractor-price-edit.ts:78`). Strażnik: `checkSubcontractorPrice`
  (`subcontractor-price-guard.ts`, sufit 80% ceny klienta).
- Klucz tożsamości pracy **już istnieje** — `foldDescription` / `FOLDED_TYPO_FIXES`
  (`src/lib/kosztorys/sheet-import/item-key.ts:26`), z testem tabelarycznym po całym `TYPO_FIXES`
  (`src/__tests__/lib/kosztorys/sheet-import/item-key.test.ts:45`). Jest zawężony do sekcji.
- Precedens globalnego bytu bez UI to surowe tabele (`kosztorys_presets`); precedens globalnego
  ekranu z pełnym CRUD to `/kosztorysy` (`src/app/(frontend)/kosztorysy/page.tsx:13`,
  `src/components/sheets/kosztorys-data-table.tsx:29`, `linked-sheet-actions.tsx:30`).
- Dane wejściowe (prod, zrzut 2026-08-31 17:14 UTC): jeden szablon „kosztorys wzrór test",
  14 sekcji, **373 prace → 191 unikalnych kluczy**. 9 kluczy ma rozbieżne ceny i w 8 z nich
  odstaje wyłącznie sekcja „Łazienka 1".

## Desired End State

- `/katalog-prac` listuje pozycje cennika z wyszukiwarką, pozwala dodać, edytować i usunąć wpis.
- W edytorze kosztorysu „Dodaj → Praca z katalogu…" wstawia wybrane prace na koniec wskazanej
  sekcji, z opisem, j.m., ceną i obiema stawkami zapisanymi jako kwoty.
- Menu trzech kropek na pracy ma „Zapisz do katalogu…", z wyborem nowa pozycja / nadpisz istniejącą.
- Katalog zawiera 191 pozycji zasianych z szablonu-wzoru, z kategoriami z nazw sekcji.
- „Opcje → Porównaj z katalogiem" pokazuje raport w trzech kubełkach i niczego nie zapisuje.

### Key Discoveries

- `insertItems` odtwarza kolejność id po kluczu `(section_id, display_order)`; przy remisie degraduje
  do kolejności pozycyjnej z logiem SENTRY-REQUIRED (`insert-rows.ts:56`). Każdy wstawiany wiersz
  musi dostać **inny** `displayOrder`.
- Wstawianie **na koniec sekcji** (`MAX(display_order)+1`) omija `resolveInsertSlot` i przesuwanie
  ogona — `shiftDisplayOrderFrom` przesuwa dokładnie o +1, więc dla N wierszy byłby to cichy błąd.
- `handleAddItem` / `handleAppendedSections` **nie są** opakowane w `editorOnly`
  (`use-kosztorys-editor.ts:356`) — są bezpieczne tylko dlatego, że pasek narzędzi nie renderuje się
  w podglądzie klienta. Wpis w menu WIERSZA musi przez `editorOnly` przejść.
- Wzorzec raportu do skopiowania 1:1: `editor/actions/sheet-compare-action.tsx` (pozycja menu + hook,
  pobieranie **na klik**, bo programowo otwarty dialog Radiksa nie odpala `onOpenChange`) +
  `SheetReportDialog` / `SheetReportBlock` / `sheet-report-parts.tsx`, z całą logiką w czystym module
  (`sheet-import/build-sheet-comparison.ts:172`).
- Kolekcja Payload wymaga kolumny w `payload_locked_documents_rels` — bez niej każdy zapis rzuca
  „column does not exist" (naprawiane już dwa razy). Wzór: `20260818_1_add_fleet.ts:92`.
- `pg_trgm` jest w bazie włączony (`20260412_add_amount_trigram_index.ts:20`), ale żadna kolumna
  tekstowa go nie używa — podobieństwo liczymy w aplikacji, nad 191 wierszami to nic.

## What We're NOT Doing

- Żadnej żywej referencji z pozycji kosztorysu do katalogu — brak klucza obcego, brak `catalogueItemId`.
  Cena jest kopiowana przy wstawieniu i tam zamrożona.
- Żadnego „zaktualizuj ceny w kosztorysie z katalogu" — raport tylko raportuje.
- Żadnego automatycznego sprawdzania zgodności z cennikiem; wyłącznie ręczna akcja z „Opcji".
- Nie ruszamy szablonów: zapis, doklejanie sekcji, wczytanie całości zostają bez zmian.
- Nie importujemy katalogu z arkuszowych zakładek „zakres pracy" (nie mają j.m. ani ceny klienta,
  a rozjazdy między zakładkami kończą jako `conflict` bez zwycięzcy).
- Nie wystawiamy katalogu w widoku inwestora ani na udostępnionym linku.

## Implementation Approach

Kolekcja Payload (nie surowa tabela — ekran CRUD i trzej pisarze, plus `/admin` jako awaryjny
edytor i darmowe haki unieważniania cache). Tożsamość pozycji to **jedna** kolumna `matchKey`
z jednokolumnowym UNIQUE, budowana z `foldDescription(opis)` + `fold(j.m.)`, żeby Payloadowe
`unique: true` zgadzało się z bazą. Kolejność faz idzie tak, by każda następna miała na czym
pracować: byt → ekran → zasilenie (191 realnych wierszy) → wstawianie → zapis z rozpiski → raport.

## Critical Implementation Details

**Rozmyte dopasowanie nigdy nie dotyka zapisu.** `lessons.md` („Resolve a name to an id by EXACT
match or blank — never fuzzy") rządzi tu wprost: klucz dokładny rozstrzyga unikalność, zapis
i „nowa czy nadpisz". Podobieństwo istnieje wyłącznie jako podpowiedź w raporcie, który nie pisze.

**Reguła zwycięzcy przy zasilaniu.** Wygrywa **wartość najczęstsza** wśród wystąpień klucza, remis
rozstrzyga wyższa. Na produkcyjnych danych to jedyna reguła dająca poprawny wynik: w 8 z 9
rozbieżności odstaje wyłącznie „Łazienka 1", a trzy pozostałe sekcje zgadzają się co do grosza —
więc „wygrywa najwyższa" zaciągnęłaby 8 nieaktualnych cen.

## Phase 1: Byt katalogu — kolekcja, migracja, klucz, odczyt

### Overview

Tabela, kolekcja, czysty moduł klucza tożsamości i cache'owany odczyt. Bez UI.

### Changes Required

#### 1. Czysty moduł klucza

**File**: `src/lib/kosztorys/work-catalogue/catalogue-key.ts`

**Intent**: jedna funkcja licząca tożsamość pozycji cennika, tak żeby ekran, zapis z rozpiski
i raport liczyły ją identycznie.

**Contract**: `catalogueKey(description: string, unit: string | null): string` — składa
`foldDescription` (z `sheet-import/item-key.ts`) po opisie i `fold` (z `sheet-import/columns.ts`) po
j.m., rozdzielone `|`. Pusta j.m. daje stały token, nigdy pusty człon — Postgres traktuje NULL-e
jako różne, więc pusty człon otwierałby dziurę w unikalności.

#### 2. Kolekcja

**File**: `src/collections/work-catalogue-items.ts`

**Intent**: byt cennika z polami, uprawnieniami i hakami unieważniania cache.

**Contract**: slug `work-catalogue-items`; pola `description` (text, required), `category` (text),
`unit` (text, required), `clientPrice`, `wToolsRate`, `ownToolsRate` (number, ≥ 0),
`matchKey` (text, required, `unique: true`, ukryte w `/admin` — liczone w akcji, nie wpisywane).
`access`: cała czwórka na `isAdminOrOwnerOrManager`. Haki `makeRevalidateAfterChange('workCatalogue')`
/ `makeRevalidateAfterDelete`. Rejestracja w `src/payload.config.ts`.

#### 3. Migracja

**File**: `src/migrations/20260901_0_add_work_catalogue_items.ts` (+ wpis w `index.ts`)

**Intent**: tabela z jednokolumnowym UNIQUE na `match_key` i obowiązkową kolumną w tabeli blokad
Payloada.

**Contract**: wzorzec z `20260818_1_add_fleet.ts` minus enumy i `_rels`: kolumny + payloadowe
`created_at`/`updated_at` z indeksami, `CREATE UNIQUE INDEX … ON work_catalogue_items (match_key)`,
`ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS work_catalogue_items_id …
REFERENCES … ON DELETE CASCADE` + indeks, `down` w odwrotnej kolejności. Migracja **addytywna** →
prod migruje przed wyjściem kodu.

#### 4. Odczyt + cache

**Files**: `src/lib/cache/tags.ts`, `src/lib/queries/work-catalogue.ts`

**Intent**: jeden globalny wpis cache — katalog jest bezargumentowy, jak `getPresets`.

**Contract**: `CACHE_TAGS.workCatalogue = 'collection:work-catalogue-items'`;
`getWorkCatalogue(): Promise<WorkCatalogueItemT[]>` na `unstable_cache` z kluczem `['work-catalogue']`
i tym tagiem. Typ wiersza w `src/lib/kosztorys/work-catalogue/types.ts`.

### Success Criteria

#### Automated Verification

- Migracja przechodzi na lokalnej bazie: `pnpm payload migrate`
- Spec klucza: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/catalogue-key.test.ts`
  — pokrywa: równoważność opisu przed i po „Popraw literówki" (tabelarycznie po `TYPO_FIXES`,
  wzorem `item-key.test.ts:45`), niewrażliwość na wielkość liter i ogonki, różne j.m. dają różny klucz

#### Manual Verification

- `/admin` pokazuje kolekcję „Katalog prac" i pozwala dodać wpis
- Próba dodania drugiego wpisu o tym samym opisie i j.m. jest odrzucona

---

## Phase 2: Ekran „Katalog prac"

### Overview

`/katalog-prac` — lista z wyszukiwarką, dodawanie, edycja, usuwanie. Wzorzec `/kosztorysy`.

### Changes Required

#### 1. Trasa i nawigacja

**Files**: `src/app/(frontend)/katalog-prac/page.tsx`, `src/components/nav/sidebar.tsx`

**Intent**: strona zarządzania cennikiem, widoczna dla zarządu.

**Contract**: serwerowy komponent → `requireAuth(MANAGEMENT_ROLES)` → `redirect('/')` →
`getWorkCatalogue()` → `PageWrapper title="Katalog prac"` → kliencka tabela. Wpis w `MANAGEMENT_LINKS`.

#### 2. Tabela i akcje wiersza

**Files**: `src/components/work-catalogue/work-catalogue-data-table.tsx`,
`src/components/tables/work-catalogue.tsx`, `src/components/work-catalogue/catalogue-row-actions.tsx`

**Intent**: lista pozycji z wyszukiwarką po opisie i kategorii oraz akcjami edytuj/usuń.

**Contract**: kolumny opis / kategoria / j.m. / Cena j.m. / stawka z narzędziami / stawka bez
narzędzi; filtrowanie przez `useSearchFilter` (`foldText`); usuwanie przez `ConfirmDialog` +
`useTransition` + `toastMessage` + `router.refresh()`, wzorem `linked-sheet-actions.tsx:37`.

#### 3. Formularz

**Files**: `src/components/forms/work-catalogue-item/…` (schemat + formularz),
`src/components/dialogs/{add,edit}-catalogue-item-dialog.tsx`

**Intent**: jeden formularz obsługujący dodawanie i edycję.

**Contract**: `useManagedForm` + Zod w rodzeństwie `*-schema.ts`; opis i kategoria jako pola
tekstowe (kategoria z podpowiedziami istniejących wartości), j.m. przez wzorzec tworzącego
`Combobox` z `editor/grid/cells/unit-column.tsx:12` z `UNIT_SUGGESTIONS`, trzy liczby przez
`DecimalField`. Wariant edycji z `persistDraft: false`.

#### 4. Akcje serwerowe

**File**: `src/lib/actions/work-catalogue.ts`

**Intent**: zapis, edycja i usunięcie pozycji, z policzeniem klucza po stronie serwera.

**Contract**: `createCatalogueItemAction` / `updateCatalogueItemAction` / `deleteCatalogueItemAction`,
każda przez `protectedAction(..., ['workCatalogue'])`. `matchKey` **zawsze** liczony w akcji
z `catalogueKey(...)`, nigdy przyjmowany z drutu. Kolizja klucza wraca jako polski komunikat
„Praca o tej nazwie i jednostce już jest w katalogu", nie jako surowy błąd sterownika.

### Success Criteria

#### Automated Verification

- Spec akcji: `pnpm exec vitest run src/__tests__/lib/actions/work-catalogue.test.ts` — kolizja klucza
  zwraca `{success:false}` i **nie tworzy wiersza** (asercja na stanie bazy, nie na zwrotce);
  `matchKey` przysłany przez klienta jest ignorowany na rzecz policzonego

#### Manual Verification

- Dodanie, edycja i usunięcie pozycji działają, lista odświeża się bez przeładowania strony
- Wyszukiwarka znajduje pracę wpisaną bez ogonków i z inną wielkością liter
- Próba dodania duplikatu pokazuje komunikat, a nie błąd aplikacji

---

## Phase 3: Zasilenie katalogu z szablonu-wzoru

### Overview

Jednorazowe napełnienie katalogu z zapisanego szablonu, z dedupem i regułą zwycięzcy.

### Changes Required

#### 1. Czysta logika zasilenia

**File**: `src/lib/kosztorys/work-catalogue/seed-from-preset.ts`

**Intent**: zamienić payload szablonu na listę pozycji cennika plus raport rozbieżności — bez I/O,
żeby dało się to przetestować na prawdziwych liczbach.

**Contract**: `buildCatalogueSeed(payload: SnapshotPayloadT, settings: {wToolsCoeff, ownToolsCoeff, ...})
: { items: CatalogueSeedItemT[]; conflicts: SeedConflictT[] }`. Grupuje po `catalogueKey`; dla każdej
liczby (cena, obie stawki) wybiera **wartość najczęstszą, remis → wyższa**; stawki wyliczane przez
`subcontractorPrice` na `ViewPricingT` złożonym wzorem `asPlanePricing`
(`build-sheet-comparison.ts:112`) — pominięcie zdenormalizowanych współczynników daje 0 zł na każdej
pracy bez nadpisania (137 z 373 na obecnych danych). Kategoria = nazwa sekcji zwycięskiego
wystąpienia z **uciętym końcowym numerem** („Łazienka 1" → „Łazienka"). `conflicts` niesie klucz
i wszystkie warianty z nazwą sekcji.

#### 2. Uruchomienie

**File**: `src/scripts/seed-work-catalogue.ts`

**Intent**: jednorazowy wsad, uruchamiany ręcznie przez człowieka, kolejno przeciwko preview
i produkcji — nie przez agenta (hook blokuje zapisy w stronę produkcji, i słusznie).

**Contract**: `PRESET=<id> node --env-file=.env --import tsx src/scripts/seed-work-catalogue.ts`;
domyślnie tryb próbny, `--apply` zapisuje. **Baza wskazywana wyłącznie jawnie przy wywołaniu**,
wzorem `db:migrate:preview` / `db:migrate:prod` — `DB_POSTGRES_URL="$DB_POSTGRES_URL_PREVIEW"`,
potem `"$DB_POSTGRES_URL_PROD"`. Bez tego trafia w lokalnego Dockera, nigdy „przypadkiem" w produkcję.

Skrypt jest **wyłącznie wstawiający, wyłącznie do `work_catalogue_items`** — żadnego UPDATE,
DELETE ani dotykania innej tabeli. To jest cała podstawa, na której stoi zgoda na dotknięcie
produkcji: tabela jest nowa i pusta, więc najgorszy wynik to złe wiersze do skasowania, a nie
uszkodzenie istniejących danych. Pomija klucze już obecne (idempotentny — powtórzone uruchomienie
tworzy zero wierszy). Wypisuje liczbę prac wejściowych, utworzonych, pominiętych i tabelę rozbieżności.

**Kolejność uruchomień, bez skrótów:** migracja na preview → wsad próbny na preview → wsad
`--apply` na preview → obejrzenie ekranu katalogu na stagingu → dopiero wtedy migracja na produkcji
→ wsad próbny na produkcji → `--apply`.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/seed-from-preset.test.ts` —
  dedup po kluczu; reguła najczęstszej wartości na przypadku `WC=250, Łazienka 1=300, Łazienka 2=250,
Łazienka 3=250` → 250; remis 2:2 → wyższa; ucinanie numeru w kategorii; praca bez nadpisania
  dostaje stawkę wyliczoną z globalnych współczynników, nie 0 zł

#### Manual Verification

- Tryb próbny na szablonie „kosztorys wzrór test" pokazuje 191 pozycji i 9 rozbieżności
- Po `--apply` ekran katalogu listuje 191 pozycji z sensownymi kategoriami
- Powtórne uruchomienie tworzy 0 nowych pozycji
- Wsad na preview daje ten sam wynik co lokalnie, a ekran katalogu na stagingu to potwierdza
- Uruchomienie bez jawnej zmiennej bazy trafia w lokalnego Dockera, a nie w produkcję

---

## Phase 4: „Dodaj → Praca z katalogu…"

### Overview

Wstawianie wybranych prac z katalogu na koniec wskazanej sekcji, ze zamrożonymi stawkami.

### Changes Required

#### 1. Akcja wstawiania

**File**: `src/lib/actions/work-catalogue.ts` (dopisanie)

**Intent**: wstawić N pozycji katalogu do jednej sekcji, rozstrzygając wszystko po stronie serwera.

**Contract**: `insertCatalogueItemsAction(sectionId: number, catalogueItemIds: number[])
: ActionResultT<{ section: KosztorysSectionT & { items: KosztorysItemT[] }; warnings: string[] }>`.
Klient wysyła **tylko id**. Sekwencja: `withPayloadTransaction(..., { skipRevalidation: true })` →
`sectionOwnerAndNextItemOrder` (właściciel wyprowadzony z sekcji, nigdy z drutu) → `insertItems`
z `displayOrder` = `next + i` → tagi `['kosztorysItems']` po commicie. Stawki zapisywane jako
`{ type: 'amount', value }` na obu planach (`OVERRIDE_FIELDS`, `constants.ts:5`). Przekroczenie
sufitu 80% (`checkSubcontractorPrice`) **nie blokuje** — wraca w `warnings` z nazwą pracy.

#### 2. Dialog i wpięcie w menu

**Files**: `src/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.tsx`,
`toolbar/menus/kosztorys-add-menu.tsx`, `use-kosztorys-editor.ts`

**Intent**: wybór sekcji docelowej + wielokrotny wybór prac z wyszukiwarką, i wstawienie wierszy
do siatki bez przeładowania.

**Contract**: nowy wpis „Praca z katalogu…" obok „Sekcja z szablonu…"; dialog **rodzeństwem** menu,
nie dzieckiem. Pobieranie listy katalogu na otwarcie, wzorem `use-preset-sections.ts` (`null` =
nieza­ładowane, `[]` = pusto). Po sukcesie `handleAppendedCatalogueItems(slice)` — `treeToRows` na
zwróconym kawałku, zasianie `prevById.current`, wstawienie wierszy **za ostatnim wierszem tej
sekcji** (`applyAddItem`, `row-ops.ts:71`), rozwinięcie sekcji, `warnings` jako toast ostrzegawczy.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/actions/work-catalogue-insert.test.ts` — N pozycji dostaje
  N **różnych** `display_order` i wraca w kolejności żądania; obie stawki lądują jako `'amount'`;
  przekroczenie sufitu 80% wstawia wiersz i zwraca ostrzeżenie (asercja na wierszach w bazie)

#### Manual Verification

- Wstawienie trzech prac naraz ląduje na końcu wybranej sekcji, w kolejności zaznaczenia
- Wstawiona praca pokazuje cenę i obie stawki z katalogu, przedmiar 0
- Praca ze stawką powyżej 80% ceny klienta wchodzi, a ostrzeżenie się pokazuje
- W widoku inwestora menu „Dodaj" nie istnieje

---

## Phase 5: „Zapisz do katalogu…" z menu wiersza

### Overview

Droga powrotna: wypełniona praca z rozpiski trafia do cennika jako nowa pozycja albo nadpisuje istniejącą.

### Changes Required

#### 1. Akcja zapisu

**File**: `src/lib/actions/work-catalogue.ts` (dopisanie)

**Intent**: zapisać pracę z kosztorysu do katalogu, zamrażając jej efektywne stawki.

**Contract**: `saveItemToCatalogueAction(itemId: number, mode: 'new' | 'overwrite')`. Wartości czytane
z bazy po `itemId`, nie z drutu. Stawki liczone `subcontractorPrice(...)` na obu planach — czyli
praca bez własnego nadpisania zapisuje stawkę wyliczoną z globalnych współczynników **tej**
inwestycji. Cena to `clientPrice` (przed rabatem). `mode: 'new'` przy zajętym kluczu wraca
komunikatem, `'overwrite'` podmienia wartości istniejącej pozycji w miejscu.

#### 2. Wpis w menu wiersza

**Files**: `editor/grid/menus/kosztorys-row-actions-menu.tsx`, `use-kosztorys-editor.ts`,
`editor/dialogs/save-item-to-catalogue-dialog.tsx`

**Intent**: pozycja „Zapisz do katalogu…" przy pracy, z dialogiem nowa/nadpisz.

**Contract**: wpis w sekcji „Praca" menu trzech kropek, **przepuszczony przez `editorOnly`**
(`use-kosztorys-editor.ts:356`) — menu wiersza istnieje w widoku inwestora, w odróżnieniu od paska
narzędzi. Dialog wzorowany na `save-preset-dialog.tsx`: przełącznik nowa/nadpisz pojawia się tylko
wtedy, gdy klucz już w katalogu jest, i pokazuje wtedy stary i nowy komplet liczb.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/actions/work-catalogue-save.test.ts` — praca bez nadpisania
  zapisuje stawkę wyliczoną z globalnych współczynników (nie 0, nie współczynnik); `'new'` na zajętym
  kluczu nie tworzy drugiego wiersza; `'overwrite'` zmienia wartości i **nie** zmienia id ani `created_at`

#### Manual Verification

- Zapis pracy z rozpiski tworzy pozycję widoczną na ekranie katalogu, z poprawnymi stawkami
- Zapis pracy, która w katalogu już jest, proponuje nadpisanie i pokazuje obie wersje liczb
- W widoku inwestora pozycji „Zapisz do katalogu…" nie ma

---

## Phase 6: Raport „Porównaj z katalogiem" (wycinalna)

### Overview

Ręczna akcja z „Opcji": trzy kubełki, żadnego zapisu. Faza celowo ostatnia i niezależna — da się ją
wyciąć bez dotykania faz 1–5.

### Changes Required

#### 1. Czysta logika porównania

**File**: `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts`

**Intent**: porównać prace kosztorysu z cennikiem i wydać rekord do wyświetlenia.

**Contract**: `buildCatalogueComparison(rows, catalogue, settings)
: { matching: number; diffs: PriceDiffT[]; missing: MissingT[] }`. Dopasowanie po `catalogueKey`.
`diffs` porównuje **trzy** liczby (Cena j.m. + obie stawki) z tolerancją `MONEY_TOLERANCE`
(`calc.ts:9`), sortowane po największej różnicy. `missing` niesie opcjonalną podpowiedź — najbliższy
klucz wg podobieństwa tekstowego, liczonego w JS, **wyłącznie do wyświetlenia**.

#### 2. Akcja, wpis w menu i dialog

**Files**: `src/lib/actions/work-catalogue.ts` (dopisanie),
`editor/actions/catalogue-compare-action.tsx`, `editor/actions/kosztorys-actions-context.tsx`,
`editor/dialogs/catalogue-compare-dialog.tsx`

**Intent**: uruchomienie raportu z „Opcji" i wyświetlenie go.

**Contract**: kopia układu `sheet-compare-action.tsx` — hook z `requestOpen()` pobierającym **na klik**
(programowo otwarty dialog Radiksa nie odpala `onOpenChange`), stan w `KosztorysActionsProvider`,
nigdy w `KosztorysEditorProvider` (regresja EX-496). Dialog na `SheetReportDialog` + trzy
`SheetReportBlock`. Zdania werdyktu w osobnym czystym module. Treść mówi „różni się od katalogu",
nigdy „jest błędna".

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`
  — różnica poniżej tolerancji groszowej NIE jest rozjazdem; rozjazd samej stawki podwykonawcy przy
  zgodnej cenie jest raportowany; praca nieobecna w katalogu ląduje w `missing`, nigdy w `diffs`;
  podpowiedź nie powstaje, gdy nic nie jest dostatecznie podobne

#### Manual Verification

- Raport na kosztorysie wczytanym ze starego szablonu pokazuje sensowne rozjazdy
- Raport na kosztorysie złożonym w całości z katalogu pokazuje same zgodne pozycje
- Podpowiedzi przy „brak w katalogu" trafiają w rzeczywiste odpowiedniki

---

## Testing Strategy

### Unit Tests

- `catalogue-key` — równoważność przed i po „Popraw literówki" (tabelarycznie po `TYPO_FIXES`),
  ogonki, wielkość liter, rozróżnianie j.m.
- `seed-from-preset` — dedup, reguła najczęstszej wartości, ucinanie numeru kategorii, stawka
  z globalnych współczynników
- `build-catalogue-comparison` — tolerancja groszowa, rozjazd samej stawki, kubełek „brak"

### Integration Tests

Specy akcji pod `src/__tests__/lib/actions/` (baza 5435, uruchamiane przez `pnpm test:integration`
w hooku pre-push): kolizja klucza, wstawianie N pozycji, zapis i nadpisanie.
Każda asercja na **stanie bazy**, nie na zwrotce akcji.

### Manual Testing Steps

Zebrane na końcu wdrożenia do `context/foundation/manual-checks.md` z bloków „Manual Verification".

## Performance Considerations

Katalog to setki wierszy, jeden bezargumentowy wpis cache. Porównanie i podpowiedzi liczone w JS nad
191 × ~400 wierszy — bez znaczenia. Zasilenie robi jeden wsad, nie 191 zapisów po jednym.

## Migration Notes

Jedna migracja addytywna. Zgodnie z `AGENTS.md` prod migruje **przed** wyjściem kodu; robi to człowiek
przez `pnpm db:migrate:prod`. Katalog startuje pusty — napełnia go skrypt z fazy 3, uruchamiany
ręcznie przez człowieka, najpierw przeciwko preview, dopiero po weryfikacji przeciwko produkcji.

**Świadome odstępstwo od zasady „żadnych zapisów w stronę produkcji" (właściciel, 2026-08-31).**
Powód, dla którego ryzyko jest tu bliskie zeru: skrypt wstawia do tabeli, która przed tą zmianą nie
istnieje, więc nie ma danych, które mógłby nadpisać ani skasować. Warunki, na których to stoi:
skrypt jest wyłącznie wstawiający i dotyka wyłącznie `work_catalogue_items`, baza jest wskazywana
jawnie przy wywołaniu, tryb próbny jest domyślny, a produkcję poprzedza przebieg na preview.
Odstępstwo dotyczy TYLKO tego skryptu i TYLKO dopóki tabela jest pusta — po pierwszym udanym
wsadzie katalog jest zwykłymi danymi produkcyjnymi i obowiązują zasady bez wyjątku.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## References

- Research: `context/changes/2026-08-31-work-item-catalog/research.md`
- Wzorzec raportu: `src/components/kosztorys/editor/actions/sheet-compare-action.tsx`
- Wzorzec migracji kolekcji: `src/migrations/20260818_1_add_fleet.ts`
- Wzorzec ekranu CRUD: `src/app/(frontend)/kosztorysy/page.tsx`

## Progress

> Konwencja: `- [ ]` do zrobienia, `- [x]` zrobione. Dopisz ` — <commit sha>`, gdy krok wyląduje.

### Phase 1: Byt katalogu — kolekcja, migracja, klucz, odczyt

#### Automated

- [x] 1.1 Migracja przechodzi na lokalnej bazie — 4a296fda
- [x] 1.2 Spec klucza tożsamości przechodzi — 4a296fda

### Phase 2: Ekran „Katalog prac"

#### Automated

- [x] 2.1 Spec akcji katalogu (kolizja klucza, ignorowanie klucza z drutu) — 64722e73

### Phase 3: Zasilenie katalogu z szablonu-wzoru

#### Automated

- [x] 3.1 Spec zasilenia (dedup, reguła najczęstszej wartości, kategoria, stawki) — 23bf2fc9

### Phase 4: „Dodaj → Praca z katalogu…"

#### Automated

- [x] 4.1 Spec wstawiania (różne display_order, kolejność, stawki jako kwoty, ostrzeżenie 80%) — 285e24ed

### Phase 5: „Zapisz do katalogu…" z menu wiersza

#### Automated

- [x] 5.1 Spec zapisu (stawka z globalnych współczynników, kolizja, nadpisanie w miejscu)

### Phase 6: Raport „Porównaj z katalogiem"

#### Automated

- [ ] 6.1 Spec porównania (tolerancja, rozjazd stawki, kubełek „brak", podpowiedzi)
