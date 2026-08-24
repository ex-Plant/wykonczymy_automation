---
date: 2026-08-24T14:57:39+02:00
researcher: Claude (Opus 5)
git_commit: 81f1c0c900fa4c155e2479e764c73e003ca1d79a
branch: staging
repository: wykonczymy
topic: 'Kolumna sumy poniesionych kosztów na liście floty + filtr zakresu dat'
tags: [research, codebase, fleet, vehicle-inspections, data-table, date-filter, unstable-cache]
status: complete
last_updated: 2026-08-24
last_updated_by: Claude (Opus 5)
---

# Research: kolumna kosztów na `/flota` + filtr zakresu dat

**Date**: 2026-08-24T14:57:39+02:00
**Researcher**: Claude (Opus 5)
**Git Commit**: `81f1c0c900fa4c155e2479e764c73e003ca1d79a`
**Branch**: `staging`
**Repository**: wykonczymy

## Research Question

Jak dołożyć do tabeli `/flota` kolumnę z sumą poniesionych kosztów na pojazd, oraz filtr
zakresu dat („analogicznie jak w transferach"), którego ta kolumna słucha? Co już istnieje,
co trzeba uogólnić, i które wcześniejsze decyzje ta zmiana narusza.

## Summary

Sama kolumna jest tania — dane już są na miejscu. Filtr jest właściwą pracą, a największym
ryzykiem nie jest ani jedno, ani drugie, tylko **kolizja reguły `0 zł` z regułą już wdrożoną
i udokumentowaną w trzech miejscach**.

Sześć ustaleń, które kształtują plan:

1. **Kolumna nie potrzebuje nowego zapytania.** `cost` jedzie już w każdym evencie
   (`src/lib/fleet/types.ts:31`), przez cache'owany `getFleetDataset`, aż do `toRow`
   (`src/lib/queries/fleet.ts:53`). Fold w pamięci jest wprost usankcjonowany precedensem —
   „tens of vehicles, no scale story to design for".
2. **Nie ma routu `/transfery`.** Filtr transferów to złożenie w `src/components/transfers/`,
   montowane na czterech stronach (`/kasa/[id]`, `/inwestycje/[id]`, `/pracownicy/[id]`,
   dashboard). „Analogicznie jak w transferach" znaczy: te same parametry URL `from`/`to`,
   ten sam pasek Rok / Miesiąc / Od / Do / Wyczyść.
3. **Filtr musi się złożyć NAD cache'em, nie w jego kluczu.** `getFleetDataset` ma stały klucz
   `['fleet-dataset-v2']` z pisemnym uzasadnieniem: „nothing here depends on today's date, so the
   entry survives midnight". Wepchnięcie `from`/`to` do klucza wprost łamie tę regułę i trafia
   w archiwalne ustalenie z `investment-panel-filter-scope`.
4. **`0 zł` dla pojazdu bez wycenionych przeglądów przeczy regule, która już jest w kodzie.**
   `summariseCosts` celowo **pomija** typ bez ceny — z komentarzem, testem i niezaznaczonym
   manual checkiem. To nie jest „świadoma różnica do zanotowania", tylko decyzja do domknięcia
   w tej zmianie.
5. **`0 zł` ma pułapkę sortowania**, identyczną z błędem już raz naprawionym na tej tabeli
   (`sortUndefined: 'last'` był no-opem): pojazd bez wpisanej kwoty sortuje się jako najtańszy.
6. **Zakres dat nie może mieć domyślnej wartości parametru.** `lessons.md:1489` — parametr,
   którego brak zmienia **liczbę**, nie dostaje defaultu.

## Detailed Findings

### 1. Ścieżka danych `/flota` — gdzie wpiąć kolumnę

**Route** — `src/app/(frontend)/flota/page.tsx:13-33`. Server component, **bez `searchParams`**,
bez Suspense, wszystko awaitowane inline. Dodanie filtra URL wymaga poszerzenia sygnatury o
`PagePropsT` (`src/types/page.ts:3-5`).

`activeCount` (`:23`) liczy pojazdy, nie pieniądze — filtr dat nie powinien go dotykać.

**Cache** — `src/lib/queries/fleet.ts:28-40`:

```ts
const getFleetDataset = unstable_cache(
  async (): Promise<FleetDatasetT> => loadFleetDataset(await getPayload({ config })),
  ['fleet-dataset-v2'], // stały klucz, zero argumentów
  { tags: [CACHE_TAGS.vehicles, CACHE_TAGS.vehicleInspections] },
)
```

Doc comment `:24-27` niesie regułę: _„Deliberately raw: nothing here depends on today's date, so
the entry survives midnight."_

**Szew** — `fetchFleetOverview` (`src/lib/queries/fleet.ts:77-87`) siedzi **poza** cachem i już
przeciąga przez niego wartość per-request (`today = warsawToday()`), wpuszczając ją do `toRow`.
Zakres dat wchodzi dokładnie tą samą drogą.

**Wiersz** — `FleetRowT` (`src/types/fleet.ts:16-24`) = `VehicleRecordT` + `deadlines`,
`activeFlags`, `latestOdometer`, `kmSinceOilChange`. Budowany w `toRow`
(`src/lib/queries/fleet.ts:53-69`), który jest eksportowany i pokryty testem
(`src/__tests__/lib/queries/fleet.test.ts`), i **współdzielony z `fetchVehicleDetail`**
(`:135`) — nowy wymagany parametr trzeba podać w obu miejscach.

**Ważny niuans cache'owy:** lekcja o bumpowaniu klucza (`lessons.md:1010-1036`) dotyczy kształtu
**payloadu w cache'u**, czyli `FleetDatasetT`. `FleetRowT` powstaje _po_ odczycie z cache'a, więc
poszerzenie go o sumę kosztów **nie wymaga** `fleet-dataset-v3`. Bump byłby potrzebny dopiero,
gdyby zmienił się `FleetDatasetT`.

**Tagi** — `CACHE_TAGS.vehicles` / `CACHE_TAGS.vehicleInspections` (`src/lib/cache/tags.ts:16-17`),
rewalidowane w `src/lib/actions/fleet.ts:32,47,65,109` oraz w hookach kolekcji
(`src/collections/vehicle-inspections.ts:25-26`). `cost` leży na `vehicle-inspections` — **żaden
nowy tag nie jest potrzebny**.

**`loadFleetDataset` NIE wolno filtrować datą.** Dwóch konsumentów:
`getFleetDataset` (ekran) i `loadFleetHistories` → cron digest
(`src/lib/fleet/sweep-io.ts:7`, `src/app/(payload)/api/cron/fleet-reminders/route.ts:18`).
Doc comment `src/lib/fleet/dataset.ts:18-25` mówi wprost, po co jest współdzielony: _„the digest
mail and the listing must never disagree about what the fleet contains."_

Co więcej — **nie wolno filtrować całej tablicy `events` przed `toRow`**. `deadlines`,
`activeFlags`, `latestOdometer` i `kmSinceOilChange` czytają tę samą tablicę; zawężenie jej do okna
zdegradowałoby je do „nic nie odnotowano" dla każdego auta, którego ostatni przegląd wypadł przed
oknem. Zakres wolno przyłożyć **wyłącznie do sumowania kosztów**.

### 2. Tabela i kolumny

`src/components/tables/fleet.tsx:13-71` — fabryka `getFleetColumns()`, TanStack
`createColumnHelper<FleetRowT>()`. Kolumny: `registration` (`canHide: false`), `vehicle`, `flags`
(„Do wymiany"), pięć kolumn deadline'owych generowanych z `SCHEDULED_INSPECTION_TYPES`, `status`
(`align: 'right'`).

**Konwencja meta** — `src/components/tables/column-meta.ts:3-17`: `label`, `canHide`, `align`,
`tooltip`, `minWidth`. Wyrównanie do prawej to wyłącznie `meta: { align: 'right' }`, czytane w
`table-header.tsx:16,37` i `data-table-row.tsx:68,75`. Żadna komórka w repo nie używa
`tabular-nums`.

**Pieniądze** — `src/lib/utils/format-currency.ts:8`:

```ts
const formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
export const formatPLN = (amount: number) => formatter.format(roundToCents(amount))
```

`roundToCents` jest load-bearing — zwija `-0`, żeby wyzerowany bilans nie drukował „-0,00 zł".
Wzorzec kolumny pieniężnej: `src/components/tables/users.tsx:48`, bogatszy
`src/components/tables/investments.tsx:193-194`.

**Powłoka** — `src/components/ui/data-table/data-table.tsx:42`. Daje sortowanie, widoczność kolumn
(localStorage po `storageKey`), slot `toolbar`, slot `footer`, klikalne wiersze. **Nie ma
`getFilteredRowModel`** — filtrowanie kolumnowe TanStacka nie jest podpięte nigdzie w aplikacji;
każda lista filtruje _przed_ wejściem danych do `DataTable`.

`FleetDataTable` (`src/components/fleet/fleet-data-table.tsx:13-46`) filtruje klientowo przez
`useSearchFilter` (`:18`) i ma już zapełniony toolbar (search + ColumnToggle + dwa dialogi, `:31-43`)
— tam wylądowałby pasek dat.

**Slot `footer` istnieje i jest nieużywany na flocie** (`data-table.tsx:36-37,132`; precedens:
`kosztorys/summary/tables/materials-transactions-table.tsx:221`) — gotowe miejsce na sumę zbiorczą
pod kolumną, gdyby była potrzebna.

### 3. Logika kosztów, która już jest

`src/lib/fleet/costs.ts`:

```ts
export type TypeCostT     = { type: InspectionTypeT; count: number; total: number }   // :5-9
export type CostEntryT    = { id: number; type: InspectionTypeT; performedAt: string; cost: number }  // :11-16
export type VehicleCostsT = { byType: TypeCostT[]; total: number; entries: CostEntryT[] }  // :18-23

export const summariseCosts = (
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>,
): VehicleCostsT => { ... }                                                            // :31-58
```

Trzy fakty istotne dla planu:

- Wejściem jest **`historyByType`** — kształt strony szczegółu, **nie** płaska `InspectionRecordT[]`,
  którą ma lista. Bez wyciągnięcia płaskiego wariantu `toRow` tego nie użyje.
- `entries[].performedAt` to już dzień warszawski `YYYY-MM-DD` (konwersja w `historyOfType`,
  `src/lib/queries/fleet.ts:108`) — porównanie zakresu jest leksykalne, trywialne.
- Wpisy z `cost === null` są odfiltrowane (`:36`), a typ bez wycenionego wpisu **jest pomijany, nie
  pokazywany jako 0 zł**.

Jedyny konsument: `src/components/fleet/vehicle-costs.tsx:24` (zakładka „Koszty",
`vehicle-detail-tabs.tsx:12-15,35`, montowana w `flota/[id]/page.tsx:84`).
Testy: `src/__tests__/lib/fleet/costs.test.ts` (4 przypadki).

### 4. Filtr dat transferów — co dokładnie robi

**Nie ma routu `/transfery`.** Filtr to `TransfersSection` → `TransferTableServer` →
`TransferDataTable` → `TransferFilters` → `DateFilters`, montowany na `/kasa/[id]`,
`/inwestycje/[id]`, `/pracownicy/[id]` i dashboardzie (`manager-dashboard.tsx:38`).

**UI** — `src/components/transfers/date-filters.tsx` (74 linie): cztery widgety w rzędzie plus
czyszczenie.

| Widget                   | Etykieta       | Linia    |
| ------------------------ | -------------- | -------- |
| Rok (bieżący + 4 wstecz) | „Rok"          | `:47-53` |
| Miesiąc (`MONTHS`)       | „Miesiąc"      | `:55-61` |
| Kalendarz od             | „Od"           | `:63`    |
| Kalendarz do             | „Do"           | `:64`    |
| Czyszczenie              | „Wyczyść daty" | `:66-71` |

Rok i Miesiąc **nadpisują oba krańce** całym miesiącem (`getMonthDateRange`, `:26-39`) — nie ma
trzeciego stanu. „Od"/„Do" to `DateFilterButton` (`date-filter-button.tsx:17`) — Popover +
shadcn `Calendar` w `mode="single"`, `locale={pl}`, format wyświetlania `d MMM yyyy`, aktywność
sygnalizowana `variant={value ? 'activeFilter' : 'outline'}`.

**Transport stanu** — dwa parametry URL, `from` i `to`, oba czystym `YYYY-MM-DD`.
Odczyt: `useSearchParams()` wewnątrz liścia (`date-filters.tsx:18-24`) — dropdowny są
**wyprowadzane z `from`**, nie trzymane osobno. Zapis: liść **nie ma routera**, dostaje
`updateParam` / `updateMultipleParams` jako propsy z rodzica
(`transfer-filters.tsx:72-84`), gdzie siedzi `router.replace(url, { scroll: false })` w
`startTransition` + portalowany `<Loader />`. `buildUrlWithParams`
(`src/lib/utils/build-url-with-params.ts:5`) **kasuje klucz o wartości `''`** — tak wyrażone jest
czyszczenie, i dlatego każda zmiana filtra resetuje `page: ''`.

**Serwer, nie klient.** `searchParams` → Payload `Where` w
`src/lib/queries/transfer-filters.ts:170-177` (`greater_than_equal` / `less_than_equal`, każdy
kraniec niezależnie opcjonalny). Ten `Where` zasila dwie ścieżki: `payload.find`
(`queries/transfers.ts:20-53`) i surowy SQL kafla sum
(`db/sum-transfers.ts:280-304` przez `where-to-sql.ts:36`).

**Cache** — `['transfers-raw', JSON.stringify(where), page, limit, sort]`
(`transfers.ts:51`): **zakres dat jest częścią klucza cache'a**. Fabryka `unstable_cache` jest
tworzona wewnątrz async wrappera i od razu wołana, żeby dało się interpolować klucz per filtr.
To wzorzec przeciwny do floty i **nie należy go tu kopiować** (patrz §6).

**Domyślne i brzegowe:** brak parametrów = brak ograniczenia (nie ma domyślnego „bieżący
miesiąc"); jeden kraniec = półotwarty przedział (testy
`src/__tests__/build-transfer-filters.test.ts:67-83`); „brak filtra" = brak klucza w URL;
`router.replace` (nie `push`) więc filtry nie odkładają się w historii; zakres nie przeżywa
wyjścia ze strony.

**Strefa czasowa — czego NIE przenosić.** Transfery używają surowego lokalnego `Date` + date-fns
(`format(date, 'yyyy-MM-dd')` przy zapisie, `new Date(currentFrom + 'T00:00:00')` przy odczycie).
Inkluzywność górnego krańca trzyma się tylko dlatego, że dni są persystowane o północy UTC, a na
ścieżce surowego SQL bound leci gołym literałem (`where-to-sql.ts:48-49`) rozstrzyganym przez
`TimeZone` sesji DB. **Flota ma lepszy aparat** — `src/lib/fleet/days.ts` (`DayT`, `toWarsawDay`,
`warsawToday`, `daysBetween`, `addMonthsToDay`), oparty na
`Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' })`. Porównanie zakresu na flocie robi
się leksykalnie na `YYYY-MM-DD` po `toWarsawDay`, jak reszta modułu
(`queries/fleet.ts:100`, `costs.ts:56`).

Uwaga: `performedAt` na `InspectionRecordT` to **surowy timestamp**, nie dzień
(`src/lib/fleet/map-inspection.ts:17`) — trzeba przepuścić przez `toWarsawDay` przed porównaniem.

### 5. Co da się użyć bez zmian, a co trzeba uogólnić

**Do wzięcia jak leży:**

| Element                       | Ścieżka                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DateFilterButton`            | `src/components/transfers/date-filter-button.tsx:17` — czyste `{ label, value, onChange }`, zero związku z transferami                            |
| `ClearButton`                 | `src/components/transfers/clear-button.tsx:10` — też generyczny, też źle zaszufladkowany                                                          |
| `FilterSelect`                | `src/components/filters/filter-select.tsx:28`                                                                                                     |
| `FilterGrid`                  | `src/components/ui/filter-grid.tsx:8`                                                                                                             |
| `buildUrlWithParams`          | `src/lib/utils/build-url-with-params.ts:5` (konwencja `''` = usuń)                                                                                |
| `getMonthDateRange`, `MONTHS` | `src/lib/utils/date.ts:7`, `src/lib/constants/months.ts:1`                                                                                        |
| `Calendar`                    | `src/components/ui/calendar.tsx` — **ma już style `range_start/middle/end`** (`:95-97`, `:163-171`), choć `mode="range"` nie jest nigdzie używany |

**Do uogólnienia lub napisania:**

- **`DateFilters`** (`date-filters.tsx:17`) jest w ~90% generyczny, ale ma rozdwojenie jaźni: sam
  czyta `useSearchParams()`, a pisze przez wstrzyknięte propsy. Jedyne twarde sprzężenie to
  literały `'from'` / `'to'` (`:19-20,28,32,63-64,67`) i sztywne okno pięciu lat (`:42`).
  Sparametryzowanie `{ fromKey, toKey }` to ~10 linii.
- **Nie istnieje żaden wspólny hook URL-state** dla par klucz-wartość. Jedyny jaki jest,
  `useToggleSearchParam` (`src/hooks/use-toggle-search-param.ts:12`), obsługuje **wyłącznie
  boolean**. `updateParam`/`updateMultipleParams` są uwięzione w `transfer-filters.tsx:72-84`.
  To jest kandydat do wyciągnięcia (`use-url-filter-params`), bo flota potrzebuje tego samego.
- **Serwerowa strona transferów jest nie do użycia:** `buildTransferFilters` to monolit z blokiem
  dat zaszytym na `:170-177`, a `where-to-sql.ts:9-22` ma zamkniętą mapę kolumn transferowych,
  która **rzuca** na nieznane pole.
- `parseDateRange` (`src/lib/utils/parse-date-range.ts:8`, `DateRangeT = { from: string; to: string }`)
  jest **martwym kodem** — referuje do niego wyłącznie własny spec. Nie używa go
  `buildTransferFilters`, i jego semantyka jest **surowsza** (wymaga obu krańców, transfery
  akceptują jeden). To naturalne miejsce na parsowanie zakresu floty, ale trzeba świadomie wybrać
  jedną z dwóch semantyk.

Brak w repo: `DateRangePicker`, jakikolwiek konsument `mode="range"`, `nuqs`.

### 6. Serwer czy klient — dwie drogi, obie z precedensem

|                       | Serwerowo (`searchParams` → `fetchFleetOverview`)                  | Klientowo (stan w `FleetDataTable`)                                               |
| --------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Precedens             | transfery; `PagePropsT` istnieje                                   | `useSearchFilter` (`fleet-data-table.tsx:18`); widoczność kolumn też jest lokalna |
| Koszt                 | `FleetPage` musi dostać `searchParams`; round-trip na każdą zmianę | trzeba dowieźć wycenione wpisy w payloadzie wiersza                               |
| Link do udostępnienia | tak                                                                | nie                                                                               |

Argument przeciw URL-owi dla czystego foldu jest w repo zapisany — `flota-przeglady/review-gate.md:97`
o `vehicle-detail-tabs`: _„both views are folds of data already on the page, so a URL param buys a
round trip"_. Ale filtr, który zmienia **co liczy zagregowana liczba**, to inne zwierzę niż
przełącznik zakładki, i wtedy obowiązuje precedens transferów (URL, `from`/`to`).

**Czego nie robić w żadnym wariancie:** nie wpychać `from`/`to` do klucza `getFleetDataset`. To
wprost zderza się z komentarzem `:24-27` i z archiwalnym ustaleniem
`context/archive/2026-07-28-investment-panel-filter-scope/change.md:44-49` („odczyt filtrowany nigdy
nie dzieli klucza cache'a z niefiltrowanym"). Fold nad cachem, tak jak `today`, nie ma tego
problemu w ogóle.

## Code References

- `src/app/(frontend)/flota/page.tsx:13-33` — route bez `searchParams`, `activeCount` na `:23`
- `src/lib/queries/fleet.ts:24-40` — `getFleetDataset`, stały klucz, komentarz o północy
- `src/lib/queries/fleet.ts:53-69` — `toRow`, miejsce na sumę kosztów
- `src/lib/queries/fleet.ts:77-87` — `fetchFleetOverview`, szew per-request
- `src/lib/queries/fleet.ts:94-121,135-136` — `historyOfType`, `fetchVehicleDetail`
- `src/lib/fleet/dataset.ts:18-25` — dlaczego dataset jest współdzielony z cronem
- `src/lib/fleet/sweep-io.ts:7`, `src/app/(payload)/api/cron/fleet-reminders/route.ts:18` — drugi konsument
- `src/lib/fleet/costs.ts:5-23,26-30,31-58` — typy, reguła null≠zero, `summariseCosts`
- `src/lib/fleet/types.ts:30-34,36-48` — `InspectionRecordT` (`cost`), `VehicleRecordT`
- `src/lib/fleet/map-inspection.ts:17` — `performedAt` to surowy timestamp
- `src/lib/fleet/days.ts:9,18,22,28,35` — `DayT`, `toWarsawDay`, `warsawToday`, `daysBetween`, `addMonthsToDay`
- `src/types/fleet.ts:16-24` — `FleetRowT`
- `src/components/tables/fleet.tsx:13-71` — kolumny; `:44-64` deadline'y z `sortUndefined: 'last'`
- `src/components/tables/column-meta.ts:3-17` — `align` / `tooltip` / `minWidth` / `canHide`
- `src/components/fleet/fleet-data-table.tsx:13-46` — toolbar, `useSearchFilter`
- `src/components/fleet/vehicle-costs.tsx:24` — jedyny konsument `summariseCosts`
- `src/components/ui/data-table/data-table.tsx:36-37,42,132` — powłoka, sloty `toolbar`/`footer`
- `src/lib/utils/format-currency.ts:8` — `formatPLN`
- `src/components/transfers/date-filters.tsx:17-71` — pasek Rok/Miesiąc/Od/Do/Wyczyść
- `src/components/transfers/date-filter-button.tsx:17` — generyczny kalendarz-przycisk
- `src/components/transfers/transfer-filters.tsx:66-84` — uwięzione `updateParam`/`updateMultipleParams`
- `src/lib/utils/build-url-with-params.ts:5` — `''` = usuń klucz
- `src/lib/queries/transfer-filters.ts:170-177` — `from`/`to` → `Where`
- `src/lib/queries/transfers.ts:51` — filtr w kluczu cache'a (wzorzec transferowy)
- `src/lib/utils/parse-date-range.ts:8` — `parseDateRange`, martwy, semantyka „oba albo nic"
- `src/collections/vehicle-inspections.ts:90-94` — `cost`, bez `required`
- `src/components/forms/inspection-form/inspection-schema.ts:13,28` — `z.string()` / `z.number().optional()`
- `src/__tests__/lib/fleet/costs.test.ts:45` — test broniący reguły null≠zero
- `src/__tests__/lib/queries/fleet.test.ts:30` — fixture z `cost: null` na sztywno

## Architecture Insights

- **Filtr per-request składa się NAD cachem, nie w jego kluczu — na flocie.** `fetchFleetOverview`
  jest jedynym miejscem w repo, gdzie derywacja jest przykładana po odczycie z cache'a, i ma to
  spisane uzasadnienie. Transfery robią odwrotnie (filtr w kluczu), bo tam filtr schodzi do SQL-a.
  Dwa różne wzorce, każdy właściwy dla swojej strony.
- **Klucz cache'a wersjonuje kształt payloadu, nie kształt wiersza.** `FleetRowT` powstaje po
  odczycie, więc jego poszerzenie nie wymaga bumpa; `FleetDatasetT` — wymaga.
- **Filtrowanie w tej aplikacji zawsze poprzedza `DataTable`.** Nigdzie nie jest podpięty
  `getFilteredRowModel`; powłoka tabeli świadomie nie ma slotu filtra ani stanu URL.
- **Money-column ma jeden kanoniczny kształt:** `meta: { align: 'right' }` + `formatPLN` w `cell`.
  Żadnego `tabular-nums`, żadnego drugiego formattera.
- **Fold O(pojazdy × eventy) jest usankcjonowany** — plan EX-711 deklaruje „tens of vehicles, no
  scale story to design for", i finding o tej złożoności został świadomie zdropowany.
- **Zakres wolno przyłożyć tylko do sumowania kosztów**, nigdy do całej tablicy `events` — reszta
  pól wiersza czyta ją bez okna.

## Historical Context (from prior changes)

**Kolumna kosztów była dwukrotnie wyłączona ze scope'u, świadomie:**

- `context/changes/2026-08-18-flota-przeglady/plan.md:65` — „No fuel, service history beyond these
  five types, **costs reporting**, or leasing."
- `.../plan-brief.md:51-52` — „**Out of scope:** … fuel, leasing, **cost reporting** · Playwright spec."

`cost` pojechał w schemacie (`plan.md:138`, `numeric(10,2)`) i jest renderowany wyłącznie na
karcie pojazdu. To nie było przeoczenie, tylko zadeklarowany non-goal — który ta zmiana odwraca.

**Reguła „nikt nie wpisał ceny ≠ było za darmo" jest zapisana w trzech miejscach:**

- `src/lib/fleet/costs.ts:26-29` — _„A type with no costed entry is left OUT rather than shown as
  0 zł: nobody recorded a price there, which is not the same claim as 'it was free', and a column of
  zeroes reads as the latter."_
- `src/__tests__/lib/fleet/costs.test.ts:45` — _„A price nobody recorded is not a price of zero — the
  row would read as 'it was free'."_
- `context/foundation/manual-checks.md:1358` (**niezaznaczony** check EX-711) — „Rodzaj przeglądu, w
  którym nikt nie wpisał kosztu, nie pojawia się w podsumowaniu jako 0 zł"

To jest wprost sprzeczne z ustaleniem właściciela („Pojazd bez wycenionych przeglądów pokazuje
`0 zł`"). `lessons.md:1496` mówi, że zmiana wycofująca miarę musi dogonić komentarze, które ją
twierdzą — inaczej późniejszy czytelnik odtworzy starą regułę.

**Precedens sortowania — ten sam błąd już raz naprawiony na tej tabeli**
(`context/changes/2026-08-18-flota-przeglady/review-gate.md:16`):

> `sortUndefined: 'last'` was a no-op — the accessor returned `number | null` and table-core tests
> `=== undefined`, so „brak danych" sorted as _most_ urgent, inverting the comment's intent.

Naiwny accessor kosztów zwracający `0` reprodukuje to dokładnie: auto bez wpisanej kwoty sortuje się
jako najtańsze, nieodróżnialne od auta, które naprawdę było tanie.

**Argument, który przemawia ZA `0 zł` — ale tylko warunkowo.**
`context/foundation/investment-financials-and-discount.md:29-31`: _„An empty kosztorys is an answer,
not a question to forward to the transfers."_ Tam twarde `0 zł` jest uprawnione, **bo płaszczyzna
źródłowa jest kompletna i autorytatywna**. Na flocie `cost` jest opcjonalny, więc puste jeszcze nie
jest odpowiedzią. Domknięcie źródła (`cost` wymagany) to właśnie to, co zamienia `0 zł` z kłamstwa
w odpowiedź.

**Cache filtrowanego odczytu** — `context/archive/2026-07-28-investment-panel-filter-scope/change.md:44-49`:
odczyt filtrowany dostaje własny punkt cache'owania, żeby wynik z filtrem nigdy nie wylądował pod
kluczem bez filtra. Tamże `:28-29`: test „czy filtr jest aktywny" czyta surowe `searchParams`, nie
zbudowany `Where`, bo `buildTransferFilters` zawsze emituje warunek domyślny.

**Kontrapunkt wart przeczytania przed planem** —
`context/archive/2026-08-08-summary-panel-filter-blind/change.md:22-26`: panel podsumowania celowo
uczyniono **ślepym na filtry**, bo kafel „Suma wybranych transakcji" i tak odpowiadał na pytanie
filtrowane wprost pod tabelą. Analogia: czy filtrowaną liczbą ma być kolumna, czy raczej suma w
stopce.

**Otwarte zobowiązania z poprzednich zmian floty:**

- **EX-716** (`e2e-backlog`) — spec Playwrighta na sześć ścieżek, w tym „the three deadline states +
  urgency sort". Kolumna kosztów dokłada siódmą.
- **~28 niezaznaczonych manual checków EX-711** trzyma slice w stanie _in review, nie archive_
  (`flota-przeglady/review-gate.md:155-157`). Jeden z nich (`:1358`) to reguła, którą ta zmiana odwraca.
- **Brak `beforeDelete` na `vehicles`** (`review-gate.md:166-170`) — usunięcie auta w `/admin` nadal
  kaskadowo kasuje całą historię przeglądów. Z kolumną kosztów znikające wiersze stają się regresją
  **pieniężną**, nie tylko historyczną (`lessons.md:245`).
- **Konwergencja nazewnicza była już raz egzekwowana** (`fleet-manual-flags/review-gate.md:61`, trzy
  polskie nazwy na jedną funkcję). Jedna etykieta dla kosztów: nagłówek kolumny, zakładka karty,
  manual check.

**Lekcje wiążące dla tej zmiany:**

- `lessons.md:1489-1494` — **parametr, którego brak zmienia liczbę, nie dostaje defaultu.**
  `fetchFleetOverview(range = {})` to dokładnie ten defekt; brak zakresu musi być literalnie nazwany
  w miejscu wywołania.
- `lessons.md:1128-1150` — suma i lista, którą podsumowuje, muszą pochodzić z jednego zapytania;
  dwie powierzchnie liczące tę samą liczbę dwiema regułami to zakazany kształt, chyba że różnica
  jest zamierzona i spisana.
- `lessons.md:1010-1036` — poszerzenie kształtu w payloadzie `unstable_cache` wymaga bumpa klucza
  (tu: dotyczy `FleetDatasetT`, nie `FleetRowT`).
- `lessons.md:1395-1412` — fixture w stanie zdegenerowanym unieważnia każdą asercję o braku;
  `fleet.test.ts:30` ma `cost: null` na sztywno, więc test kosztów dopisany bez zasianego wpisu z
  ceną porówna pustkę z pustką.
- `lessons.md:224-229` — konsument z fallbackiem „puste znaczy wszystko" degraduje po cichu; brak
  `from`/`to` znaczący „całość" trzeba zapisać jako zachowanie, nie zostawić jako lukę.

## Related Research

- `context/changes/2026-08-18-flota-przeglady/plan.md`, `plan-brief.md`, `review-gate.md`
- `context/changes/2026-08-19-fleet-manual-flags-and-service-type/plan.md`, `review-gate.md`
- `context/archive/2026-07-28-investment-panel-filter-scope/change.md`
- `context/archive/2026-08-08-summary-panel-filter-blind/change.md`
- `context/foundation/investment-financials-and-discount.md:29-31`

## Test Coverage

`context/foundation/test-plan.md` **nie ma ani jednego ryzyka dla domeny floty** (Risk Map, `:49-58`,
osiem ryzyk). Dziedziczonym ryzykiem jest **#1** (`:51`): _„Two app surfaces disagree — … (or listing
≠ detail view); numbers silently diverge"_ — dokładnie relacja kolumna na liście ↔ zakładka „Koszty"
na karcie. Jego reguła odpowiedzi (`:64`) i lekcja nadrzędna (`:30-36`) mówią to samo: **oracle testu
musi pochodzić z niezależnego źródła**, nigdy z kodu testowanego, i nigdy z drugiej powierzchni.

`test-plan.md:173` odnotowuje, że zespół świadomie nie martwi się poprawnością cache'owania — więc
dyscyplina klucza cache'a jest tu **pozycją na checkliście w momencie edycji**, nie testem do
napisania.

Istniejące testy floty: `src/__tests__/lib/fleet/costs.test.ts` (4 przypadki, w tym ten broniący
reguły null≠zero), `src/__tests__/lib/queries/fleet.test.ts` (`toRow` ×5, `historyOfType` ×3, olej ×2
— **zero asercji o kosztach**, fixture ma `cost: null`), plus specy deadline'ów/progów/flag i dwa
DB-backed specy akcji. **Brak jakiegokolwiek E2E dla `/flota`.**

## Open Questions

1. **Czy `cost` ma zostać polem wymaganym?** To rozstrzygnięcie decyduje, czy `0 zł` jest odpowiedzią,
   czy kłamstwem — i jest warunkiem, pod którym argument z
   `investment-financials-and-discount.md:29-31` w ogóle działa. Uwaga na kierunek migracji: `NOT NULL`
   jest **destrukcyjny**, więc obowiązuje odwrotna kolejność deploya (push, potem migracja) i trzeba
   coś zrobić z wierszami już wprowadzonymi bez kwoty.
2. **Co z manual checkiem `manual-checks.md:1358`** — wycofać, przepisać, czy utrzymać jako regułę
   wyłącznie karty pojazdu, podczas gdy kolumna robi coś innego? Jeśli to drugie, różnica musi być
   spisana w `costs.ts`, w teście i w checku — inaczej `lessons.md:1128` (dwie reguły na jedną liczbę).
3. **Jak kolumna sortuje pojazd bez wycenionych przeglądów?** `0` sortuje go jako najtańszy —
   powtórka błędu z `review-gate.md:16`. Alternatywa: accessor zwraca `undefined` +
   `sortUndefined: 'last'`, a `cell` renderuje `0 zł` lub „brak danych".
4. **Serwer czy klient dla filtra** (§6) — i jeśli URL, to czy wyciągamy wspólny
   `use-url-filter-params` z `transfer-filters.tsx:72-84`, czy kopiujemy zamknięcie do floty.
5. **Semantyka jednego krańca** — transfery akceptują sam `from` albo sam `to`; `parseDateRange`
   wymaga obu. Do wyboru jedna, świadomie.
6. **Czy potrzebna jest suma zbiorcza w stopce** (slot `footer` już istnieje) — kontrapunkt z
   `summary-panel-filter-blind` sugeruje, że to może być właściwsza forma filtrowanej liczby.
