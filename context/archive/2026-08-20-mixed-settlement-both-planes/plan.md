# Tryb mieszany — utwardzenie spike'u: testy, kontrakt lista↔panel, ścieżka zapisu

## Overview

Spike z 20–23 sierpnia przeprojektował rozliczenie wpłat trzy razy i za każdym razem świadomie
pomijał testy. Model stoi i został ręcznie zweryfikowany na przykładzie podpisanym przez właściciela;
zostało to, czego spike nie mógł zrobić przy otwartym projekcie: przepisać 41 czerwonych testów na
obecny model, pokryć nową arytmetykę, domknąć kontrakt „lista pokazuje tę samą kwotę co panel",
zamknąć trzy dziury w ścieżce zapisu i skasować martwą drugą formułę bilansu.

Ten plan nie projektuje niczego nowego. Wszystkie rozstrzygnięcia domenowe są już zapadnięte
i zapisane w `change.md`; tutaj są tylko wykonywane.

## Current State Analysis

**Cały spike leży niescommitowany w drzewie roboczym** — 38 zmodyfikowanych plików plus 5 nowych
(`plane-amount-field.tsx`, `settlement-plane-warning.tsx`, `deposit-plane-sums.ts`,
`net-gross-amounts.ts` + jego spec). To jest punkt wyjścia dla każdej fazy.

Stan bramek:

| Bramka                    | Stan                              | Zakres                                          |
| ------------------------- | --------------------------------- | ----------------------------------------------- |
| `npx tsc --noEmit`        | 37 błędów                         | wyłącznie 4 pliki specyfikacji, zero w `src/**` |
| `pnpm test` (jednostkowe) | 41 czerwonych                     | te same 4 pliki                                 |
| `pnpm test:parity`        | czerwony na **każdej** inwestycji | `investment-render-parity-db.test.ts`           |
| `pnpm test:integration`   | nieuruchamiany w tej sesji        | —                                               |

Cztery czerwone pliki i powód każdego:

- `src/__tests__/lib/kosztorys/deposit-planes.test.ts` — `DepositPlaneSumsT` ma teraz cztery surowe
  sumy zamiast dwóch kubełków; `bucketDepositsByPlane` żyje, ale zwraca inny kształt.
