---
change_id: ex-555-write-switch-labor-rabat
title: Robocizna + rabat z kosztorysu na liście inwestycji; LABOR_COST i RABAT znikają z formularza
status: implemented
created: 2026-08-12
updated: 2026-08-12
archived_at: null
branch: konradantonik/ex-672-remove-print-csv-export
worktree: null
---

## Notes

EX-555, rozszerzone 2026-08-12 z samego rabatu na cały write-switch (`RABAT` + `LABOR_COST`).
Blokada EX-535 zdjęta (Done), EX-539 rozpuszczone (Done 2026-07-21).

**Gałąź** — implementacja ląduje na `konradantonik/ex-672-remove-print-csv-export` (decyzja właściciela,
2026-08-12): drzewo robocze jest współdzielone z równoległymi agentami, więc `checkout -b` przeniósłby
ich niezacommitowaną robotę na nową gałąź. Commity EX-555 są rozdzielne co do ścieżek.

### Problem

Read-switch istnieje, ale tylko na jednej płaszczyźnie:

- **Podsumowanie v2** (`investment-summary-panel.tsx:62-66`) — `readingFromKosztorys(clientTotals)`
  z fallbackiem `rows.length === 0 → readingFromTransactions`. Robocizna i rabat z kosztorysu.
- **Lista inwestycji** (`shape-investments.ts`) — w całości `fetchInvestmentFinancials()`, jedno
  `GROUP BY` po `transactions`. Kosztorys nietykany.

Ta sama inwestycja pokazuje inny bilans na liście niż w swoim Podsumowaniu. Robocizna wchodzi na
liście w cztery kolumny: Koszty inwestora, Bilans netto, Bilans brutto, Marża.

### Decyzje właściciela (2026-08-12)

1. **Oba typy w jednej zmianie.** Koszt krańcowy robocizny jest zerowy —
   `clientTotalsFromSubtotals` zwraca `sumaPracNet` i `rabatClientNet` z jednego przebiegu. Sam
   rabat dałby bilans będący hybrydą dwóch płaszczyzn, dalej niezgodny z Podsumowaniem.
2. **Stare transakcje zostają jako legacy.** Enum, wiersze, historia — nietknięte. Zero backfillu.
   Legacy dalej renderuje się w tabeli transferów, daje się anulować, jedzie do arkusza.
3. **Chowamy wyłącznie z formularza.** Mechanizm już istnieje:
   `TRANSACTION_TRANSFER_TYPES` (`constants/transfers.ts:274`) to lista „widoczne w oknie
   transakcji", odrębna od enuma Payloada, etykiet, kolorów i list arkuszowych.
4. **Materializacja (opcja C).** Przy zapisie kosztorysu liczymy parę figur istniejącą funkcją
   `clientTotalsFromSubtotals` i zapisujemy jako kolumny; lista czyta skalary.
   - **Nie A** (drzewa na liście): dziś 3 491 wierszy / 12 inwestycji, docelowo ~30 tys. na wejście.
   - **Nie B** (formuła w SQL): `sectionSubtotalsForView` to nie gołe `SUM` — `rowTotalQtyDone` po
     etapach filtrowanych widokiem, `netForQtyForView`, `rowDiscountForView`, zaokrąglenia do
     groszy. Druga kopia = rozjazd „two-planes-both-green" z `lessons.md`.
5. ~~**Fallback jak w panelu:** brak wierszy kosztorysu → transakcje.~~ **ODWOŁANE przez
   właściciela 2026-08-12**, po zobaczeniu inwestycji 31 (pusty kosztorys, a v2 pokazywało
   235 911 zł z transakcji). Obowiązuje: **jest jedno właściwe źródło i żadna liczba go nie
   deklaruje**. Kosztorys pusty → **0 zł**. 84 z 96 inwestycji faktycznie spadają na liście do
   zera i tak ma być — ta luka to lista roboty do wprowadzenia, nie defekt. **Zero backfillu.**
6. **v1 to wybór źródła, nie legacy-do-wygaszenia.** v1 czyta płaszczyznę transakcji i po to
   istnieje — tam widać starą robociznę, dopóki ktoś nie wprowadzi jej do kosztorysu.

### Decyzje po researchu (2026-08-12)

7. **Marża w v2 też z kosztorysu.** `summary-margin-tab.tsx:31` czyta dziś `totalLaborCosts` /
   `totalRabat` wprost z `financials`. Dostaje parę z `SummaryReadingT`, którą panel już liczy
   (`investment-summary-panel.tsx:62-66`) i której zakładce nie podaje.
8. **Szew w `shapeInvestments`, nie w `deriveFinancials`.** v1 zostaje legacy czytającym
   transakcje (decyzja 6); szew w fabryce figur przepiąłby go razem z resztą.
9. **Agregat w SQL (opcja B), nie materializacja (C) ani odczyt batchowy (D).** Materializacja ma
   w repo anty-precedens (`20260222_drop_materialized_columns.ts`) i brak chokepointu na zapisie
   (5 surowych SQL omija hooki, panel Payloada omija akcje). Odczyt batchowy odpadł po pomiarze
   (2026-08-12, syntetyk 1000 inwestycji × 300 pozycji × 3 etapy): przy 200 inwestycjach to
   240 tys. wierszy / **10 MB** na każde wygaśnięcie cache, przy 1000 — 1,2 mln wierszy / **49 MB**
   i ~200 MB sterty, żeby policzyć dwie liczby na inwestycję. Agregat zwraca po jednym wierszu na
   inwestycję (536 ms vs 915 ms przy 1000 na loopbacku, a różnica na Neonie jest większa, bo tam
   transfer nie jest darmowy). Research odrzucił B mierząc ją całym `sectionSubtotalsForView` —
   dla tych dwóch figur ścieżka nie filtruje etapów i nie zaokrągla, więc to `SUM` plus jeden
   trzygałęziowy `CASE`. Koszt: formuła istnieje w dwóch językach — pilnuje tego test parytetu
   SQL↔TS na bazie.
