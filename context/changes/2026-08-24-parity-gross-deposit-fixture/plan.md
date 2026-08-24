# Wpłaty brutto w fixture `db-test` + podłoga zbioru w bramce parity — Implementation Plan

## Overview

EX-725. `pnpm test:parity` stoi nad zbiorem, w którym płaszczyzna brutto jest pusta: 221 wierszy
`INVESTOR_DEPOSIT` w `db-test`, wszystkie z `vat_plane IS NULL` i `net_amount IS NULL`. Nieotagowana
wpłata liczy się jak gotówka („brak wartości = netto", owner 2026-07-23), więc każdy z czterech
kubełków `DepositPlaneSumsT` poza `paidNet` jest w całym fixture zerem. Bramka przepuszcza na
zielono regresję w bucketowaniu przelewów i w moście legacy, bo nie ma na czym jej zobaczyć.

Zmiana ma trzy ruchy: **najpierw podłoga** (bramka ma failować na dzisiejszym zbiorze — to walidacja
przyrządu, nie ozdoba), potem **seed** wpłat brutto, potem **guard, który gryzie** — bo sam seed
niczego nie chroni: obie strony parity czytają ten sam fold SQL, a golden master nie mrozi ani
jednej liczby z płaszczyzny brutto.

## Current State Analysis

**Fixture (`db-test`, 5435).** 115 inwestycji, wszystkie `settlement_mode = NET`, `vat_rate = 0.08`.
221 nieanulowanych `INVESTOR_DEPOSIT`, 100% nieotagowanych. Kosztorys stoi na inw. 7 (1000 pozycji z
`perf-seed-kosztorys.ts`) — ta sama inwestycja ma 8 wpłat gotówkowych, więc jest jedynym miejscem,
gdzie po dosianiu współistnieją wszystkie cztery kubełki nad niezerową robocizną.

**Kto czyta kubełki.** `selectDepositPlaneSums` (`lib/db/deposit-plane-sums.ts`) — fold SQL, czyta go
listing przez `lib/queries/balances.ts` i spec parity. `bucketDepositsByPlane` — bliźniak TS, czyta
go panel. Most legacy (`legacyNet`, dzielenie przez VAT) siedzi w `depositPairFromPlaneSums`, którą
wołają obie strony. **Fold SQL nie ma ani jednego testu** — `src/__tests__/lib/db/` nie zawiera
spec-a dla `deposit-plane-sums.ts`; bliźniak TS ma pełny unit
(`__tests__/lib/kosztorys/deposit-planes.test.ts`).

**Czego bramka nie mrozi.** `InvestmentSnapshotT` w golden masterze trzyma `totalIncome` (v1, sumuje
wszystkie typy wpłat po `amount`), `balance` (v1 `calculateBalance`), `margin`, `marginV2` (czytana z
kosztorysu, wpłat nie widzi). Żaden z tych figur nie rusza się, gdy pęknie bucketowanie albo most
legacy. `paidNet/paidGrossNet/paidGrossLegacy/paidGross` nie są zamrożone nigdzie.

**Dlaczego parity też tego nie złapie.** Obie strony spec-a parity — listing (`shapeInvestments`) i
detal — dostają **ten sam** `depositPlaneSums` z tego samego folda SQL i przepuszczają go przez tę
samą `depositPairFromPlaneSums`. Regresja w foldzie rusza obie strony identycznie i porównanie
zostaje zielone. Parity pilnuje rozjazdu listing↔detal, nie poprawności folda.

**Podłoga zbioru.** `DATASET_FLOOR = { investments: 50, registers: 10, transactions: 1000,
kosztorysItems: 20 }` w `financial-golden-master-db.test.ts`, sprawdzana w dwóch miejscach (jako test
i jako precondition ścieżki `UPDATE_GOLDEN`). Porównanie jest `<=`, więc wpis `n` znaczy „potrzebne
≥ n+1". `fingerprint` liczy tylko transakcje i pozycje kosztorysu — o wpłatach nie mówi nic.

**Ścieżka zapisu zabrania wiersza legacy.** `getNetAmountError` (`lib/utils/validation.ts`) wymaga na
wpłacie `GROSS` kwoty netto (`> 0`, `≤ amount`), a hook `validate.ts:133` jest po stronie serwera.
Wiersz brutto **bez** netto jest więc nie do zapisania przez Payload — istnieje wyłącznie jako
wiersz przed-spike'owy w prodzie. Seed musi go wstawić surowym SQL-em, świadomie omijając walidację.

**`vat_plane` nie wchodzi do podpisu wejścia** golden mastera (`readInputHashes`: `net_amount` tak,
`vat_plane` nie). Dziś nieszkodliwe, bo płaszczyzna nie rusza żadnej mrożonej figury; po fazie 3
przepięcie płaszczyzny na istniejącym wierszu ruszyłoby figurę przy niezmienionym haszu i zgłosiło
się jako dryf kodu.

## Desired End State

- `pnpm test:parity` na zbiorze bez wpłat brutto **failuje z nazwaną przyczyną**, tak jak dziś
  failuje na zbiorze bez kosztorysu.
- `db-test` po udokumentowanym resecie ma wpłaty brutto w trzech stanach: przelew z kwotą netto z
  faktury (netto ≠ `amount ÷ (1+VAT)`, więc regresja „wyprowadź netto zamiast czytać" jest widoczna),
  przelew legacy bez netto (most), i to nad inwestycją, która ma jednocześnie wpłaty nieotagowane i
  niezerową robociznę z kosztorysu.
- Fold SQL ma test: dla każdej inwestycji `selectDepositPlaneSums` == `bucketDepositsByPlane` nad
  wierszami czytanymi drugą, niezależną ścieżką (`getDepositTransactionsForInvestment`).
- Golden master mrozi cztery kubełki per inwestycja, więc regresja w bucketowaniu albo w moście
  legacy rusza konkretną liczbę w committowanym fixture.
- `AGENTS.md` opisuje reset `db-test` jako trzy kroki, nie dwa.

### Key Discoveries:

- **Seed sam nie jest guardem.** Obie strony parity czytają ten sam fold — bez fazy 3 (mrożenie
  kubełków) i fazy 4 (fold SQL == fold TS) dosiane wiersze nie zmieniają tego, co bramka potrafi
  zobaczyć. To jest powód, dla którego ta zmiana ma cztery fazy, nie jedną.
- **Wiersz legacy tylko surowym SQL-em** — `getNetAmountError` blokuje go w Payloadzie
  (`validation.ts`, `validate.ts:133`).
- **Seed przewraca hasze inw. 6/7 w golden masterze**, więc fixture trzeba przegenerować w tej samej
  zmianie — inaczej inw. 7 (jedyna z kosztorysem) wypada z porównania jako „dataMoved" i przestaje
  pilnować `marginV2`.
- **Kasa i inwestycja rozwiązywane z danych, nie zahardkodowane.** `id` kas i inwestycji przychodzą z
  dumpa prodowego; seed rozwiązuje kasę z istniejących wpłat samej inwestycji (a jak nie ma — z
  najniższego `id`), a drugą inwestycję jako najniższe `id` z wpłatami nieotagowanymi i bez kosztorysu.
- **`computeAmountDue` nie patrzy na tryb rozliczenia** dla płaszczyzny brutto — tryb decyduje tylko,
  czy kolumna się renderuje. Dosianie wpłat brutto uruchamia bucketowanie i most bez przestawiania
  ani jednego `settlement_mode`, co trzyma churn fixture'u przy dwóch inwestycjach.

## What We're NOT Doing

- **Nie przestawiamy `settlement_mode`** żadnej inwestycji na `GROSS`/`MIXED`. Tryb rusza render, nie
  arytmetykę bramki (`computeAmountDue` liczy obie płaszczyzny w każdym trybie), a przestawienie
  rozjechałoby figury w całym fixture za zero przyrostu pokrycia dla EX-725.
- **Nie mrozimy pełnego bilansu v2** (`balance` / `balanceGross` z `shapeInvestments`) w golden
  masterze. Rozjazd listing↔detal na tych dwóch pilnuje już spec parity, a ich wejścia
  (cztery kubełki + materiały + robocizna) są mrożone osobno.
- **Nie ruszamy 221 istniejących wierszy nieotagowanych** — one są prawdziwym stanem produ i drugą
  połową modelu („brak wartości = netto").
- **Nie tykamy martwych wpisów `seed:transfers` / `seed:ziutek`** w `package.json` (skrypty, na które
  wskazują, nie istnieją). Zauważone przy okazji, poza zakresem.

## Implementation Approach

Kolejność jest odwrotna do intuicyjnej: **podłoga przed seedem**. Podłoga postawiona po dosianiu
wierszy jest asercją, której nikt nigdy nie widział czerwonej — a to dokładnie ta klasa guardu, który
zieleni się z powodu, którego nie sprawdza. Postawiona przed seedem failuje na dzisiejszym `db-test`
z nazwaną przyczyną, seed ją zdejmuje, i wtedy wiemy, że mierzy to, co miała mierzyć.

## Phase 1: Podłoga wpłat brutto w bramce (czerwona)

### Overview

`fingerprint` golden mastera zaczyna liczyć wpłaty brutto w dwóch stanach, a `DATASET_FLOOR` odmawia
zbioru, w którym któregoś stanu nie ma. Na dzisiejszym `db-test` bramka failuje.

### Changes Required:

#### 1. `src/__tests__/financial-golden-master-db.test.ts`

- `readInputHashes` liczy przy okazji swojego `count(*)` dwa nowe liczniki (jedno zapytanie, nie dwa):
  `grossDepositsWithNet` = nieanulowane `INVESTOR_DEPOSIT` z `vat_plane = 'GROSS' AND net_amount IS NOT NULL`,
  `legacyGrossDeposits` = to samo z `net_amount IS NULL`.
- `SnapshotT['fingerprint']` dostaje oba pola; `buildSnapshot` je przepisuje.
- `DATASET_FLOOR` += `grossDepositsWithNet: 2, legacyGrossDeposits: 0` (porównanie `<=`, więc:
  ≥ 3 przelewy z fakturą, ≥ 1 wiersz legacy). Komentarz przy podłodze mówi, co konkretnie jest puste
  bez tych wierszy — cała płaszczyzna brutto i most legacy.
- Komunikat błędu `assertNonTrivial` wskazuje **oba** skrypty seedowe, nie tylko `db:import:test`.

### Success Criteria:

#### Automated Verification:

- [ ] 1.1 `pnpm test:parity` failuje z komunikatem nazywającym brak wpłat brutto (walidacja przyrządu
      — to jedyny moment, w którym ta asercja jest czerwona z prawdziwego powodu)
- [ ] 1.2 `pnpm typecheck` przechodzi

## Phase 2: Seed wpłat brutto do `db-test`

### Overview

Nowy skrypt seedowy dosiewa wpłaty brutto w trzech stanach i staje się trzecim krokiem
udokumentowanego resetu `db-test`.

### Changes Required:

#### 1. `src/scripts/seed-deposit-planes.ts` (nowy)

- Cel: `INV` (domyślnie 7 — ta z kosztorysem) + druga inwestycja rozwiązana zapytaniem: najniższe
  `id` z ≥ 1 nieanulowaną wpłatą i bez wierszy w `kosztorys_items`.
- Kasa: `source_register_id` ostatniej wpłaty tej inwestycji, fallback najniższe `id` z
  `cash_registers`. `INVESTOR_DEPOSIT` ma `sourceRegister: 'required'`.
- Idempotencja: najpierw `delete` wszystkiego z `description LIKE '[fixture:gross-deposit]%'` na
  obu inwestycjach, potem insert. Skrypt wolno puścić dwa razy.
- Wiersze (kwoty tak dobrane, że `netAmount ≠ amount ÷ 1,08` — regresja „wyprowadź netto zamiast
  czytać" rusza liczbę):
  - inw. `INV`: przelew 129 600 / netto 118 000; przelew 54 000 / netto 49 000;
    przelew 8 640 / netto 8 000; **legacy** 21 600 / netto `NULL`
  - druga inwestycja: przelew 32 400 / netto 29 500; **legacy** 10 800 / netto `NULL`
- ~~Przelewy przez `payload.create` (przechodzą hook walidacyjny — wiersz jest realny, nie
  wymyślony)~~, `paymentMethod: 'TRANSFER'`, `vatPlane: 'GROSS'`, `context: { skipRevalidation: true }`.
- Wiersze legacy surowym `INSERT` przez `getDb` — ścieżka zapisu ich zabrania (`getNetAmountError`),
  a fixture ma je mieć, bo prod je ma. Komentarz w skrypcie mówi dokładnie to.

**Amended at the review gate: WSZYSTKIE sześć wierszy idzie surowym `INSERT`, nie tylko legacy.**
`payload.create` nie wchodzi w grę, bo `afterChange` na `transactions` synchronizuje wiersz do
ŻYWEGO arkusza właściciela, a `afterDelete` robi to bez furtki `skipSheetSync` — idempotentny seed
kasowałby i dopisywał wiersze fixture'u w prawdziwym arkuszu przy każdym przebiegu. Walidacji to nie
gubi: kształt przelewów jest sprawdzany tą samą jedyną instancją reguły (`getNetAmountError`) w
prechecku przed pierwszym zapisem. Nie zmieniaj tego z powrotem „dla spójności" — plan mylił się tu,
nie implementacja.

**Amended at the review gate (2): wiersze dostają JAWNE `id` z bloku `900_001+`, a wipe jest keyowany
wyłącznie markerem.** Klucz porównywalności golden mastera to `sig` zaczynający się od `id` wiersza,
więc `id` z sekwencji przehashowywały obie dosiane inwestycje przy każdym przebiegu i wyrzucały je do
`dataMoved` — `pnpm test:parity` świeciło na zielono, nie porównawszy ani jednej figury na
płaszczyźnie brutto. Idempotencja musi obejmować TOŻSAMOŚĆ wiersza, nie tylko jego treść.

#### 2. `package.json`

- `"seed:deposits:test"` w kształcie `seed:kosztorys:test` (`source .env` + `DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST`).

### Success Criteria:

#### Automated Verification:

- [ ] 2.1 `pnpm seed:deposits:test` puszczony dwa razy pod rząd daje ten sam zbiór wierszy (idempotencja)
- [ ] 2.2 `pnpm test:parity` przechodzi — podłoga z fazy 1 zdjęta danymi, nie obniżeniem progu
- [ ] 2.3 `SELECT` po `vat_plane`/`net_amount` pokazuje ≥ 3 przelewy z netto i ≥ 1 legacy

## Phase 3: Golden master mrozi cztery kubełki

### Overview

Bez tego dosiane wiersze nie zmieniają tego, co bramka potrafi zobaczyć: żadna mrożona figura nie
rusza się, gdy pęknie bucketowanie albo most legacy.

### Changes Required:

#### 1. `src/__tests__/financial-golden-master-db.test.ts`

- `InvestmentSnapshotT` += `deposits: { paidNet, paidGrossNet, paidGrossLegacy, paidGross }` —
  surowy fold SQL, cztery liczby, oraz `depositsPaidNetAfterBridge` (wynik
  `depositPairFromPlaneSums(...).net`), bo tylko on przechodzi przez `legacyNet` i tylko on złapie
  regresję w samym moście.
- `buildSnapshot` czyta `selectDepositPlaneSums` (inwestycja bez wpłat → `NO_DEPOSIT_SUMS`, tak jak
  `shapeInvestments`), most liczy przy `vatRate` inwestycji.
- `readInputHashes`: `vat_plane` wchodzi do `sig`. Bez tego przepięcie płaszczyzny rusza mrożoną
  liczbę przy niezmienionym haszu i raportuje się jako dryf kodu.
- Regeneracja `src/__tests__/fixtures/financial-golden-master.json` przez `pnpm test:golden:update`
  **po** fazie 2 — i przegląd diffu, nie samo „przeszło".

### Success Criteria:

#### Automated Verification:

- [ ] 3.1 `pnpm test:parity` zielone na przegenerowanym fixture
- [ ] 3.2 Diff fixture'u pokazuje `deposits` niezerowe dokładnie na dosianych inwestycjach, i inw. 7
      wraca do porównywanych (nie „dataMoved")
- [ ] 3.3 Ręczna mutacja folda SQL (np. `net_amount` → `amount` w kubełku `paid_gross_net`) wywala
      golden master — walidacja, że mrożenie gryzie; mutacja cofnięta

## Phase 4: Fold SQL ma test, kontrakt ma dokumentację

### Overview

Fold SQL to jedyny czytnik kubełków bez testu, a jego bliźniak TS ma pełny unit. Do tego reset
`db-test` jest w `AGENTS.md` opisany jako dwa kroki, a od fazy 2 ma trzy.

### Changes Required:

#### 1. `src/__tests__/lib/db/deposit-plane-sums.test.ts` (nowy, DB-backed)

- Dla każdej inwestycji: `bucketDepositsByPlane(await getDepositTransactionsForInvestment(payload, id))`
  === wiersz z `selectDepositPlaneSums`. Dwie niezależne ścieżki czytania (czytnik wierszy panelu vs
  fold listingu), więc porównanie nie jest tautologią.
- Ta sama bramka co reszta specy DB: `describe.skipIf(!ENV_READY)`, failuje (nie skipuje), gdy env
  jest ustawione a baza nieosiągalna.
- Asercja, że zbiór ma wiersze brutto — inaczej spec przechodzi porównując zera.

#### 2. `AGENTS.md`

- Bullet o `db:import:test` + `seed:kosztorys:test` dostaje trzeci krok `seed:deposits:test` i jedno
  zdanie **dlaczego**: bez niego podłoga parity failuje, bo cała płaszczyzna brutto jest zerem.

#### 3. `context/foundation/test-plan.md`

- Ryzyko „fixture pokrywa tylko jedną płaszczyznę wpłat" dopisane jako pokryte, z nazwami guardów.

### Success Criteria:

#### Automated Verification:

- [ ] 4.1 Nowy spec przechodzi przez `pnpm test:integration`
- [ ] 4.2 `pnpm typecheck` + `pnpm lint` czyste
- [ ] 4.3 `AGENTS.md` nie opisuje już resetu `db-test` jako dwóch kroków

## Testing Strategy

### Unit Tests:

Brak nowych — `bucketDepositsByPlane` i `depositPairFromPlaneSums` mają pełne pokrycie w
`__tests__/lib/kosztorys/deposit-planes.test.ts`, w tym most legacy.

### Integration Tests:

`src/__tests__/lib/db/deposit-plane-sums.test.ts` — fold SQL == fold TS nad realnym zbiorem, przez
`pnpm test:integration` (bramka pre-push).

### Gate:

`pnpm test:parity` — podłoga (faza 1) + mrożone kubełki (faza 3).

## References

- Linear: EX-725; źródło findingu: bramka `mixed-settlement-both-planes`, faza F8 / code-review #3
- `src/lib/db/deposit-plane-sums.ts`, `src/lib/kosztorys/deposit-planes.ts`
- `src/__tests__/financial-golden-master-db.test.ts`, `src/__tests__/investment-render-parity-db.test.ts`
- `AGENTS.md` § Databases And Live Data (kontrakt `db:import:test`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Podłoga wpłat brutto w bramce (czerwona)

#### Automated

- [x] 1.1 `pnpm test:parity` failuje nazywając brak wpłat brutto
- [x] 1.2 `pnpm typecheck` przechodzi

### Phase 2: Seed wpłat brutto do `db-test`

#### Automated

- [x] 2.1 Seed idempotentny
- [x] 2.2 `pnpm test:parity` zdjęta danymi
- [x] 2.3 Zbiór ma ≥ 3 przelewy z netto i ≥ 1 legacy

### Phase 3: Golden master mrozi cztery kubełki

#### Automated

- [x] 3.1 `pnpm test:parity` zielone na przegenerowanym fixture
- [x] 3.2 Diff fixture'u przejrzany, inw. 7 wraca do porównywanych
- [x] 3.3 Mutacja folda wywala golden master

### Phase 4: Fold SQL ma test, kontrakt ma dokumentację

#### Automated

- [x] 4.1 Nowy spec DB przechodzi
- [x] 4.2 `pnpm typecheck` + `pnpm lint` czyste
- [x] 4.3 `AGENTS.md` opisuje trzy kroki resetu

#### Poza planem, wyszło w weryfikacji

- [x] 4.4 `scripts/test-integration.sh` dosiewa kosztorys i wpłaty brutto po re-imporcie dumpa.
      Bramka integracyjna sama restoruje dump, gdy zmienią się migracje albo `db-test` jest pusty, i
      przed tą zmianą kończyła na `payload migrate` — czyli każdy re-import po cichu zdejmował
      pokrycie, którego pilnuje podłoga zbioru. Wyszło na twardo: pierwszy przebieg
      `pnpm test:integration` w tej zmianie wyczyścił dosiane wiersze i nowy spec zaraportował
      dokładnie to, o czym mówi (`run pnpm seed:deposits:test`). Kontrakt z `AGENTS.md` trzyma się
      teraz sam, niezależnie od tego, kto odtwarza `db-test`.
