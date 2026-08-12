# Wpłaty — jedno źródło zamiast dwóch: plan implementacji

## Overview

Figura „wpłaty" przestaje istnieć jako osobny prop. Zamiast wybierać zwycięzcę między dwiema
ścieżkami wyliczenia (`financials.totalIncome` vs Σ listy `INVESTOR_DEPOSIT`), usuwamy **drugie
źródło z kontraktu**: `wplatyNet` wypada z `KosztorysEditorDataT` i z propsów panelu, a
`summary-panel-content.tsx` wyprowadza tę liczbę z listy wpłat, którą już dostaje i już bucketuje.
Rozjazd staje się niereprezentowalny, a nie tylko naprawiony.

Przy okazji domykamy realny defekt produkcyjny: podgląd/share renderuje dziś total bez listy.

## Current State Analysis

Jeden prop `wplatyNet` jest karmiony z dwóch źródeł na trzech wejściach do tego samego komponentu:

| Wejście                           | `wplatyNet`                              | `depositTransactions` |
| --------------------------------- | ---------------------------------------- | --------------------- |
| `kosztorys_v2/page.tsx:77`        | `sumDepositAmounts(depositTransactions)` | podane                |
| `investment-summary-panel.tsx:64` | `sumDepositAmounts(depositTransactions)` | podane                |
| `preview-kosztorys.ts:62`         | `financials.totalIncome`                 | **brak**              |

Skutki na `(share)/k/[token]` i `(share)/podglad-klienta/[id]`: `kosztorys-editor-body.tsx:60`
defaultuje listę do `[]`, więc lista wpłat jest pusta mimo niezerowego totalu, a
`bucketDepositsByPlane([])` (`summary-economics.ts:246-257`) daje `paidNet = paidGross = 0`.
W **trybie mieszanym** `buildSettlementGroups` (`settlement-groups.ts:76,103`) odejmuje wtedy
`−0,00 zł` w obu torach i „Do zapłaty" wychodzi zawyżone o całą kwotę wpłat. Tryb jedzie na drzewie
(`types.ts:127`), więc share renderuje ten, który ustawił właściciel — mieszany jest osiągalny.

Na dwóch pozostałych wejściach `wplatyNet` jest **redundantny**: obie strony liczą go z listy, którą
przekazują obok. A `summary-panel-content.tsx:197` dwie linijki nad użyciem `wplatyNet` robi już
`bucketDepositsByPlane(depositTransactions)`, którego `paidNet + paidGross` jest dokładnie tą sumą.

### Key Discoveries:

