# Wpłaty — jedno źródło zamiast dwóch — Plan Brief

> Full plan: `context/changes/2026-08-12-wplaty-jedno-zrodlo/plan.md`
> Research: `context/changes/2026-08-12-wplaty-jedno-zrodlo/research.md`

## What & Why

Figura „wpłaty" dla jednej inwestycji ma dwie ścieżki wyliczenia o różnym zestawie typów, a jeden
prop (`wplatyNet`) jest karmiony z obu na trzech wejściach do tego samego komponentu. Zamiast
wybierać zwycięzcę, usuwamy prop z kontraktu: wartość wyprowadza się z listy wpłat, którą komponent
i tak dostaje. Przy okazji domykamy realny defekt — podgląd klienta renderuje dziś total bez listy.

## Starting Point

`kosztorys_v2/page.tsx` i `investment-summary-panel.tsx` liczą `sumDepositAmounts(depositTransactions)`
i przekazują obok **tę samą listę**. `preview-kosztorys.ts` bierze total z `financials.totalIncome`
i listy nie podaje wcale — `kosztorys-editor-body.tsx:60` defaultuje ją do `[]`. Na obu stronach
`(share)` daje to pustą listę wpłat, a w trybie mieszanym `paidNet = paidGross = 0`, więc
„Do zapłaty" jest zawyżone o całą kwotę wpłat.

## Desired End State

Podgląd i share renderują listę wpłat oraz poprawny split VAT — identycznie jak strona właściciela.
`wplatyNet` nie istnieje jako prop; `depositsNet` jest lokalną wartością wyprowadzoną raz, tam gdzie
lista jest już zbucketowana. `depositTransactions` jest wymagane w kontrakcie, więc pominięcie go
przez przyszłe czwarte wejście jest błędem kompilacji, nie cichą pustą listą.

## Key Decisions Made

| Decyzja                    | Wybór                                           | Dlaczego                                                                                | Źródło   |
| -------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Definicja `totalIncome`    | Zostaje bez zmian (bucket `income`)             | `/raporty` liczy tym firmowe wpłaty poza inwestycjami — zmiana bucketu wycięłaby je     | Research |
| Share pokazuje listę wpłat | Tak — podgląd dociąga `depositTransactions`     | Rozstrzygnięcie właściciela; usuwa pustą listę i zerowy split w trybie mieszanym        | Research |
| Kształt guardu             | Niezmiennik na `investment_id`, nie równość sum | Po ujednoliceniu asercja równości byłaby tautologią — pilnowałaby własnej implementacji | Research |
| Kontrakt figury            | Usunąć prop, wyprowadzać z listy                | Rozjazd staje się niereprezentowalny; prop był już redundantny na 2 z 3 wejść           | Plan     |
| Warstwa guardu             | Test DB na zapisanym wierszu (`payload.create`) | Predykat i hook są już zapięte; nikt nie sprawdza stanu persystowanego                  | Plan     |
| Rename `wplatyNet`         | `depositsNet`, w tej zmianie                    | Łamie regułę 3 z AGENTS.md; po usunięciu propa zostaje ~5 wystąpień — tanio teraz       | Plan     |

## Scope

**In scope:** podgląd dociąga listę wpłat · usunięcie `wplatyNet` z `KosztorysEditorDataT` i propsów ·
`depositTransactions` wymagane · rename na `depositsNet` · poprawa czterech nieprawdziwych
komentarzy · test DB na niezmiennik.

**Out of scope:** `financialBucket` obu typów · pozostali konsumenci `totalIncome` (listing, bilans,
`map-category-costs`) · zakres listy wpłat (`INVESTOR_DEPOSIT` only) · backfill anulowanych wierszy ·
E2E · rename `sumDepositAmounts` i sąsiadów.

## Architecture / Approach

Dziś: `total` i `lista` to dwa zapytania, które komponent dostaje osobno i musi wierzyć, że się
zgadzają. Po zmianie: jedna lista wchodzi do komponentu, total wypada z niej lokalnie
(`paidNet + paidGross` z już liczonego `bucketDepositsByPlane`). Trzy wejścia dostarczają wtedy
dokładnie to samo, bo dostarczają tylko jedną rzecz.

## Phases at a Glance

| Faza                            | Co dowozi                                                | Główne ryzyko                                                   |
| ------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Podgląd dociąga listę        | Naprawa defektu na `(share)` — bez zmian w typach        | Cache podglądu — fetcher jest już pod `CACHE_TAGS.transfers`    |
| 2. Zwinięcie kontraktu + rename | `wplatyNet` znika z kodu; `depositTransactions` wymagane | Rename dotyka 6 plików; łatwo przeoczyć wystąpienie w testach   |
| 3. Guard na niezmiennik         | Test DB na zapisanym wierszu                             | Test przechodzący trywialnie — stąd kontrolna asercja pozytywna |

**Prerequisites:** EX-557 wmergowany (dostarcza niezmiennik, na którym stoi równość).
**Estimated effort:** jedna sesja, ~6 plików produkcyjnych + 3 testowe.

## Open Risks & Assumptions

- Zakładam tożsamość `paidNet + paidGross === sumDepositAmounts(list)` — wynika z definicji
  `bucketDepositsByPlane` (`paidNet = total − taggedGross`), ale to jedyne miejsce, gdzie zmiana
  jest wnioskiem, a nie przepisaniem.
- Faza 2 czyni `depositTransactions` wymaganym — jeśli istnieje wejście, którego nie znalazłem,
  wyjdzie to jako błąd typów, nie jako cichy regres.

## Success Criteria (Summary)

- Trzy powierzchnie pokazują tę samą kwotę wpłat dla tej samej inwestycji.
- Na share w trybie mieszanym wpłaty netto/brutto są niezerowe i sumują się do totalu.
- `grep -rn "wplatyNet" src` nic nie zwraca; `pnpm test:parity` bez ruchu.