10. **Alert uzgodnienia zostaje** — służy weryfikacji starych inwestycji przed wyłączeniem v1.
    Wycisza się **per inwestycja**, gdy Σ `LABOR_COST` = 0 **i** Σ `RABAT` = 0 (brak drugiej
    miary ≠ niezgodność). Nie per figura — inaczej „robocizna zaksięgowana, rabat nie" zamilkłby,
    a to jest luka, którą `showRabat` (`settlement-summary.tsx:81-83`) świadomie łapie.
11. **Trzy furtki write-switcha:** panel Payloada i `z.enum(TRANSFER_TYPES)` w akcjach —
    zapisane jako zaakceptowane (wzorem EX-557 pkt 6). Draft w sessionStorage
    (`expense-form.tsx:124-126`) — **naprawiamy**, jako jedyny trafiający w zwykłego użytkownika.

12. **Wpłaty — zero zmian, zweryfikowane na produkcji.** Zbiory formalnie się różnią
    (lista: bucket `'income'` = `INVESTOR_DEPOSIT` + `COMPANY_FUNDING` + `OTHER_DEPOSIT`; panel:
    twardy `type = 'INVESTOR_DEPOSIT'`, `sum-transfers.ts:319`), ale na żywych danych są
    **tożsame**: `COMPANY_FUNDING` nigdy nie ma inwestycji (0 wierszy), a wszystkie cztery
    `OTHER_DEPOSIT` z inwestycją są anulowane. Ani filtra nie rozszerzamy, ani bucketu nie
    zwężamy — nie ma czego naprawiać.

### Potwierdzone algebrą (2026-08-12)

Bilans z listy = „Do zapłaty" z v2 co do znaku, na obu planach, także w trybie mieszanym
(`paidNet + paidGross` = wszystkie wpłaty, `summary-economics.ts:252-253`). Zbiór wpłat po obu
stronach jest ten sam (decyzja 12), więc algebra domyka się bez zastrzeżeń.

### Znalezione przy okazji, poza zakresem tej zmiany

- **Dziesięć korekt bez kategorii** na produkcji (Σ −2 087,70 zł, inwestycje 38, 22, 26, 31, 81,
  59; id 2207–2211, 2427, 2580, 2589, 2774, 2778). Totale są poprawne — `uncategorisedRemainder`
  (`map-category-costs.ts:27-30`) liczy je jako resztę, więc wchodzą do „Materiałów" tak samo jak
  skategoryzowane. Zmienia się tylko etykieta wiersza. Naprawa danych po stronie właściciela;
  wiersz „Korekta (bez kategorii)" znika sam, bo jest pod `if (uncategorised !== 0)`. **Kodu nie
  usuwamy** — to zawór pilnujący niezmiennika Σ wierszy === total materiałów.
- **Rabaty zapisane nie tym typem**: 2774 („rabat", korekta) i anulowane już 1196 („rabat",
  Inna wpłata). Po tej zmianie rabat z kosztorysu wchodzi do marży i bilansu, więc rabat siedzący
  w danych pod przebraniem korekty jest kandydatem na podwójne liczenie.
- **Lokalna baza była nieaktualna** względem `dumps/dump-latest.sql` — `pnpm db:import` przed
  implementacją, inaczej testujemy na obrazie sprzed anulowań.

### Konsekwencja przyjęta świadomie

Marża i bilans zaczynają reagować na rabat z kosztorysu. To jest połączenie kosztorys↔marża
odkładane od 2026-07-16; tutaj robimy je celowo. `calculate-margin.ts` i `calculate-balance.ts`
czytają te same dwa pola `InvestmentFinancialsT`, więc rozdzielenie bilansu od marży wymagałoby
dodatkowej, niechcianej roboty.

### Skala legacy (lokalna kopia prod, 2026-08-12)

|                                |                                                 |
| ------------------------------ | ----------------------------------------------- |
| `LABOR_COST`                   | 78 wierszy, Σ 3 312 680,30 zł                   |
| `RABAT`                        | 11 wierszy, Σ 106 622,69 zł                     |
| inwestycje z tymi transakcjami | 60 z 96                                         |
| z nich z wierszami kosztorysu  | 7 (w tym inwestycja 7 = seed perf 1000 wierszy) |

### Uwagi na start

- **Kolizja z EX-557** (`2026-08-12-ex-557-legacy-deposit-types`, w toku) — ta sama rodzina list
  typów w `constants/transfers.ts`. Skoordynować.
- **Przestroga z EX-557:** zdjęcie typu z jednej listy UI nie wystarczyło — okno **edycji**
  (`edit-transfer-form.tsx`) i panel Payload (`collections/transfers.ts`) miały własne ścieżki.
  Sprawdzić wszystkie powierzchnie wyboru typu, nie tylko okno dodawania.
- **Sheets slots są position-frozen** — `LABOR_COST` trzyma slot 2 w `TRANSFERS_SUMMARY_TYPES`;
  zostawić jako 0-placeholder, nie kasować.