- **Cztery komentarze opisują zgodność, której nie ma**: `preview-kosztorys.ts:36` („Mirrors the
  admin page's fetches"), `types.ts:141-143` („those three can't drift"),
  `summary-panel-content.tsx:53-55` („required on every host" o propie opcjonalnym w typie),
  `investment-transactions.ts:54-55` („the unauthenticated share read reaches this fetcher" — nie
  sięga).
- **Fetcher jest gotowy**: `fetchDepositTransactionsForInvestment` (`investment-transactions.ts:56`)
  jest już cache'owany pod `CACHE_TAGS.transfers`, który `preview-kosztorys.ts:28` i tak trzyma
  w `KOSZTORYS_TAGS`. Koszt fazy 1 to jedno zapytanie w istniejącym `Promise.all`.
- **Nagłówek istniejącego testu DB przewidział ten defekt**:
  `get-deposit-transactions.test.ts:8-12` ostrzega, że „a revert to the plane-blind `totalIncome`
  would silently fold them back in". Podgląd robi dokładnie to.
- **Guard na predykacie już istnieje**: `transfer-constants.test.ts` pinuje `showsInvestment.falseFor`
  dla obu typów, a `investment-write-guard.test.ts` (EX-557) pokrywa hook. Oba sprawdzają
  **funkcję** — żaden nie sprawdza **zapisanego wiersza**.
- **`wplatyNet` łamie regułę 3 z AGENTS.md** (polski rdzeń + angielski afiks). 12 wystąpień
  w kodzie produkcyjnym; deklaracja typu tylko w `types.ts:157` — shell `KosztorysEditorV2`
  przepuszcza prop spreadem, więc rename nie rozlewa się szerzej.
- **`totalIncome` zostaje tam, gdzie jest**: `raporty/page.tsx:44` woła `deriveFinancials` na
  wierszach nieprzypiętych do inwestycji, gdzie oba typy są poprawnymi wpłatami firmowymi.

## Desired End State

- Podgląd klienta i share renderują listę wpłat oraz poprawny split `paidNet`/`paidGross`
  w trybie mieszanym — identycznie jak strona właściciela.
- `wplatyNet` nie istnieje jako prop na żadnym poziomie; `depositsNet` jest lokalną wartością
  wyprowadzoną z `depositTransactions` w jednym miejscu.
- `depositTransactions` jest w `KosztorysEditorDataT` **wymagane** — pominięcie go przez czwarte
  wejście jest błędem kompilacji, nie cichą pustą listą.
- Test DB pada, jeśli zapis `COMPANY_FUNDING`/`OTHER_DEPOSIT` z inwestycją przez Payload
  wyląduje w tabeli z niepustym `investment_id`.

Weryfikacja: `pnpm typecheck` + `pnpm test` + `pnpm test:integration` zielone, a `grep -rn wplatyNet src`
nic nie zwraca.

## What We're NOT Doing

- **Nie ruszamy `financialBucket`** obu typów — zostaje `'income'` (patrz `/raporty` wyżej).
- **Nie ruszamy pozostałych konsumentów `totalIncome`** (listing, bilans, `map-category-costs`) —
  to plan transakcyjny całej inwestycji, poprawnie liczony.
- **Nie zmieniamy zakresu listy wpłat** — `INVESTOR_DEPOSIT` only, zgodnie z
  `investment-transactions.ts:70-72`.
- **Nie backfillujemy** trzech anulowanych wierszy z `investment_id` (EX-557 rozstrzygnął).
- **Nie piszemy E2E** — obowiązek rozstrzyga review gate.
- **Nie renamujemy** `sumDepositAmounts` ani sąsiednich nazw w `summary-economics` — poza zakresem.

## Implementation Approach

Trzy fazy w kolejności rosnącego ryzyka, każda samodzielnie zielona. Faza 1 naprawia defekt
produkcyjny **bez** dotykania kontraktu typów, więc ma wartość nawet gdyby prace się urwały. Faza 2
zwija kontrakt — dopiero tu `depositTransactions` staje się wymagane, co jest możliwe wyłącznie
dlatego, że faza 1 dostarczyła je ostatniemu wejściu. Faza 3 dokłada guard na przyczynę.

## Phase 1: Podgląd dociąga listę wpłat

### Overview

`preview-kosztorys.ts` przestaje być jedynym wejściem bez `depositTransactions`. Naprawia pustą
listę wpłat i zerowy split VAT w trybie mieszanym na obu stronach `(share)`.

### Changes Required:

#### 1. Preview query

**File**: `src/lib/queries/preview-kosztorys.ts`

**Intent**: Dołożyć `fetchDepositTransactionsForInvestment(investmentId)` do istniejącego
`Promise.all` i zwrócić wynik jako `depositTransactions`. `wplatyNet` na razie zostaje bez zmian —
znika dopiero w fazie 2, gdzie wypada z kontraktu.

**Contract**: `buildPreviewKosztorysEditorData` zwraca dodatkowe pole `depositTransactions:
DepositTransactionRowT[]`. Import z `@/lib/queries/investment-transactions` (już importowany
w tym pliku dla `fetchMaterialTransactionsForInvestment`). Cache bez zmian — fetcher jest już pod
`CACHE_TAGS.transfers`, który `KOSZTORYS_TAGS` trzyma.

#### 2. Komentarz w fetcherze

**File**: `src/lib/queries/investment-transactions.ts`

**Intent**: Komentarz w liniach 54-55 twierdzi, że share sięga tego fetchera — od tej fazy to jest
prawda. Zweryfikować sformułowanie i zostawić, jeśli trzyma; poprawić, jeśli nie.

**Contract**: Zmiana wyłącznie w komentarzu.

### Success Criteria:

#### Automated Verification:

- Spec podglądu przechodzi, jeśli istnieje; w przeciwnym razie: `pnpm exec vitest run src/__tests__/lib/queries` zielone
- `pnpm exec tsc --noEmit -p tsconfig.json` na zmienionych plikach nie zgłasza braku pola

#### Manual Verification:

- Na `/inwestycje/<id>/podglad-klienta` lista wpłat pokazuje te same wiersze co strona właściciela
- Po przełączeniu inwestycji w tryb mieszany „Wpłaty netto"/„Wpłaty brutto" na share pokazują
  niezerowe kwoty i sumują się do totalu z wiersza „Wpłaty"
- Link „do wpłat" na share prowadzi do niepustej listy

---

## Phase 2: Zwinięcie kontraktu + rename

### Overview

`wplatyNet` wypada z kontraktu na wszystkich poziomach; wartość wyprowadza się raz, w miejscu gdzie
lista już jest zbucketowana. Przy okazji rename na angielski identyfikator i poprawa czterech
komentarzy opisujących nieistniejącą zgodność.

### Changes Required:

#### 1. Kontrakt danych edytora

**File**: `src/lib/kosztorys/types.ts`

**Intent**: Usunąć `wplatyNet` z `KosztorysEditorDataT`; uczynić `depositTransactions` wymaganym.
Poprawić komentarz przy typie (linie 141-143), który twierdzi, że trzy wejścia nie mogą się
rozjechać — teraz to jest egzekwowane przez typ, a nie deklarowane w prozie.

**Contract**: `wplatyNet: number` znika; `depositTransactions?: DepositTransactionRowT[]` →
`depositTransactions: DepositTransactionRowT[]`.

#### 2. Panel — wyprowadzenie wartości

**File**: `src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: Usunąć `wplatyNet` z `PropsT` i z destrukturyzacji; wyprowadzić `depositsNet` z wyniku
`bucketDepositsByPlane`, który jest już liczony linijkę wyżej. Poprawić komentarz przy
`depositTransactions` (linie 53-55) — „required on every host" staje się prawdą typu.

**Contract**: `depositsNet = paidNet + paidGross`, tuż pod istniejącym `bucketDepositsByPlane`.
Ta tożsamość wynika z definicji funkcji (`paidNet = total − taggedGross`, `paidGross = taggedGross`),
więc nie potrzeba osobnego przebiegu po liście.

#### 3. Rename w dół drzewa

**File**: `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx`,
`src/components/kosztorys/summary/settlement-groups.ts`, `src/lib/kosztorys/summary-economics.ts`

**Intent**: `wplatyNet` → `depositsNet` w propsach zakładki, w `ArgsT` builda grup rozliczeniowych
i w parametrze `computeDoZaplatyRM`. Etykiety UI („Wpłaty", „Wpłaty netto", „Wpłaty brutto")
zostają po polsku — to warstwa widoku.

**Contract**: `computeDoZaplatyRM(laborCostsNet, depositsNet, materials, vatRate, materialsNetRate)`
— pozycja parametru bez zmian, tylko nazwa.

#### 4. Wejścia przestają liczyć własną sumę

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`,
`src/components/investments/investment-summary-panel.tsx`,
`src/lib/queries/preview-kosztorys.ts`

**Intent**: Usunąć lokalne `const wplatyNet = sumDepositAmounts(...)` i prop `wplatyNet={...}` z obu
stron właściciela; usunąć `wplatyNet: financials.totalIncome` z podglądu wraz z komentarzem
„Mirrors the admin page's fetches", który po fazie 1 opisuje już rzeczywisty stan i nie musi tego
obiecywać. Sprawdzić, czy `sumDepositAmounts` ma jeszcze konsumentów — jeśli nie, usunąć ją.

**Contract**: Po tej zmianie żaden host nie przekazuje totalu wpłat; przekazuje wyłącznie listę.

#### 5. Default listy w body

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Usunąć `depositTransactions = []` — po zmianie kontraktu default maskowałby brakujące
dane zamiast wywołać błąd kompilacji.

**Contract**: `depositTransactions` przechodzi bez wartości domyślnej.

#### 6. Testy

**File**: `src/__tests__/components/kosztorys/summary/settlement-groups.test.ts`,
`src/__tests__/lib/kosztorys/summary-economics.test.ts`

**Intent**: Przepisać nazwę pola/zmiennej na `depositsNet`. Asercje bez zmian — to rename, nie zmiana
zachowania.

**Contract**: Wartości i oczekiwania identyczne.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/summary/settlement-groups.test.ts` zielone
- `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts` zielone
- `grep -rn "wplatyNet" src e2e` nic nie zwraca

#### Manual Verification:

- Podsumowanie inwestycji, kosztorys v2 i podgląd klienta pokazują tę samą kwotę wpłat dla tej samej
  inwestycji
- „Do zapłaty" nie zmieniło się na żadnej z trzech powierzchni względem stanu sprzed zmiany
  (dla inwestycji, gdzie podgląd i strona właściciela zgadzały się już wcześniej)

---

## Phase 3: Guard na niezmiennik

### Overview

Równość obu planów opiera się na tym, że żaden aktywny wiersz wpłaty inny niż `INVESTOR_DEPOSIT` nie
ma `investment_id`. EX-557 to egzekwuje przy zapisie, ale żaden test nie sprawdza **zapisanego
wiersza** — istniejące pinują predykat i wynik funkcji hooka.

### Changes Required:

#### 1. Test niezmiennika na planie danych

**File**: `src/__tests__/lib/db/deposit-investment-invariant.test.ts` (nowy)

**Intent**: Utworzyć `COMPANY_FUNDING` i `OTHER_DEPOSIT` **przez Payload** (żeby `validate.ts` był
w pętli), podając `investment`, i sprawdzić, że w tabeli `transactions` wylądował `investment_id`
NULL. Dodatkowo sprawdzić, że `getDepositTransactionsForInvestment` ich nie zwraca — czyli że total
wyprowadzony z listy nie może ich objąć.

**Contract**: Kształt jak `get-deposit-transactions.test.ts` — `describe.skipIf(!ENV_READY)`,
`createTestInvestment`/`deleteTestInvestment`, sprzątanie w `afterAll` po `investment_id`.
Kluczowa różnica wobec sąsiada: ten test **nie** wstawia wierszy surowym SQL-em — cały jego sens to
przejście przez ścieżkę zapisu, więc `payload.create` jest tu obowiązkowy.

Kontrolna asercja pozytywna: `INVESTOR_DEPOSIT` utworzony tą samą drogą **zachowuje**
`investment_id`. Bez niej test przeszedłby też wtedy, gdyby zapis inwestycji był zepsuty dla
wszystkich typów.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/db/deposit-investment-invariant.test.ts` zielone
- Test faktycznie pada po tymczasowym dopisaniu `'COMPANY_FUNDING'` z powrotem do `INVESTMENT_TYPES`
  (weryfikacja, że guard ma zęby — zmianę cofnąć)

#### Manual Verification:

- Brak — faza wyłącznie testowa

---

## Testing Strategy

### Unit Tests:

Rename w `settlement-groups.test.ts` i `summary-economics.test.ts` — bez zmian w asercjach. Nowych
testów jednostkowych nie piszemy: predykat jest już zapięty w `transfer-constants.test.ts`, a hook
w `investment-write-guard.test.ts` (EX-557).

### Integration Tests:

Nowy spec DB z fazy 3, dołącza do puli `scripts/test-integration.sh` (mirroring ścieżki
`src/lib/db/**` → `src/__tests__/lib/db/**`).

### Manual Testing Steps:

1. Otworzyć `/inwestycje/<id>/podglad-klienta` dla inwestycji z wpłatami — lista wpłat niepusta.
2. Przełączyć tę inwestycję w tryb mieszany; na share „Wpłaty netto" + „Wpłaty brutto" sumują się
   do totalu i „Do zapłaty" spada.
3. Porównać kwotę wpłat na trzech powierzchniach: Podsumowanie inwestycji, kosztorys v2, podgląd.
4. Wejść na `/raporty` i potwierdzić, że wpłaty firmowe nie zmieniły się (kontrola, że nie tknęliśmy
   bucketu).

## Migration Notes

Brak — zmiana nie dotyka schematu ani danych.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:integration`
- `pnpm test:parity` (golden master nie powinien drgnąć — żadna figura na planie transakcyjnym się
  nie zmienia)

## References

- Research: `context/changes/2026-08-12-wplaty-jedno-zrodlo/research.md`
- Źródło niezmiennika: `context/changes/2026-08-12-ex-557-legacy-deposit-types/change.md`
- Wzorzec testu DB: `src/__tests__/lib/db/get-deposit-transactions.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Podgląd dociąga listę wpłat

#### Automated

- [x] 1.1 Spec podglądu / `src/__tests__/lib/queries` zielone — f49b320e
- [x] 1.2 Typecheck zmienionych plików nie zgłasza braku pola — f49b320e

### Phase 2: Zwinięcie kontraktu + rename

#### Automated

- [x] 2.1 `settlement-groups.test.ts` zielone — 195f564f
- [x] 2.2 `summary-economics.test.ts` zielone — 195f564f
- [x] 2.3 `grep -rn "wplatyNet" src e2e` nic nie zwraca — 195f564f

### Phase 3: Guard na niezmiennik

#### Automated

- [x] 3.1 `investment-write-guard.db.test.ts` zielone — 12d59470
- [x] 3.2 Test pada po tymczasowym przywróceniu `COMPANY_FUNDING` do `INVESTMENT_TYPES` — 12d59470
