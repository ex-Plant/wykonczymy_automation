# Kolumna poniesionych kosztów na liście floty + filtr zakresu dat — Implementation Plan

## Overview

Tabela `/flota` dostaje kolumnę z sumą poniesionych kosztów na pojazd oraz wiersz sumy zbiorczej
w stopce. Lista dostaje filtr zakresu dat w URL (`?from=&to=`), zbudowany jak filtr transferów,
a obie liczby liczą wyłącznie to, co mieści się w wybranym zakresie.

Warunkiem, pod którym `0 zł` w tej kolumnie mówi prawdę, jest domknięcie źródła: pole „Koszt"
staje się **wymagane**. Dopiero wtedy zero znaczy „kosztowało zero", a nie „nikt nie wpisał".

## Current State Analysis

- **Dane są już na miejscu.** `cost` jedzie w każdym evencie (`src/lib/fleet/types.ts:31`) przez
  cache'owany `getFleetDataset` aż do `toRow` (`src/lib/queries/fleet.ts:53-69`). Kolumna nie
  potrzebuje nowego zapytania — fold w pamięci jest usankcjonowany precedensem („tens of vehicles,
  no scale story to design for").
- **`cost` jest dziś opcjonalny na trzech warstwach**: kolekcja (`src/collections/vehicle-inspections.ts:90-94`,
  brak `required`), formularz (`inspection-schema.ts:13`, `z.string()` bez `.min(1)`), domena
  (`:28`, `z.number().optional()`). W DB: `"cost" numeric` (`src/migrations/20260818_1_add_fleet.ts:53`).
  Pole w formularzu jest renderowane **zawsze**, nigdy nie chowane per typ
  (`inspection-form.tsx:251-255`) — uczynienie go wymaganym niczego nie zablokuje.
- **Obowiązuje reguła odwrotna do ustalenia właściciela.** `summariseCosts`
  (`src/lib/fleet/costs.ts:34-37`) odfiltrowuje wpisy z `cost === null` i **pomija** typ bez ceny,
  z uzasadnieniem w komentarzu (`:26-29`), testem (`src/__tests__/lib/fleet/costs.test.ts:45`)
  i niezaznaczonym manual checkiem EX-711 (`context/foundation/manual-checks.md:1358`).
- **`/flota` nie zna `searchParams`.** `src/app/(frontend)/flota/page.tsx:13` nie przyjmuje
  żadnych propsów; `fetchFleetOverview()` (`src/lib/queries/fleet.ts:77-87`) nie ma parametrów.
- **Cache floty jest celowo wolny od daty.** `getFleetDataset` ma stały klucz `['fleet-dataset-v2']`
  z komentarzem „nothing here depends on today's date, so the entry survives midnight"
  (`:24-27`). `today` jest rozwiązywane **poza** cachem i przeciągane do `toRow` — to jest szew,
  którym wejdzie zakres dat.
- **Filtr transferów jest do skopiowania, ale nie do wyjęcia.** `DateFilters`
  (`src/components/transfers/date-filters.tsx:17`) czyta `useSearchParams()` sam, a pisze przez
  wstrzyknięte propsy `updateParam`/`updateMultipleParams`, których jedyna implementacja jest
  uwięziona w `transfer-filters.tsx:72-84`. Klucze `'from'`/`'to'` są zaszyte na sztywno
  (`:19-20,28,32,63-64,67`).
- **Lokalna baza**: 7 przeglądów, 3 bez wpisanej kwoty — dane testowe.

## Desired End State

Na `/flota`:

- Kolumna „Koszty" pokazuje `formatPLN(suma)` dla każdego pojazdu, wyrównana do prawej, sortowalna,
  ukrywalna. Pojazd bez żadnego przeglądu pokazuje `0 zł`.
- Pod tabelą wiersz sumy zbiorczej: łączny koszt całej floty w wybranym zakresie.
- Pasek filtra Rok · Miesiąc · Od · Do · „Wyczyść daty" nad tabelą, stan w URL (`?from=&to=`),
  przedział półotwarty (sam jeden kraniec jest legalny).
- Bez parametrów w URL: brak ograniczenia, kolumna liczy całą historię.

W formularzu przeglądu pole „Koszt (PLN)" jest wymagane; nie da się zapisać przeglądu bez kwoty —
ani przez formularz, ani przez `/admin`, ani przez akcję serwerową.

Karta pojazdu i lista liczą koszty **tą samą regułą**.

**Weryfikacja:** `pnpm exec vitest run src/__tests__/lib/fleet/costs.test.ts src/__tests__/lib/queries/fleet.test.ts`
zielone; ręcznie — wejście na `/flota?from=2026-07-01&to=2026-07-31` pokazuje wyłącznie lipcowe koszty,
a suma w stopce równa się sumie kolumny.

### Key Discoveries:

- `fetchFleetOverview` (`src/lib/queries/fleet.ts:77-87`) już przeciąga wartość per-request (`today`)
  **poza** cachem — zakres dat wchodzi dokładnie tą samą drogą, klucz cache'a zostaje wolny od daty.
- `toRow` (`:53-69`) jest eksportowany, testowany i **współdzielony z `fetchVehicleDetail`** (`:135`),
  więc każdy nowy wymagany parametr trzeba podać w dwóch miejscach.
- **`loadFleetDataset` jest współdzielony z cronem** (`src/lib/fleet/dataset.ts:18-25`,
  `src/lib/fleet/sweep-io.ts:7`) — nie wolno go filtrować datą.
- **Nie wolno zawężać całej tablicy `events` przed `toRow`** — `deadlines`, `activeFlags`,
  `latestOdometer` i `kmSinceOilChange` czytają ją bez okna i zdegradowałyby się do „nic nie
  odnotowano". Zakres dotyka **wyłącznie** sumowania kosztów.
- `performedAt` na `InspectionRecordT` to surowy timestamp (`src/lib/fleet/map-inspection.ts:17`) —
  przed porównaniem musi przejść przez `toWarsawDay` (`src/lib/fleet/days.ts:18`).
- `parseDateRange` (`src/lib/utils/parse-date-range.ts:8`) jest **martwy** (referuje go tylko własny
  spec) i wymaga **obu** krańców — sprzecznie z wybranym przedziałem półotwartym.
- Slot `footer` w `DataTable` istnieje (`src/components/ui/data-table/data-table.tsx:36-37,132`),
  jest nieużywany na flocie; precedens: `kosztorys/summary/tables/materials-transactions-table.tsx:221`.
- `formatPLN` (`src/lib/utils/format-currency.ts:8`) — jedyny kanoniczny formatter; `roundToCents`
  w środku zwija `-0`.

## What We're NOT Doing

- **Nie łączymy floty z transakcjami.** `cost` na przeglądzie to jedyne pieniądze w tej domenie;
  nie powstaje żaden `LABOR_COST`-podobny most do rejestrów ani do marży.
- **Nie rozbijamy kosztów po typach w tabeli** — rozbicie zostaje na karcie pojazdu.
- **Nie dotykamy paginacji ani wyszukiwarki** na `/flota`.
- **Nie ruszamy `loadFleetDataset` ani digestu cronowego.**
- **Nie dodajemy `getFilteredRowModel`** — filtrowanie w tej aplikacji zawsze poprzedza `DataTable`.
- **Nie piszemy specu Playwrighta** — dopisujemy ścieżkę do EX-716 (`e2e-backlog`).
- **Nie dodajemy `beforeDelete` na `vehicles`** (znane, otwarte, poza zakresem).

## Implementation Approach

Cztery fazy w kolejności zależności: najpierw domknięcie źródła (bez niego `0 zł` kłamie), potem
ujednolicenie reguły, potem kolumna, na końcu filtr — bo dopiero on zmienia to, co kolumna liczy.

Zakres dat składa się **nad** cachem, w `fetchFleetOverview`, tak jak dziś `today`. Klucz
`getFleetDataset` nie dostaje żadnego argumentu i pozostaje wolny od daty.

## Critical Implementation Details

**Bump klucza cache'a jest obowiązkowy w fazie 1.** `InspectionRecordT.cost` zwęża się z
`number | null` do `number`, a ten typ jest częścią `FleetDatasetT` — czyli payloadu w
`unstable_cache`. Wpis zapisany przed zmianą nadal niesie `cost: null`, a nowy czytelnik zakłada
liczbę. Tag nie ratuje: znaczy wpis jako nieświeży, ale to samo żądanie **jeszcze raz poda stary
payload** i dopiero potem rewaliduje. Dlatego `['fleet-dataset-v2']` → `['fleet-dataset-v3']`
w tym samym commicie co zmiana typu (`lessons.md:1010-1036`).

`FleetRowT` powstaje **po** odczycie z cache'a, więc jego poszerzenie o sumę kosztów bumpa
**nie** wymaga.

**Kolejność deploya jest odwrotna niż zwykle.** Migracja `SET NOT NULL` jest destrukcyjna z punktu
widzenia starego kodu (który nadal wysyła `cost: undefined`), więc: **najpierw push, migracja
dopiero gdy nowy deploy jest żywy.** Migrację prod uruchamia człowiek (`pnpm db:migrate:prod`).

## Phase 1: Domknięcie źródła — „Koszt" polem wymaganym

### Overview

Pole staje się wymagane na wszystkich czterech warstwach (DB, kolekcja, formularz, domena), a typy
przestają dopuszczać `null`.

### Changes Required:

#### 1. Migracja

**File**: `src/migrations/20260824_1_require_inspection_cost.ts` (nowy) + wpis w `src/migrations/index.ts`

**Intent**: Backfill istniejących wierszy bez kwoty na `0`, potem `SET NOT NULL`. Nazwa pliku
sortuje się po `20260824_0_…`, więc kolejność wykonania zgadza się z zależnością.

**Contract**: `up` — `UPDATE vehicle_inspections SET cost = 0 WHERE cost IS NULL;` a następnie
`ALTER TABLE "vehicle_inspections" ALTER COLUMN "cost" SET NOT NULL;`. `down` — samo
`DROP NOT NULL` (backfillu nie da się cofnąć i nie ma czego cofać). Migracja pisana ręcznie,
wzorowana na strukturze `20260824_0_…` — `migrate:create` emituje fantomowy drift.

#### 2. Kolekcja

**File**: `src/collections/vehicle-inspections.ts`

**Intent**: `/admin` musi odmawiać zapisu bez kwoty, inaczej domknięcie ma dziurę.

**Contract**: pole `cost` dostaje `required: true`.

#### 3. Schematy formularza i domeny

**File**: `src/components/forms/inspection-form/inspection-schema.ts`

**Intent**: Warstwa formularza odrzuca pusty string z komunikatem po polsku; warstwa domeny
przestaje przyjmować brak wartości.

**Contract**: `inspectionFormSchema.cost` → `z.string().min(1, 'Koszt jest wymagany')`.
`inspectionSchema.cost` → `z.number().nonnegative()` (bez `.optional()`).

#### 4. Mapowanie formularz → domena

**File**: `src/components/forms/inspection-form/inspection-form.tsx`

**Intent**: `optionalNumber` na `cost` przestaje mieć sens, gdy pole jest wymagane.

**Contract**: `toData` (`:141`) — `cost: Number(value.cost)`.

> **Sprostowanie (bramka przeglądu, 2026-08-24).** Plan zakładał, że etykieta pola dostanie
> „oznaczenie wymagalności zgodne z konwencją pozostałych wymaganych pól tego formularza". Takiej
> konwencji w repo nie ma — przeszukanie wszystkich dwunastu katalogów `src/components/forms/` nie
> znalazło ani jednego markera wymagalności (gwiazdka, `isRequired`, `requiredMarker`). Pozycja była
> więc niewykonalna jak napisana i nie została zrealizowana: wymagalność sygnalizuje wyłącznie
> komunikat walidacji, tak jak w każdym innym formularzu. Wprowadzenie markera to zmiana konwencji
> całego repo, a nie szczegół tego slice'a.

#### 5. Typy domenowe

**File**: `src/lib/fleet/types.ts`, `src/types/fleet.ts`, `src/lib/fleet/map-inspection.ts`

**Intent**: Zwęzić `cost` do `number` wszędzie, gdzie dziś jest `number | null`, żeby konsumenci
przestali obsługiwać przypadek, który nie może już zaistnieć.

**Contract**: `InspectionRecordT.cost: number` i `InspectionHistoryEntryT.cost: number`.
`toInspectionEvent` przestaje mapować brak na `null`.

#### 6. Bump klucza cache'a

**File**: `src/lib/queries/fleet.ts`

**Intent**: Stary wpis cache'a niesie `cost: null` pod nowym typem — patrz „Critical Implementation
Details".

**Contract**: `['fleet-dataset-v2']` → `['fleet-dataset-v3']`; komentarz przy kluczu (`:36-38`)
dopisuje ten powód obok istniejącego o `flags`.

### Success Criteria:

#### Automated Verification:

- Migracja przechodzi na lokalnej bazie: `pnpm payload migrate`
- Kolumna jest `NOT NULL`: `docker compose exec -T db psql -U postgres -d wykonczymy-db -c "\d vehicle_inspections"`
- Spec akcji przeglądu odrzuca payload bez kwoty i **nic nie zapisuje** (nowy przypadek w `src/__tests__/lib/actions/`)

#### Manual Verification:

- Formularz „Dodaj przegląd" nie pozwala zapisać bez kwoty i pokazuje komunikat po polsku
- `/admin` → `vehicle-inspections` też odmawia zapisu bez kwoty
- Istniejące przeglądy bez kwoty pokazują po migracji `0 zł`, nie pustkę ani błąd

---

## Phase 2: Jedna reguła kosztów

### Overview

Skoro `cost` nie może już być `null`, filtrowanie `cost !== null` w `summariseCosts` staje się
martwe. Karta pojazdu i przyszła kolumna liczą tym samym kodem.

### Changes Required:

#### 1. `summariseCosts`

**File**: `src/lib/fleet/costs.ts`

**Intent**: Usunąć martwy filtr i type guard; przepisać komentarz `:25-30`, bo jego uzasadnienie
(„nobody recorded a price there") opisuje stan, który przestał być możliwy.

**Contract**: `.filter((entry): entry is … => entry.cost !== null)` (`:36`) znika. `byType` nadal
pomija typ **bez żadnego przeglądu** — to jest inne twierdzenie niż „bez ceny" i zostaje.
Sygnatura i kształt `VehicleCostsT` bez zmian.

#### 2. Sumowanie dla listy

**File**: `src/lib/fleet/costs.ts`

**Intent**: Lista ma płaską `InspectionRecordT[]`, karta ma `historyByType` — potrzebna jest jedna
funkcja sumująca, z której korzystają obie, żeby ta sama liczba nie miała dwóch implementacji
(`lessons.md:1128`).

**Contract**: nowy eksport `sumCosts(entries: readonly { performedAt: string; cost: number }[], range): number`,
gdzie `range` to `DateRangeT | typeof ALL_TIME`. `summariseCosts().total` liczy się przez nią.
Porównanie zakresu leksykalne na `YYYY-MM-DD`, kraniec `from` i `to` **inkluzywnie**.

#### 3. Test i manual check

**File**: `src/__tests__/lib/fleet/costs.test.ts`, `context/foundation/manual-checks.md`

**Intent**: Przypadek „leaves out a type whose entries carry no cost" broni reguły, która właśnie
została wycofana — zostaje przepisany, nie skasowany, bo jego następca („typ bez żadnego przeglądu
nie pojawia się w rozbiciu") nadal jest prawdą. Manual check `:1358` wycofany, z notatką dlaczego.

**Contract**: komentarz w teście (`:45`) idzie za regułą; nowe przypadki na `sumCosts` z zakresem
(wewnątrz, na krańcu, poza) i bez zakresu.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/fleet/costs.test.ts`
- Nie ma już odwołań do `cost !== null` w `src/lib/fleet/`: `grep -rn "cost !== null\|cost === null" src/lib src/components`

#### Manual Verification:

- Zakładka „Koszty" na karcie pojazdu pokazuje te same liczby co przed zmianą dla pojazdu, którego
  wszystkie przeglądy miały wpisaną kwotę

---

## Phase 3: Kolumna kosztów i suma w stopce

### Overview

Wiersz listy niesie sumę kosztów, tabela dostaje kolumnę i wiersz podsumowania. Jeszcze bez filtra —
liczone jest wszystko.

### Changes Required:

#### 1. Wiersz listy

**File**: `src/lib/queries/fleet.ts`, `src/types/fleet.ts`

**Intent**: `toRow` liczy sumę kosztów z eventów, które i tak dostaje.

**Contract**: `FleetRowT` zyskuje `totalCosts: number`. `toRow` dostaje czwarty parametr
`costRange: DateRangeT | typeof ALL_TIME` — **bez wartości domyślnej**, bo jego brak zmieniałby
liczbę (`lessons.md:1489`). `fetchVehicleDetail` (`:135`) podaje `ALL_TIME` jawnie.

#### 2. Kolumna

**File**: `src/components/tables/fleet.tsx`

**Intent**: Kolumna „Koszty" między „Do wymiany" a kolumnami terminów, wyrównana do prawej.

**Contract**: `col.accessor('totalCosts', { id: 'costs', header: 'Koszty', meta: { align: 'right' },
cell: (info) => formatPLN(info.getValue()) })`. Bez `sortUndefined` — accessor zwraca liczbę,
nigdy `undefined`.

#### 3. Stopka

**File**: `src/components/fleet/fleet-data-table.tsx`

**Intent**: Wiersz sumy zbiorczej pod tabelą, liczony z **tych samych wierszy**, które tabela
renderuje (po filtrze wyszukiwarki), a nie z osobnego źródła (`lessons.md:1128`).

**Contract**: prop `footer` na `DataTable` dostaje funkcję renderującą wiersz podsumowania; suma to
`filteredData.reduce((sum, row) => sum + row.totalCosts, 0)` przepuszczone przez `formatPLN`.
Etykieta: „Razem".

### Success Criteria:

#### Automated Verification:

- Nowe przypadki `toRow` w `src/__tests__/lib/queries/fleet.test.ts`: suma z wielu przeglądów,
  pojazd bez przeglądów → `0`. **Fixture musi zawierać event z realną kwotą** — dzisiejszy
  `datasetEvent` ma `cost` zaszyte na sztywno, a fixture w stanie zdegenerowanym unieważnia
  asercję (`lessons.md:1395`).
- `pnpm exec vitest run src/__tests__/lib/queries/fleet.test.ts`

#### Manual Verification:

- Kolumna „Koszty" pokazuje sumę zgodną z zakładką „Koszty" na karcie tego samego pojazdu
- Sortowanie po kolumnie działa w obie strony; pojazd bez przeglądów pokazuje `0 zł`
- Kolumnę da się ukryć przez „Kolumny", a wybór przeżywa odświeżenie
- Suma w stopce równa się sumie widocznych wierszy, także po wpisaniu czegoś w wyszukiwarkę

---

## Phase 4: Filtr zakresu dat

### Overview

`?from=&to=` w URL, pasek jak w transferach, filtrowanie na serwerze nad cachem.

### Changes Required:

#### 1. Wspólny hook do zapisu parametrów URL

**File**: `src/hooks/use-url-filter-params.ts` (nowy)

**Intent**: `updateParam`/`updateMultipleParams` są dziś uwięzione w `transfer-filters.tsx:72-84`.
Flota potrzebuje tego samego, a kopiowanie zamknięcia dałoby dwie implementacje jednej mechaniki.

**Contract**: `useUrlFilterParams(baseUrl: string)` → `{ updateParam, updateMultipleParams, isPending }`.
Wewnątrz `router.replace(buildUrlWithParams(...), { scroll: false })` w `startTransition`, z
resetem `page: ''`. `TransferFilters` przechodzi na ten hook — jego zachowanie nie może się zmienić.

#### 2. Uogólnienie paska dat

**File**: `src/components/transfers/date-filters.tsx` → `src/components/filters/date-filters.tsx`

**Intent**: Pasek jest w ~90% generyczny; jedyne sprzężenie to zaszyte `'from'`/`'to'`. Przy okazji
`DateFilterButton` i `ClearButton` przenoszą się z `components/transfers/` do `components/filters/` —
oba są bezstanowe i nie mają nic wspólnego z transferami.

**Contract**: `DateFilters` przestaje przyjmować `updateParam`/`updateMultipleParams` w propsach
i bierze `baseUrl`, wołając hook z punktu 1 sama — to usuwa dzisiejsze rozdwojenie (czyta URL sama,
pisze przez propsy). Klucze parametrów zostają `'from'`/`'to'` dla obu konsumentów.

#### 3. Route

**File**: `src/app/(frontend)/flota/page.tsx`

**Intent**: Strona czyta zakres z URL i podaje go zapytaniu.

**Contract**: sygnatura rozszerza się do `PagePropsT` (`src/types/page.ts:3-5`). Zakres parsowany
funkcją o semantyce **półotwartej** — `parseDateRange` (`src/lib/utils/parse-date-range.ts:8`)
wymaga obu krańców i jest martwy, więc zostaje przepisany na `{ from?: string; to?: string }`
zwracane zawsze, wraz ze swoim specem. `activeCount` (`:23`) liczy pojazdy i **nie** przechodzi
przez filtr.

#### 4. Zapytanie

**File**: `src/lib/queries/fleet.ts`

**Intent**: Zakres wchodzi tam, gdzie dziś `today` — poza cachem.

**Contract**: `fetchFleetOverview(costRange: DateRangeT | typeof ALL_TIME)` — **bez domyślnej
wartości**. `getFleetDataset` bez zmian: zero argumentów, klucz bez daty. Zakres trafia wyłącznie
do sumowania kosztów w `toRow`; tablica `events` **nie** jest zawężana.

#### 5. Pasek na flocie

**File**: `src/components/fleet/fleet-data-table.tsx`

**Intent**: `DateFilters` nad tabelą, w istniejącym pasku narzędzi.

**Contract**: `baseUrl="/flota"`. Pasek renderuje się nad `DataTable`, obok wyszukiwarki i
przełącznika kolumn.

### Success Criteria:

#### Automated Verification:

- Spec przepisanego parsera zakresu: sam `from`, sam `to`, oba, żaden
- Spec `sumCosts` z zakresem: wpis dokładnie na `from`, dokładnie na `to`, dzień przed, dzień po
- Spec `TransferFilters` / `build-transfer-filters` nadal zielony po przejściu na wspólny hook:
  `pnpm exec vitest run src/__tests__/build-transfer-filters.test.ts src/__tests__/utils.test.ts`

#### Manual Verification:

- `/flota?from=2026-07-01&to=2026-07-31` — kolumna i stopka liczą wyłącznie lipiec
- Wybór „Miesiąc" nadpisuje oba krańce; „Wyczyść daty" znika oba i przywraca pełną historię
- Sam „Od" bez „Do" działa (wszystko od tej daty w przód); sam „Do" analogicznie wstecz
- Filtr przeżywa odświeżenie strony i da się wysłać linkiem
- Kolumny terminów, „Do wymiany" i przebieg **nie** reagują na filtr dat — pokazują to samo co przed
- Filtr dat na `/kasa/[id]`, `/inwestycje/[id]`, `/pracownicy/[id]` i dashboardzie działa jak przed
  zmianą (regresja po przejściu na wspólny hook)

---

## Testing Strategy

### Unit Tests:

- `sumCosts`: zakres inkluzywny na obu krańcach, `ALL_TIME`, pusta lista
- `summariseCosts`: rozbicie i suma po usunięciu martwego filtra; typ bez żadnego przeglądu pomijany
- `toRow`: suma kosztów z wielu przeglądów, pojazd bez przeglądów → `0`, zakres zawęża sumę
  **nie ruszając** `deadlines` / `activeFlags` / `latestOdometer`
- Parser zakresu: cztery kombinacje krańców

### Integration Tests:

- Akcja przeglądu odrzuca payload bez kwoty i **nic nie zapisuje** — asercja na stanie
  utrwalonym, nie na zwrotce akcji

### Manual Testing Steps:

Zbierane raz, na końcu, do `context/foundation/manual-checks.md` — patrz bloki
`#### Manual Verification:` w fazach.

**Uwaga o oracle'u:** ryzyko #1 z `test-plan.md:51` („dwie powierzchnie liczą tę samą liczbę
inaczej") jest tym, które ta zmiana dziedziczy. Test porównujący kolumnę z kartą pojazdu byłby
tautologiczny po fazie 2 (obie wołają `sumCosts`), więc **oracle musi być niezależny** — wartość
wyliczona ręcznie z fixture'u, nie odczytana z drugiej powierzchni (`test-plan.md:30-36`).

## Performance Considerations

Fold `O(pojazdy × eventy)` w pamięci, bez nowego zapytania. Plan EX-711 deklaruje „tens of vehicles,
no scale story to design for", a finding o tej złożoności został tam świadomie zdropowany.

Filtr w URL oznacza round-trip na każdą zmianę — świadomy koszt wybranego wariantu; `startTransition`

- `isPending` dają tę samą informację zwrotną co na transferach.

## Migration Notes

- **Kolejność deploya jest odwrotna.** `SET NOT NULL` łamie stary kod, który nadal wysyła
  `cost: undefined` → **push, potem migracja**, gdy nowy deploy jest żywy. Uruchamia człowiek:
  `pnpm db:migrate:prod`. Agent nie dotyka Neona.
- **Przed migracją prod sprawdzić, czy `vehicle_inspections` w ogóle tam jest** — migracja
  `20260818_1_add_fleet` należy do EX-711, który wciąż jest _in review_ i którego migracja prod jest
  nadal należna. Jeśli tabeli nie ma, backfill nie ma czego dotknąć.
- **Jeśli na prod są wiersze z `cost IS NULL`**, backfill do `0` bezpowrotnie zamienia „nie wiem" na
  „zero". Lokalnie dotyczy to 3 wierszy testowych. Na prod decyzję podejmuje człowiek przed
  uruchomieniem migracji.
- `.husky/pre-push` przypomni o migracji przy pushu na `main` dodającym `src/migrations/*.ts`.

## Deferred

- **E2E**: kolumna kosztów, sortowanie po niej, suma w stopce i zawężanie przez filtr dat dokładają
  siódmą ścieżkę do **EX-716** (`e2e-backlog`). Spec nie powstaje w tej zmianie — dopisujemy zakres
  do issue.

## References

- Research: `context/changes/2026-08-24-fleet-costs-column/research.md`
- Ustalenia właściciela: `context/changes/2026-08-24-fleet-costs-column/change.md`
- Filtr do skopiowania: `src/components/transfers/date-filters.tsx:17`, `src/components/transfers/transfer-filters.tsx:72-84`
- Wzorzec kolumny pieniężnej: `src/components/tables/investments.tsx:193-194`
- Wzorzec stopki: `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:221`
- Pułapka sortowania, raz już naprawiona: `context/changes/2026-08-18-flota-przeglady/review-gate.md:16`

## Whole-tree Gate

Raz, po ostatniej fazie:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Progress

> Konwencja: `- [ ]` do zrobienia, `- [x]` zrobione. Dopisz ` — <commit sha>`, gdy krok wyląduje. Nie zmieniaj tytułów kroków.

### Phase 1: Domknięcie źródła — „Koszt" polem wymaganym

#### Automated

- [x] 1.1 Migracja przechodzi na lokalnej bazie: `pnpm payload migrate` — 3efb2236
- [x] 1.2 Kolumna `cost` jest `NOT NULL` w `\d vehicle_inspections` — 3efb2236
- [x] 1.3 Spec akcji przeglądu odrzuca payload bez kwoty i nic nie zapisuje — 3efb2236

### Phase 2: Jedna reguła kosztów

#### Automated

- [x] 2.1 `pnpm exec vitest run src/__tests__/lib/fleet/costs.test.ts` — 0969ed3f
- [x] 2.2 Brak odwołań do `cost !== null` / `cost === null` w `src/lib` i `src/components` — 0969ed3f

### Phase 3: Kolumna kosztów i suma w stopce

#### Automated

- [x] 3.1 Nowe przypadki `toRow` (suma z wielu przeglądów, pojazd bez przeglądów → 0) na fixturze z realną kwotą — e87c0ded
- [x] 3.2 `pnpm exec vitest run src/__tests__/lib/queries/fleet.test.ts` — e87c0ded

### Phase 4: Filtr zakresu dat

#### Automated

- [x] 4.1 Spec parsera zakresu: sam `from`, sam `to`, oba, żaden — 60ec1eef
- [x] 4.2 Spec `sumCosts` z zakresem: na `from`, na `to`, dzień przed, dzień po — 60ec1eef
- [x] 4.3 Specy transferów zielone po przejściu na wspólny hook — 60ec1eef

### Whole-tree Gate

- [x] `pnpm typecheck` — 60ec1eef
- [x] `pnpm lint` — jedyny błąd (`src/hooks/use-latest-request.ts:15`, „Cannot access refs during render") jest sprzed tej zmiany (`8e47fb80`) i nie dotyczy żadnego z ruszonych plików — 60ec1eef
- [x] `pnpm test` — 2745 zielonych, 161 pominiętych (specy wymagające DB) — 60ec1eef
- [x] `pnpm build` — 60ec1eef
