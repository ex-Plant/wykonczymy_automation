---
change_id: fleet-costs-column
title: Kolumna poniesionych kosztów na liście floty + filtr daty
status: implemented
created: 2026-08-24
updated: 2026-08-24
archived_at: null
branch: fleet-costs-column
worktree: null
---

## Notes

Tabela `/flota` dostaje kolumnę z sumą poniesionych kosztów na pojazd. Lista dostaje filtr
zakresu dat, rozwiązany analogicznie do `/transfery`; kolumna kosztów respektuje ten zakres.

Ustalenia właściciela (2026-08-24):

- **Okres** — nie stały (ani „całe życie", ani krocząca dwunastka). Kolumna liczy to, co mieści
  się w wybranym zakresie dat, a zakres wybiera filtr — jak na transferach.
- **Rozbicie po typach** zostaje na karcie pojazdu (`summariseCosts().byType`); w tabeli sama suma.
- **Pojazd bez wycenionych przeglądów** pokazuje `0 zł`.

### Rozstrzygnięte: „Koszt" staje się polem wymaganym

Dziś `cost` jest opcjonalny na wszystkich trzech warstwach — kolekcja
(`src/collections/vehicle-inspections.ts:90`, brak `required`), formularz
(`inspection-schema.ts:13`, `z.string()` bez `.min(1)`) i domena (`:28`, `z.number().optional()`),
stąd `cost: number | null` w `src/lib/fleet/types.ts:31`. Więc przegląd bez kwoty jest zapisywalny
i istnieje w bazie.

Bez domknięcia źródła `0 zł` w kolumnie sklejałoby dwa różne stany — „przegląd kosztował zero"
i „nikt nie wpisał faktury". **Decyzja: pole staje się wymagane** (`required` + migracja `NOT NULL`
z backfillem do `0`). Wtedy „pojazd bez wycenionego przeglądu" przestaje istnieć — zostaje tylko
„pojazd bez żadnego przeglądu", dla którego `0 zł` jest prawdą dosłowną.

### Pozostałe rozstrzygnięcia (2026-08-24)

- **Karta i lista liczą jedną regułą** — celowa dziś rozbieżność `summariseCosts` (pomijanie wpisów
  bez ceny) znika razem z możliwością zapisania przeglądu bez kwoty.
- **Filtr trzyma stan w URL**, filtrowanie na serwerze; pasek pełny jak w transferach
  (Rok · Miesiąc · Od · Do · „Wyczyść daty"); przedział **półotwarty** — sam jeden kraniec działa.
- **Stopka pokazuje sumę zbiorczą** całej floty w wybranym zakresie.

### Punkt wyjścia w kodzie

- `loadFleetDataset` (`src/lib/fleet/dataset.ts`) już wciąga `cost` razem z przeglądami — kolumna
  nie potrzebuje nowego zapytania.
- `summariseCosts` (`src/lib/fleet/costs.ts`) liczy już sumę i rozbicie dla karty pojazdu; celowo
  pomija typ bez wpisanej ceny, więc jego reguła i reguła kolumny będą się różnić — świadomie.
- Kolumny listy: `src/components/tables/fleet.tsx`.
