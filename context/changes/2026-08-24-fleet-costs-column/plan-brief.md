# Plan Brief: Kolumna kosztów na liście floty + filtr dat

**Change:** `fleet-costs-column` · **Pełny plan:** `plan.md` · **Research:** `research.md`

## Co robimy

Tabela `/flota` dostaje kolumnę „Koszty" (suma na pojazd) i wiersz sumy zbiorczej w stopce.
Lista dostaje filtr zakresu dat w URL (`?from=&to=`), zbudowany jak filtr transferów; obie liczby
liczą wyłącznie to, co mieści się w zakresie. Żeby `0 zł` znaczyło „kosztowało zero", a nie
„nikt nie wpisał", pole „Koszt" na przeglądzie staje się **wymagane**.

## Decyzje właściciela (2026-08-24)

| Pytanie                           | Rozstrzygnięcie                                          |
| --------------------------------- | -------------------------------------------------------- |
| `cost` wymagany?                  | **Tak** — `required` + migracja `NOT NULL`               |
| Pojazd bez wycenionych przeglądów | **`0 zł`**, sortuje się jak zero                         |
| Karta vs lista                    | **Jedna reguła** — obie liczą tak samo                   |
| Stan filtra                       | **W URL**, filtrowanie na serwerze                       |
| Pasek filtra                      | **Pełny**: Rok · Miesiąc · Od · Do · „Wyczyść daty"      |
| Jeden kraniec zakresu             | **Przedział półotwarty** — sam „Od" albo sam „Do" działa |
| Suma zbiorcza w stopce            | **Tak**                                                  |

## Fazy

1. **Domknięcie źródła** — `cost` wymagany w kolekcji, obu schematach i `toData`; migracja
   (backfill `0` → `SET NOT NULL`); `cost: number` w typach; **bump klucza cache'a na `-v3`**.
2. **Jedna reguła kosztów** — martwy filtr `cost !== null` znika z `summariseCosts`; nowa
   `sumCosts(entries, range)` obsługuje kartę i listę; test i manual check EX-711 przepisane.
3. **Kolumna + stopka** — `totalCosts` na `FleetRowT`, kolumna wyrównana do prawej z `formatPLN`,
   suma zbiorcza przez istniejący slot `footer` w `DataTable`.
4. **Filtr dat** — wspólny hook `useUrlFilterParams`, `DateFilters` przeniesione do
   `components/filters/` i sparametryzowane, `/flota` czyta `searchParams`,
   `fetchFleetOverview(costRange)` bez wartości domyślnej.

## Trzy rzeczy, które łatwo przeoczyć

1. **Klucz cache'a MUSI pójść na `-v3`.** `InspectionRecordT.cost` zwęża się do `number`, a ten typ
   jedzie w payloadzie `unstable_cache` — stary wpis nadal niesie `null` i tag go nie uratuje
   (poda stary payload raz jeszcze, dopiero potem rewaliduje).
2. **Zakres dat NIE zawęża tablicy `events`** — tylko sumowanie kosztów. `deadlines`, `activeFlags`,
   `latestOdometer` i `kmSinceOilChange` czytają historię bez okna.
3. **Kolejność deploya jest odwrotna.** `SET NOT NULL` łamie stary kod → **push, potem migracja**
   (człowiek, `pnpm db:migrate:prod`). Sprawdzić najpierw, czy `vehicle_inspections` w ogóle jest na
   prodzie — migracja EX-711 wciąż jest należna.

## Poza zakresem

Most flota↔transakcje · rozbicie po typach w tabeli · paginacja · `loadFleetDataset` i cron ·
`getFilteredRowModel` · spec Playwrighta (dopisujemy ścieżkę do **EX-716**, `e2e-backlog`).