- `src/__tests__/lib/kosztorys/settlement-mode.test.ts` — asercje na `MIXED → 'both'`, podczas gdy
  `MONEY_AXIS_BY_MODE` mapuje `MIXED → 'net'` (trzeci przebieg spike'u).
- `src/__tests__/components/kosztorys/summary/settlement-groups.test.ts` — dwa tory rozliczenia
  i `computeMixedSettlement`, oba usunięte.
- `src/__tests__/lib/kosztorys/summary-economics.test.ts` — 501 linii, w większości wciąż aktualnych
  prymitywów, z blokiem `computeMixedSettlement` i asercjami na krzyżowanie wpłat przez VAT, którego
  już nie ma.

**Zerowe pokrycie** ma cały model wpłat wprowadzony przez spike: `sumDeposits`, `depositRowPair`,
`depositPairFromPlaneSums`, `legacyNet`, `isOffPlaneDeposit`, `offPlaneDeposits`, `strandsDeposit`,
`depositsStrandedBy`, `settlementModeDepositImpact`, `carriesNetAmount`, `confirmBeforeSubmit`.

### Key Discoveries

- **`shapeInvestments` ma piąty parametr z domyślną wartością i to jest defekt, nie wygoda**
  (`src/lib/queries/shape-investments.ts:28`). `depositPlaneSumsRecord: DepositPlaneSumsMapT = {}`
  sprawia, że wywołanie bez wpłat kompiluje się i zwraca **cichą złą kwotę** zamiast błędu typu.
  Parity dokładnie w to wdepnęło: `investment-render-parity-db.test.ts:152` woła `shapeInvestments`
  z czterema argumentami, więc wpłaty liczą się jako zero. Na inwestycji #34 rozjazd wynosi
  63 278,90 zł — co do grosza jedyny `INVESTOR_DEPOSIT` tej inwestycji
  (`listing=-11962.45`, `detail=51316.45`, różnica = wpłata).
- **Wiersz `bilans brutto` w parity ma zły oracle.** Porównuje `listingRow.balanceGross`
  (czyli `-computeAmountDue(…).gross`, płaszczyzna kosztorysu) z `grossBalance(...)` — formułą v1
  z płaszczyzny transakcji (`investment-render-parity-db.test.ts:195`). To jedyne żywe wywołanie
  `grossBalance` poza jego własnym specem.
- **Detal i lista mają się zgadzać z definicji, nie z konwencji.** Komentarz przy `balance`
  (`shape-investments.ts:44-51`) zapisuje, że `calculateBalance` zwija się dokładnie na
  `-computeAmountDue(…).net`, gdy wpłaty czyta się per forma. Parity jest miejscem, gdzie ta teza
  jest sprawdzana — dzisiaj nie jest sprawdzana wcale.
- **`vatPlane` da się dziś przepisać dwiema drogami**, wbrew rozstrzygnięciu „tagu się nie edytuje":
  `updateTransferAction` jawnie go zapisuje na `INVESTOR_DEPOSIT`
  (`src/lib/actions/transfers.ts:260`), a pole w kolekcji nie ma `access.update: () => false`
  (`src/collections/transfers.ts:147`) — w przeciwieństwie do sąsiedniego `sourceRegister`, które
  ma (`:164`).
- **`createTransferAction` rozlewa surowe `data`** do `payload.create` zamiast `parsed.data`
  (`src/lib/actions/transfers.ts:53`), więc zwężenie Zoda nie dociera do zapisu.
- **`validate.ts` czyści `netAmount`, ale nie `vatPlane`.** Gałąź `else` przy `carriesNetAmount`
  (`src/hooks/transfers/validate.ts:141`) jest gotowym wzorcem — `vatPlane` nie ma odpowiednika,
  choć jest odczytywany dwie linijki wyżej (`:50`) i jest podstawą obu predykatów bramki.
- **Baza testowa 5435 ma 1000 pozycji kosztorysu**, więc parity ma na czym stać po naprawie;
  golden master przechodzi już dziś.

## Desired End State

`npx tsc --noEmit`, `pnpm test`, `pnpm test:parity` i `pnpm test:integration` są zielone przy
niezmienionym zachowaniu ekranów, poza trzema świadomymi zmianami w ścieżce zapisu i jedną zmianą
etykiety na liście transferów. Bilans v2 na liście inwestycji jest sprawdzany wobec tej samej kwoty,
którą liczy panel Podsumowania — a nie wobec formuły v1 — i wywołanie `shapeInvestments` bez wpłat
przestaje się kompilować. `gross-balance.ts` nie istnieje. Tag wpłaty jest niezmienialny na każdej
drodze zapisu. Rozstrzygnięcia spike'u są przeniesione do living doc, a change zarchiwizowany.

Weryfikacja: cztery komendy bramki whole-tree na końcu planu, plus rejestr sprawdzeń ręcznych.

## What We're NOT Doing

- **Nie projektujemy modelu od nowa.** Wszystkie cztery przebiegi spike'u są rozstrzygnięte; plan
  ich nie relitygaje. Dotyczy to w szczególności: braku krzyżowania przez VAT, materiałów po face
  value w każdym trybie, jednej kolumny na tryb, ostrzeżenia zamiast blokady i lekarstwa
  „ustaw rozliczenie mieszane".
- **Nie kasujemy trybu mieszanego** — rozstrzygnięte w tej rundzie, uzasadnienie ląduje w living doc
  (faza 6), nie w kodzie.
- **Nie piszemy E2E w tym planie** — ścieżka dialogu przy księgowaniu idzie do backlogu jako issue
  z etykietą `e2e-backlog` (faza 6).
- **Nie backfillujemy legacy wpłat.** `legacyNet` zostaje mostkiem tylko do czytelności starych
  wierszy; poprawka to anulowanie i zaksięgowanie na nowo.
- **Nie ruszamy v1.** `balanceFromTransactions`, `calculateMargin` i `totalIncome` zostają na
  płaszczyźnie transakcji.
- **Nie dotykamy migracji ani produkcyjnej bazy.** Żadna faza nie zmienia schematu — `netAmount`
  już istniał.

## Implementation Approach

Testy najpierw, zmiany zachowania po zielonym drzewie. Fazy 1–2 są czysto testowe i przywracają
bramkę, która przez trzy dni nic nie mówiła. Faza 3 jest jedyną, która rusza kod produkcyjny
„przy okazji" — usunięcie domyślnej wartości piątego parametru jest poprawką defektu, nie
sprzątaniem, bo to ona zamieniła zapomniany argument w cichą złą kwotę. Faza 4 zmienia zachowanie
i każda z trzech dziur idzie ścieżką test-driven debugging: najpierw test odtwarzający, potem
poprawka. Fazy 5–6 domykają nazewnictwo i cykl życia dokumentów.

## Critical Implementation Details

**Kolejność w fazie 3.** Usunięcie domyślnej wartości `depositPlaneSumsRecord` jest zmianą łamiącą
kompilację dla **czternastu** wywołań w `src/__tests__/lib/queries/shape-investments.test.ts`, które
podają dwa lub trzy argumenty. Trzeba je poprawić w tym samym kroku, inaczej faza kończy się
czerwonym typecheckiem, który nie ma nic wspólnego z tym, co faza sprawdza.

**Parity nie jest odkrywany przez `test:integration`.** `scripts/test-integration.sh` jawnie go
wyklucza (razem z golden masterem), bo parity nie samo-provisionuje fixture'ów — asertuje cały
dataset. Jego bramką jest `pnpm test:parity` i tylko ona; uruchomienie `pnpm test:integration`
nie powie nic o fazie 3.

**Ostrzeżenie o `vatPlane` w panelu admina.** Field-level `access.update: () => false` blokuje panel
admina i REST, ale **nie** Local API z `overrideAccess: true` — a tak woła `payload.update`
w server action. Dlatego dziura domyka się dopiero dwoma cięciami naraz: pole w kolekcji **i**
usunięcie `vatPlane` z `updateTransferSchema` oraz z destrukturyzacji w `updateTransferAction`.
Zamknięcie tylko jednego zostawia drugą drogę otwartą.

---

## Phase 1: Model wpłat w testach

### Overview

Dwa najmniejsze czerwone pliki przechodzą na obecny model, a cały nowy słownik wpłat dostaje
pokrycie, którego nie ma dzisiaj wcale.

### Changes Required:

#### 1. Sumy i pary wpłat

**File**: `src/__tests__/lib/kosztorys/deposit-planes.test.ts`

**Intent**: Przepisać na obecny kształt `DepositPlaneSumsT` (cztery surowe sumy) i pokryć drogę
od wiersza do pary: gotówka ma `gross: null` i nigdy nie zamienia się w zero, przelew niesie obie
kwoty z faktury, a `legacyNet` wchodzi dokładnie raz — w `depositPairFromPlaneSums` — i tylko dla
wierszy sprzed spike'u bez `netAmount`.

**Contract**: `sumDeposits(rows, vatRate) → MoneyPairT`, `depositRowPair(row, vatRate) → DepositPairT`
(`{ net: number; gross: number | null }`), `depositPairFromPlaneSums(sums, vatRate)`,
`bucketDepositsByPlane(rows) → DepositPlaneSumsT`. Wiersz nieoznaczony liczy się jak gotówka
(rozstrzygnięcie „brak wartości = netto", 2026-07-23) — asercja na to zostaje, zmienia się tylko
kształt wyniku.

#### 2. Oba predykaty bramki, obok siebie

**File**: `src/__tests__/lib/kosztorys/deposit-planes.test.ts`

**Intent**: `isOffPlaneDeposit` i `strandsDeposit` odpowiadają na dwa różne pytania i to jest celowe
— test musi pokazywać, gdzie się rozchodzą, bo inaczej pierwszy refaktor je sklei. Tabela prawdy na
trzech trybach × trzech tagach (`NET` / `GROSS` / `null`) dla obu predykatów w jednym miejscu.

**Contract**: `isOffPlaneDeposit(row, mode)` — oba kierunki, nigdy w `MIXED`.
`strandsDeposit(plane, mode)` — wyłącznie `mode === 'GROSS' && plane !== 'GROSS'`.
`depositsStrandedBy(rows, nextMode) → { count, amount }` liczy przed przestawieniem trybu.

#### 3. Oś pieniądza na tryb

**File**: `src/__tests__/lib/kosztorys/settlement-mode.test.ts`

**Intent**: Zdjąć asercje na `MIXED → 'both'` i zapisać obecną regułę: każdy tryb ma dokładnie
jedną kolumnę, a mieszany idzie na netto. Asercja „żaden tryb nie daje osi bez pieniędzy" zostaje —
jest tańszym strażnikiem niż wyliczanka.

**Contract**: `settlementModeToMoneyAxis(mode) → MoneyAxisT`, `MIXED → 'net'`.
`effectiveMaterialsNetRate` bez zmian.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/deposit-planes.test.ts src/__tests__/lib/kosztorys/settlement-mode.test.ts` przechodzi
- `npx tsc --noEmit` nie zgłasza już błędów w tych dwóch plikach

#### Manual Verification:

- (brak — faza czysto testowa)

---

## Phase 2: Arytmetyka rozliczenia

### Overview

Największy czerwony plik i tabela rozliczenia wracają do zieleni na obecnym modelu, a trzy bugi
znalezione w trakcie spike'u dostają strażników regresji, których nigdy nie miały.

### Changes Required:

#### 1. Prymitywy i „Do zapłaty"

**File**: `src/__tests__/lib/kosztorys/summary-economics.test.ts`

**Intent**: Usunąć blok `computeMixedSettlement` i wszystkie asercje na krzyżowanie wpłat przez VAT.
Prymitywy VAT (`moneyPair`, `faceValue`, `billedMaterialsPair`, `breakdownRowPair`, `combinedPair`)
zostają — dotyczą robocizny i materiałów, nie wpłat, i nic ich nie ruszyło. `computeAmountDue`
dostaje asercję zakotwiczoną na przykładzie podpisanym przez właściciela (`change.md`), liczoną
niezależnie od kodu.

**Contract**: `computeAmountDue(laborCostsNet, paid, materials, vatRate, materialsNetRate, loss)`
— sześć argumentów, `paid` jest parą, tryb **nie** wchodzi już w ogóle. Materiały stoją po face
value na obu płaszczyznach.

#### 2. Trzy strażniki regresji

**File**: `src/__tests__/lib/kosztorys/summary-economics.test.ts`, `src/__tests__/lib/kosztorys/format.test.ts`

**Intent**: Każdy z trzech bugów wymienionych w `change.md` odtworzyć jako asercję na obecnym
modelu — nowy model je rozpuszcza, więc strażnik pilnuje, żeby nie wróciły przy następnym
przeprojektowaniu. (1) wpłata przelewem nie schodzi z kolumny netto po wartości brutto;
(2) kolumna brutto nie dolicza VAT-u od części już zapłaconej; (3) `formatNet` przy resztce
zmiennoprzecinkowej rzędu −7e-12 drukuje „0,00", nie „-0,00".

**Contract**: `formatNet(value)` — bez „zł", bez znaku minus na zaokrąglonym zerze.

#### 3. Jedna tabela rozliczenia

**File**: `src/__tests__/components/kosztorys/summary/settlement-groups.test.ts`

**Intent**: Zdjąć dwa tory i przepisać na jedną tabelę sterowaną osią. Wiersz „Wpłaty" bierze jedną
skrzyżowaną parę, krok straty stoi pod wpłatami w każdym trybie, a „Pozostało do zapłaty" porównuje
się z zerem **po** zaokrągleniu do groszy — inaczej resztka 1e-13 świeci na czerwono obok „0,00".

**Contract**: `buildSettlementGroups(...)` przyjmuje jedno `paid: MoneyPairT` plus oś; nie ma już
`mixedPaid` ani `depositsTotal`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts src/__tests__/components/kosztorys/summary/settlement-groups.test.ts` przechodzi
- `pnpm test` — cały pakiet jednostkowy zielony, 0 z 41 wcześniejszych czerwonych
- `npx tsc --noEmit` czysty na całym `src/__tests__`

#### Manual Verification:

- (brak — faza czysto testowa)

---

## Phase 3: Kontrakt lista ↔ panel

### Overview

Jedyna faza rusząca kod produkcyjny poza ścieżką zapisu. Naprawia bramkę, która przez trzy dni nie
sprawdzała wpłat, i usuwa drugą implementację bilansu brutto.

### Changes Required:

#### 1. Piąty parametr przestaje mieć default

**File**: `src/lib/queries/shape-investments.ts`

**Intent**: `depositPlaneSumsRecord` staje się wymagany. To domyślne `= {}` zamieniło zapomniany
argument w cichą złą kwotę zamiast w błąd typu — i dokładnie tak parity przespał rozjazd
63 278,90 zł. Wywołanie bez wpłat ma przestać się kompilować.

**Contract**: `shapeInvestments(investments, financialsRecord, kosztorysTotalsRecord, subcontractorDueRecord, depositPlaneSumsRecord)`
— piąty argument bez wartości domyślnej. Pozostałe defaulty zostają: one nie sterują kwotą, na
którą patrzy czytelnik listy.

#### 2. Wywołania w specu jednostkowym

**File**: `src/__tests__/lib/queries/shape-investments.test.ts`

**Intent**: Czternaście wywołań podaje dziś dwa lub trzy argumenty — uzupełnić w tym samym kroku.
Przy okazji dopisać przypadki, których ten spec nie ma wcale: wiersz z wpłatami (bilans schodzi
o ich sumę) oraz reguła jednej kolumny na tryb.

**Contract**: `settlesOn(row, plane)` z `components/tables/investments.tsx` — asercja, że przy
`NET` żyje netto, przy `GROSS` brutto, przy `MIXED` netto.

#### 3. Parity dostaje wpłaty i właściwy oracle

**File**: `src/__tests__/investment-render-parity-db.test.ts`

**Intent**: Dociągnąć `selectDepositPlaneSums` obok trzech już pobieranych map i podać jako piąty
argument. Wiersz `bilans brutto` przestaje porównywać się z `grossBalance` (formuła v1) i porównuje
się z tym, co liczy panel. Wiersz `bilans` zostaje — po naprawie jest realnym sprawdzeniem tezy
z komentarza w `shape-investments.ts`, że `calculateBalance` zwija się na `-computeAmountDue(…).net`.

**Contract**: `selectDepositPlaneSums(db) → { investmentId, … }[]`, mapowane na
`DepositPlaneSumsMapT` po `String(investmentId)` — tym samym wzorcem co `kosztorysTotals`
i `subcontractorDue` tuż obok.

#### 4. Martwa druga formuła bilansu

**File**: `src/lib/db/gross-balance.ts`, `src/__tests__/lib/db/gross-balance.test.ts`

**Intent**: Usunąć oba pliki. Po zmianie oracle'a w parity nie ma już żadnego wywołania poza
własnym specem. Bramką jest typecheck, nie grep. Rozstrzygnięcie o stracie, które ten plik nosił
w komentarzu (strata nie poszerza bazy VAT, EX-675), jest już zapisane w `calculate-balance.ts:9`
— sprawdzić, że przetrwa, zanim plik zniknie.

**Contract**: żadnego eksportu `grossBalance` w drzewie.

### Success Criteria:

#### Automated Verification:

- `pnpm test:parity` przechodzi (parity + golden master)
- `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts` przechodzi
- `grep -rn "grossBalance" src` nie zwraca nic
- `npx tsc --noEmit` czysty — potwierdza, że żadne wywołanie `shapeInvestments` nie zgubiło wpłat

#### Manual Verification:

- Na `/inwestycje` bilans v2 inwestycji z wpłatami równa się „Pozostało do zapłaty" z panelu
  Podsumowania tej samej inwestycji, ze znakiem przeciwnym
- Inwestycja rozliczana netto pokazuje „nie dotyczy" w kolumnie bilansu brutto i odwrotnie;
  mieszana pokazuje netto

---

## Phase 4: Ścieżka zapisu

### Overview

Trzy dziury znalezione w research, każda ścieżką test-driven debugging: najpierw test odtwarzający
na stanie utrwalonym, potem poprawka. Pierwsza z nich jest podstawą obu predykatów bramki, więc
śmieciowa wartość na obcym typie zatruwa całą resztę.

### Changes Required:

#### 1. `vatPlane` zerowany dla typów, które go nie noszą

**File**: `src/hooks/transfers/validate.ts`

**Intent**: Tag ma sens wyłącznie na wpłacie od inwestora — wszędzie indziej jest bez znaczenia,
a bywa czytany. Hook jest serwerowym autorytetem i ma już gotowy wzorzec: gałąź `else` przy
`carriesNetAmount` czyści `netAmount` dla każdego innego wiersza. `vatPlane` dostaje ten sam
kształt. Reguła mieszka raz, obok tamtej.

**Contract**: `d.vatPlane = null` dla każdego typu poza `INVESTOR_DEPOSIT`. Wartość jest już
odczytana jako `resolved('vatPlane')` — używa się jej, nie surowego `d.vatPlane`, żeby edycja
częściowa nie ominęła reguły.

#### 2. Akcja zapisuje to, co przeszło przez Zoda

**File**: `src/lib/actions/transfers.ts`

**Intent**: `payload.create` dostaje `...data` zamiast `...parsed.data`, więc zwężenie schematu
nie dociera do zapisu. Poprawić na `parsed.data`; przy okazji `validateSourceRegister` też czyta
surowe `data.sourceRegister`.

**Contract**: `createTransferAction` — jedno źródło danych do zapisu, `parsed.data`.
`createBulkTransferAction` sprawdzić przy okazji; jeśli ma ten sam kształt, poprawić razem.

#### 3. Tag wpłaty naprawdę nieedytowalny

**File**: `src/collections/transfers.ts`, `src/lib/schemas/transfer.ts`, `src/lib/actions/transfers.ts`

**Intent**: Rozstrzygnięcie „tagu się nie edytuje, korekta to anulowanie i zaksięgowanie na nowo"
jest dziś połowiczne — panel admina przepisuje pole, a `updateTransferAction` jawnie je zapisuje.
Zamknąć obie drogi naraz (patrz „Critical Implementation Details" — jedna nie wystarcza).

**Contract**: pole `vatPlane` w kolekcji dostaje `access: { update: () => false }`, dokładnie jak
sąsiednie `sourceRegister`. `updateTransferSchema` traci `vatPlane`, a `updateTransferAction`
destrukturyzację i warunkowy zapis tego pola.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/validate-hook.test.ts src/__tests__/transfer-schema.test.ts` przechodzi, z nowym testem odtwarzającym dla każdej z trzech dziur
- `pnpm test:integration` przechodzi — `transfer-actions.test.ts` asertuje **stan utrwalony** po próbie przetagowania, nie wynik akcji
- `grep -n "vatPlane" src/lib/schemas/transfer.ts` pokazuje pole tylko w `createTransferSchema`

#### Manual Verification:

- Dialog edycji wpłaty nie ma pola formy wpłaty i zapis edycji nie zmienia tagu
- W panelu admina pole „Rozliczenie netto/brutto" na zaksięgowanej wpłacie jest tylko do odczytu
- Zaksięgowanie wydatku (nie wpłaty) zostawia tag pusty, także po edycji

---

## Phase 5: Nazewnictwo

### Overview

Ostatnia powierzchnia mówiąca starym słownikiem. Rozstrzygnięcie z 2026-08-23 mówi, że tag wpłaty
nazywa się po **formie**, nie po płaszczyźnie — „netto/brutto" zostaje nazwą trybu rozliczenia
i niczego więcej.

### Changes Required:

#### 1. Kolumna na liście transferów

**File**: `src/components/tables/transfers.tsx`

**Intent**: Kolumna `vatPlane` ma nagłówek „Rozliczenie netto/brutto" i renderuje `VAT_PLANE_LABELS`,
czyli mówi o wpłacie słownikiem trybu. Przejść na słownik formy — ten sam, którego używa lista wpłat
w panelu.

**Contract**: nagłówek „Forma wpłaty", wartości z `DEPOSIT_PLANE_LABELS` („Gotówka" / „Przelew"),
pusty wiersz zostaje przy „—". `VAT_PLANE_LABELS` nie znika — dalej nazywa tryb.

#### 2. Etykieta kwoty przy gotówce

**File**: `src/components/forms/form-fields/plane-amount-field.tsx`

**Intent**: Przy przelewie obie etykiety są jednoznaczne („Kwota brutto" / „Kwota netto z faktury").
Przy gotówce „Kwota netto (PLN)" nazywa płaszczyznę tam, gdzie wpłata ma tylko jedną kwotę i żadnego
wyboru — to jedyne miejsce, gdzie słowo „netto" nic nie rozróżnia.

**Contract**: gałąź `plane === 'NET'` — etykieta bez płaszczyzny.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/transfer-table.test.ts` przechodzi
- `grep -rn "VAT_PLANE_LABELS" src/components` nie zwraca już `tables/transfers.tsx`

#### Manual Verification:

- Kolumna na `/transfery` mówi „Forma wpłaty" i pokazuje „Gotówka" / „Przelew"
- Formularz wpłaty gotówką ma jedno pole kwoty bez słowa „netto" w etykiecie

---

## Phase 6: Domknięcie

### Overview

Cykl życia dokumentów i długi proceduralne. Bez kodu poza ewentualnym `roadmap.md`.

### Changes Required:

#### 1. Trwałe uzasadnienie do living doc

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: Przenieść z `change.md` to, co przeżyje ten change: model wpłat po czwartym przebiegu
(nic nie przechodzi przez VAT, gotówka nie ma kwoty brutto), dlaczego stoją obok siebie dwa
predykaty, dlaczego lekarstwem jest tryb a nie wpłata, i **dlaczego tryb mieszany zostaje** mimo że
różni się od netto tylko oznaczaniem przelewu — bez niego trzy komunikaty nie mają czego zaproponować.

**Contract**: sekcja o wpłatach w tym dokumencie; `change.md` przestaje być jedynym miejscem, gdzie
te rozstrzygnięcia żyją.

#### 2. Wnioski warsztatowe

**File**: `context/foundation/lessons.md`

**Intent**: Jeden wpis: parametr z wartością domyślną, który steruje kwotą, zamienia zapomniany
argument w cichą złą liczbę zamiast w błąd typu — i tak przespał się rozjazd 63 278,90 zł
w bramce, która istnieje dokładnie po to, żeby go złapać.

**Contract**: wpis w istniejącym formacie pliku.

#### 3. Rejestr sprawdzeń ręcznych

**File**: `context/foundation/manual-checks.md`

**Intent**: Zebrać wszystkie punkty `#### Manual Verification:` z faz 3–5 w jedną sekcję tego
changeu, z setupem (baza 5435, `pnpm seed:kosztorys:test`, rola OWNER).

**Contract**: nowa sekcja `##` w istniejącym formacie.

#### 4. Dług E2E

**Intent**: Ścieżka „gotówka na inwestycji rozliczanej brutto → dialog → «Zapisz mimo to» → wpłata
w bazie i czerwona na liście" przechodzi wszystkie granice naraz i nie ma strażnika. Założyć issue
w projekcie „Wykonczymy" z etykietą `e2e-backlog`, opisując ścieżkę i dyspozycję testową. Jeśli
Linear MCP jest nieosiągalny — powiedzieć to wprost i **nie** twierdzić, że issue powstało.

**Contract**: id issue zapisane w `change.md`.

#### 5. Archiwizacja

**File**: `context/changes/2026-08-20-mixed-settlement-both-planes/change.md`

**Intent**: `status: done`, `updated`, po czym przenieść folder pod `context/archive/` zgodnie
z regułą cyklu życia dokumentów — surowe rozstrzygnięcia zostają jako zapis, trwałe wnioski już
są w living doc.

**Contract**: `context/archive/2026-08-20-mixed-settlement-both-planes/`.

### Success Criteria:

#### Automated Verification:

- (brak automatycznej weryfikacji — faza prozatorska; whole-tree gate poniżej jest bramką całości)

#### Manual Verification:

- `context/reference/kosztorys-editor-domain-notes.md` opisuje model wpłat tak, że da się z niego
  odtworzyć zachowanie panelu bez czytania `change.md`

---

## Testing Strategy

### Unit Tests:

- Model wpłat: gotówka bez kwoty brutto, przelew z obiema z faktury, wiersz nieoznaczony jak gotówka,
  `legacyNet` tylko dla wierszy sprzed spike'u
- Tabela prawdy obu predykatów: trzy tryby × trzy tagi, dla `isOffPlaneDeposit` i `strandsDeposit`
  obok siebie
- `computeAmountDue` na przykładzie podpisanym przez właściciela, liczonym niezależnie od kodu
- Trzy strażniki regresji na bugi rozpuszczone przez nowy model
- Reguła jednej kolumny na tryb (`settlesOn`)

### Integration Tests:

- **Cross-surface (ryzyko #1)**: dla każdej inwestycji w bazie 5435 bilans v2 z prawdziwego buildera
  wiersza listy równa się kwocie liczonej przez panel — po podaniu wpłat i po zdjęciu domyślnej
  wartości piątego parametru
- Stan utrwalony po próbie przetagowania wpłaty przez akcję (nie wynik akcji)

### Manual Testing Steps:

Zebrane w `context/foundation/manual-checks.md` w fazie 6; nie duplikowane tutaj.

## Performance Considerations

Brak. Faza 3 dokłada parity jeden `SELECT` na przebieg (mapa wpłat per inwestycja) — ten sam,
który lista już robi w produkcji. Żadna faza nie zmienia zapytań renderujących.

## Migration Notes

Brak migracji. `netAmount` istniał wcześniej jako kolumna netto-wydatku, dlatego czwarty przebieg
spike'u obszedł się bez zmiany schematu. Dane kosztorysu są nadal jednorazowe do czasu wejścia
dogfoodingu na `main`, więc żaden wiersz nie wymaga ścieżki zachowania.

## Whole-tree Gate

Uruchamiane **raz**, po ostatniej fazie.

- Typecheck: `npx tsc --noEmit`
- Lint: `pnpm lint`
- Pakiet jednostkowy: `pnpm test`
- Integracja przy 5435: `pnpm test:integration`
- Parity + golden master: `pnpm test:parity`
- Build: `pnpm build`

## References

- Research: `context/changes/2026-08-20-mixed-settlement-both-planes/research.md`
  (sekcja „Follow-up 2026-08-23 — the booking gate")
- Rozstrzygnięcia właściciela: `context/changes/2026-08-20-mixed-settlement-both-planes/change.md`
- Ryzyka #1 i #3: `context/foundation/test-plan.md`
- Wzorzec parametru bez defaultu: `src/lib/queries/shape-investments.ts:28`
- Wzorzec pola nieedytowalnego: `src/collections/transfers.ts:164` (`sourceRegister`)
- Wzorzec zerowania pola w hooku: `src/hooks/transfers/validate.ts:141` (`netAmount`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Model wpłat w testach

#### Automated

- [x] 1.1 `pnpm exec vitest run src/__tests__/lib/kosztorys/deposit-planes.test.ts src/__tests__/lib/kosztorys/settlement-mode.test.ts` przechodzi — 1efa2b73
- [x] 1.2 `npx tsc --noEmit` nie zgłasza już błędów w tych dwóch plikach — 1efa2b73

### Phase 2: Arytmetyka rozliczenia

#### Automated

- [x] 2.1 `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts src/__tests__/components/kosztorys/summary/settlement-groups.test.ts` przechodzi — be28b001
- [x] 2.2 `pnpm test` — cały pakiet jednostkowy zielony, 0 z 41 wcześniejszych czerwonych
- [x] 2.3 `npx tsc --noEmit` czysty na całym `src/__tests__` — be28b001

### Phase 3: Kontrakt lista ↔ panel

#### Automated

- [x] 3.1 `pnpm test:parity` przechodzi (parity + golden master) — 6875e4ac
- [x] 3.2 `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts` przechodzi — 6875e4ac
- [x] 3.3 `grep -rn "grossBalance" src` nie zwraca nic — 6875e4ac
- [x] 3.4 `npx tsc --noEmit` czysty — żadne wywołanie `shapeInvestments` nie zgubiło wpłat — 6875e4ac

### Phase 4: Ścieżka zapisu

#### Automated

- [x] 4.1 `pnpm exec vitest run src/__tests__/validate-hook.test.ts src/__tests__/transfer-schema.test.ts` przechodzi, z testem odtwarzającym dla każdej z trzech dziur — d6b80d12
- [x] 4.2 `pnpm test:integration` przechodzi — asercja na stan utrwalony po próbie przetagowania — d6b80d12
- [x] 4.3 `grep -n "vatPlane" src/lib/schemas/transfer.ts` pokazuje pole tylko w `createTransferSchema` — d6b80d12

### Phase 5: Nazewnictwo

#### Automated

- [x] 5.1 `pnpm exec vitest run src/__tests__/transfer-table.test.ts` przechodzi — fcafd2ea
- [x] 5.2 `grep -rn "VAT_PLANE_LABELS" src/components` nie zwraca już `tables/transfers.tsx` — fcafd2ea

### Phase 6: Domknięcie

#### Automated

- [x] 6.1 (brak bramki fazowej — faza prozatorska; całości pilnuje „Whole-tree Gate") — bramka całości zielona (lint: dwa błędy spoza changeu) — 4f24faa7
