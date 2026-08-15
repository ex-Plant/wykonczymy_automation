# Terminologia domeny — Polish→English rename (EX-548) — Implementation Plan

## Overview

Egzekucja kroku „język" łuku l5: jeden business concept = jeden angielski identyfikator w całej
aplikacji. Rename **type-aware** (tsserver/ts-morph), bramkowany `tsc`, rodzina na commit, a na końcu
odkomentowanie uśpionego guarda `local/no-domain-drift` z pełną listą rdzeni — to jest definition of
done tego slice'a.

Dane wejściowe: `research.md` (pomiar na węzłach `Identifier`, HEAD `37e27b24`), `decisions.md`
(ruling'i właściciela + trzy nadpisane 2026-08-15), `change.md` (trzy nienegocjowalne bramki).

## Current State Analysis

Instrument pomiarowy (uśpiona reguła ESLint wskrzeszona na 26 rdzeniach, raportująca wyłącznie węzły
`Identifier`) daje **84 różne identyfikatory / 1204 wystąpienia / 103 pliki**, po wyłączeniu
sankcjonowanego rdzenia `kosztorys` (86 id / 1192 wyst., Category A). Grep dałby liczbę o ~30% wyższą
— to stringi UI, JSX i komentarze, poprawne z polityki. Ta różnica jest powodem, dla którego bramka 1
zakazuje sterowania rename'em z grepa.

Rozkład per rdzeń: `rabat` 22/326, `saldo` 16/144, `robocizn` 11/191, `wydatki` 6/56, `materialy`
4/86, `doZaplaty` 4/70, `sumaPrac` 3/90, `etap` 3/160 (z czego 154 to jeden identyfikator fixture'a
`etapQty`), po 2: `bilans`, `wplat`, `przedmiar`, `pomiar`, po 1: `netto`, `doRozliczenia`, `reszta`,
`lacznie`, `marza`, `wykonan`, `brutto`. **Zero trafień** mają `zaliczk`, `strata`, `wyplat` — te
rdzenie są czystą regresją i wchodzą do guarda za darmo.

### Kluczowe ustalenia z researchu

- **Blast radius = zero.** Żaden identyfikator z driftu nie jest kolumną DB, polem Payload ani kluczem
  utrwalonego JSON-a. `rabat_client_net` / `suma_prac_net` / `global_rabat_net`
  (`src/lib/db/kosztorys-client-totals.ts:86-88`) to **aliasy SQL, nie kolumny**. Nowa zamrożona
  powierzchnia `kosztoryses.sheet_column_mapping` ma klucze już angielskie (`ColumnFieldT`,
  `sheet-import/columns.ts:36-43`).
- **Poza zakresem, bo niosą migrację:** wartość `'RABAT'` w `enum_transactions_type`
  (`src/migrations/20260611_add_rabat_enum.ts:7`, jest też wartością filtra w URL) oraz
  `InvestmentStatusT = 'active'|'completed'|'planowana'` (`src/types/reference-data.ts:15`).
  Obie idą do glosariusza jako guardrail, nie do rename'u.
- **Szew B2 to dokładnie dwie figury** porównywane w `src/lib/kosztorys/reconciliation.ts:120-121`.
  `laborCostsNetFromTransactions` (`:33`) już jest poprawny; brakuje mu bliźniaka po stronie
  kosztorysu.
- **Jednorazowy hazard z EX-555 rozpłynął się:** `laborCostsNetFromKosztorys` ma dziś zero trafień,
  bo commit `f72c68a1` przemianował go na gołe `laborCostsNet` (`use-kosztorys-editor.ts:538`).
- **`sheet-import/` to jedyny podsystem, który wybił nową rodzinę driftu** (11 nazw `Robocizna*`,
  w tym 5 hybryd zakazanych regułą 3), i poza nią jest wzorowo angielski. Osiem plików, zero
  persystencji — najtańszy wysokowartościowy cel.
- **Ta sama nazwa, dwie rzeczy** (bug, nie drift): `robocizna` = figura pieniężna post-rabat
  (`summary-economics.ts:155`), siatka komórek (`read-sheet.ts:30`) i total pre-rabat
  (`chart-slices.ts:74`). `rabat` = werdykt rekoncyliacji, zanegowany `MoneyPairT`, ułamek i indeks
  kolumny. Rename musi te trzy/cztery rozdzielić, nie ujednolicić.
- **Kolizja po angielsku:** `saldo` (kasa) i `bilans` (co klient winien) tłumaczą się oba na `balance`.

### Bramka 3 — dlaczego wciąż obowiązuje

Pierwotne uzasadnienie („plik z 2026-07-08") było nieaktualne: `context/domain/01-domain-distillation.md`
został zregenerowany 2026-07-20. Bramka stoi z innego powodu: rozbicie `settlement.ts` na pięć plików
(EX-650), usunięcie `zaliczki.ts` (EX-536) i odwrócenie przez EX-675 tezy KROK 3B („strata nigdy nie
dotyka bilansu" — dziś `calculate-balance.ts:18` dodaje `totalLoss`). Regeneracja od zera, nie łatanie.

## Desired End State

`pnpm lint` przechodzi z **aktywnym** `local/no-domain-drift` na 21 rdzeniach, obejmującym
`src/**/*.{ts,tsx}` **i** `e2e/**/*.ts`. Każda figura finansowa niesie jedną angielską nazwę po obu
stronach szwu rekoncyliacji, a `context/domain/02-glossary.md` plus świeża destylacja opisują stan
faktyczny kodu, nie zamiar.

## What We're NOT Doing

- **Nie ruszamy Category A**: `kosztorys` (slug `kosztoryses`), `przedmiar`, `pomiar`. To nazwy własne
  artefaktów z arkusza właściciela, bez czystego angielskiego odpowiednika.
- **Nie ruszamy polskich stringów** — etykiet UI, `label = 'Saldo'`, wartości `ROBOCIZNA_TAB`, nazw
  slice'ów wykresu, transkrybowanych nagłówków arkusza w fixture'ach. Zmieniają się wyłącznie
  identyfikatory.
- **Nie ruszamy niczego, co niesie migrację**: `'RABAT'`, `'planowana'`.
- **Nie utwardzamy niezmienników** (I1–I5) ani nie budujemy agregatu/ACL — to trzy osobne slice'y
  w dół łuku l5.
- **Nie re-litygujemy rozłączenia kosztorysu v2 od marży** (parked P5) ani dozwolonego ujemnego salda
  rejestru (świadoma decyzja klienta, git `76dd757`).
- **Nie ma backfillu ani shima** — dane kosztorysu są throwaway do dogfoodingu na `main`.

## Implementation Approach

### Rename jest type-aware, nigdy tekstowy

Sterownikiem jest zmiana symbolu (tsserver rename albo ts-morph), a bramką `pnpm typecheck`.
ast-grep i grep zostają narzędziami **read/verify** — potwierdzają, że po rename'ie nie ma trafień —
i nigdy nie prowadzą przepisania. Powód jest zmierzony: ~30% trafień tekstowych to stringi
i komentarze, które mają zostać.

### Rodzina na commit

Każda faza 2–6 to jeden commit, jedno pojęcie, zielony `tsc`. Szew B2 (faza 4) siedzi osobno, bo
błędna nazwa kosztuje tam najwięcej — pomylenie płaszczyzn. Faza 5 siedzi osobno, bo **nie jest
rename'em**: zmienia sygnatury i kasuje jedną nazwę, więc zasługuje na własny punkt cofnięcia.

### Q4 — jak konkretnie „ujednolicić trzy figury"

Trzy figury dają na widoku klienta **ten sam złoty**:

```
laborCostsNet + rabatClientNet
  = (doneNet − globalRabatNet) + (globalRabatNet + itemRabatNet)
  = doneNet + itemRabatNet            // = sumaPracNet, settlement-client-totals.ts:66
  = Σ(net + discount)                 // = executedWorkNetPreRabat, :83
```

Ale równe są **tylko tam**. `executedWorkNetPreRabat` jest celowo widoko-agnostyczny i celowo bez
doliczania rabatu globalnego z powrotem — podwykonawcy należy się jego cena niezależnie od ustępstwa
dla klienta. Na `w_tools`/`no_tools` przy aktywnym rabacie globalnym te liczby się rozjeżdżają.

Jedna nazwa nad obiema stwierdzałaby więc równość fałszywą poza widokiem klienta. Dlatego
ujednolicenie ma kształt: **jedna nazwa na figurę, osobna nazwa na operację sumowania**.

- `laborCostsNetPreDiscount(laborCostsNet, discountAmount)` — tożsamość arytmetyczna, płaszczyzno-agnostyczna.
- `sumSectionSubtotalsNet(subtotals)` — sumowanie sekcji, bo to jest inna operacja.
- Oracle parity woła kompozycję obu i dalej mówi prawdę na każdym widoku.

Ryzyko wykonawcze jest niskie: `executedWorkNetPreRabat` ma **zero wywołań produkcyjnych** (jego
docblock `:79-81` to potwierdza — subcontractor summary przeszedł na `subcontractorDueByPlane`),
importują go wyłącznie trzy pliki testowe. Awaria byłaby głośna i przed commitem.

### Q6 — `registerBalance` vs `balance`

Rodzina kasowa dostaje przedrostek `register*`; `balance` zostaje zarezerwowane dla figury
inwestycji, która już tak się nazywa i ma taką kolumnę w DB. Odwrotny wybór przemianowałby poprawną
nazwę i rozjechał kod ze schematem.

## Phase 1: Fundament — glosariusz i destylacja

### Overview

Kod nie może być przepisywany do autorytetu, który sam kłamie. Ta faza nie dotyka `src/`.

### Changes Required

#### 1. `context/domain/02-glossary.md`

Dopisać ruling'i zapadłe 2026-08-15: `discountAmount` bez sufiksu płaszczyzny (typ `SummaryReadingT`
JEST przełącznikiem płaszczyzny); `laborCostsNetPreDiscount` + `sumSectionSubtotalsNet`;
`remaining` / `dueNet` bez sufiksu; `saldo → registerBalance*`, `bilans → balance`;
`sumaPrac → laborCostsNet` z sufiksem `FromKosztorys`/`FromTransactions` wyłącznie na szwie.

Dopisać sekcję **guardrail DB** — nazwy, których rename wymagałby migracji i które z tego powodu
zostają polskie: wartość `'RABAT'` w `enum_transactions_type`, `'planowana'` w `InvestmentStatusT`.

Skorygować mapę App↔Code tam, gdzie opisuje stan sprzed EX-650/EX-536/EX-675.

#### 2. `context/domain/01-domain-distillation.md` — regeneracja od zera

Bramka 3 z `change.md`. Zastosować prompt `.claude/prompts/m4l5-1-domain-distillation.md` **na kodzie**
przy HEAD, nie łatać istniejącego pliku. Musi odzwierciedlać pięć plików po `settlement.ts`, brak
`zaliczki.ts` i to, że strata dziś dotyka bilansu.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm lint` przechodzi (dokumenty nie ruszają kodu — sanity)

#### Manual Verification:

- [ ] Każda decyzja Q4/Q5/Q6/Q9 ma w glosariuszu jedno zdanie „dlaczego", nie tylko mapowanie
- [ ] Destylacja nie zawiera tezy „strata nie dotyka bilansu"

---

## Phase 2: `sheet-import` — rodzina `Robocizna`

### Overview

Najtańszy wysokowartościowy cel: 11 nazw, 8 plików, zero persystencji, żadnego kontaktu ze szwem
rekoncyliacji. Pięć z nich to hybrydy zakazane wprost regułą 3 AGENTS.md.

### Changes Required

| dziś                       | →                               | plik                      |
| -------------------------- | ------------------------------- | ------------------------- |
| `resolveRobocizna`         | `resolveLaborColumns`           | `resolve-columns.ts:179`  |
| `ResolvedRobociznaT`       | `ResolvedLaborColumnsT`         | `resolve-columns.ts:53`   |
| `RobociznaFailureT`        | `LaborColumnsFailureT`          | `resolve-columns.ts:51`   |
| `resolvedRobocizna`        | `resolvedLaborColumns`          | `build-import-plan.ts:98` |
| `parseRobocizna`           | `parseLaborTab` (+ nazwa pliku) | `parse-robocizna.ts:82`   |
| `ParsedRobociznaT`         | `ParsedLaborTabT`               | `parse-robocizna.ts:25`   |
| `ImportGridsT.robocizna`   | `laborGrid`                     | `read-sheet.ts:30`        |
| `robociznaGid`             | `laborTabGid`                   | `read-sheet.ts:33`        |
| `robociznaFormulas`        | `laborGridFormulas`             | `read-sheet.ts:35`        |
| `robociznaTitle`           | `laborTabTitle`                 | `read-sheet.ts:73`        |
| `MissingRobociznaTabError` | `MissingLaborTabError`          | `read-sheet.ts:46`        |
| `rabat` (local)            | `discountFraction`              | `parse-robocizna.ts:136`  |

Wartość `ROBOCIZNA_TAB` i każdy literał matchera **zostają** — to dane arkusza.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm typecheck`
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import`
- [ ] `grep -rn "Robocizn" src/lib/kosztorys/sheet-import` zwraca wyłącznie stringi i komentarze

---

## Phase 3: `summary-economics`, aliasy SQL, `wydatki`

### Overview

Największa objętościowo faza czystego rename'u, bez kontaktu ze szwem. Tu też przechwytujemy kolizję
„ta sama nazwa, dwie rzeczy" na `robocizna`/`materialy`.

### Changes Required

#### 1. `src/lib/kosztorys/summary-economics.ts`

`computeDoZaplatyRM` → `computeAmountDue`; pola `robocizna` → `laborCostsNet`, `materialy` →
`materialsBilled`, `doRozliczeniaNet` → `outstandingNet`, `resztaGross` → `remainderGross`,
`doZaplatyGross`/`doZaplatyNet` → `amountDueGross`/`amountDueNet`; local `prace` w `combinedPair`
→ `labor`.

#### 2. Powierzchnie panelu

`doZaplaty` (prop, `summary/settlement-groups.ts:17`) → `amountDue`; `wykonaneNet`
(`tabs/summary-stages-tab.tsx:20`) → `executedNet`; `sumaPrac`/`sumaPracMismatch` →
`laborCostsPair`/`laborCostsMismatch`; `rabat`/`rabatMismatch`/`showRabat` →
`discount`/`discountMismatch`/`showDiscount`; `RabatValueField` → `DiscountValueField` (+ plik);
`applyPercentRabatSchema` → `applyPercentDiscountSchema` (+ plik);
`applyPercentRabatToAllItemsAction` → `applyPercentDiscountToAllItemsAction`;
`handleApplyPercentRabat` → `handleApplyPercentDiscount`.

`costTotalsPieSlices(robocizna, materialy)` → `(laborCostsNet, materialsBilled)`; stringi `name:`
slice'ów zostają.

#### 3. Aliasy SQL

`rabat_client_net` / `suma_prac_net` / `global_rabat_net` (`src/lib/db/kosztorys-client-totals.ts:86-88`)
→ `discount_net_from_kosztorys` / `labor_costs_net_from_kosztorys` / `global_discount_net`.
To aliasy, nie kolumny — zero migracji.

#### 4. Rodzina `Wydatki` i materiały

`WydatkiDatasetT` → `ExpenseDatasetT`, `WydatkiPartitionT` → `ExpensePartitionT`,
`partitionWydatkiRows` → `partitionExpenseRows`, `availableWydatkiDatasets` →
`availableExpenseDatasets`, `wydatkiRowHref` → `expenseRowHref`.
`MaterialyBreakdownRowT` → `MaterialsBreakdownRowT`, `buildMaterialyBreakdown` →
`buildMaterialsBreakdown`, `materialyBreakdown` → `materialsBreakdown`, `isBruttoMaterial` →
`isGrossMaterial`, `totalRabat` → `totalDiscount`.

#### 5. Nazwy niosące polski string

`wplatyNoun` → `depositNoun`, `praceNoun`/`sekcjeNoun` → `itemNoun`/`sectionNoun` — **payload
pozostaje polski**, zmienia się tylko identyfikator.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm typecheck`
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts`
- [ ] `pnpm test:integration` (aliasy SQL są odczytywane przez specki DB-backed)

#### Manual Verification:

- [ ] Panel Podsumowanie renderuje te same złotówki co przed zmianą (wiersze Robocizna / Rabat /
      Łącznie / Pozostało do zapłaty)

---

## Phase 4: Szew B2 — rename płaszczyzn

### Overview

Jedyne miejsce, gdzie zła nazwa myli płaszczyzny zamiast tylko brzydko wyglądać. Czysty rename,
osobny commit, żeby dał się cofnąć bez reszty.

### Changes Required

| dziś                                             | →                             | uzasadnienie                                                                   |
| ------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------ |
| `sumaPracNet` (`settlement-client-totals.ts:18`) | `laborCostsNetFromKosztorys`  | bliźniak istniejącego `laborCostsNetFromTransactions` (`reconciliation.ts:33`) |
| `rabatClientNet` (`:22`)                         | `discountNetFromKosztorys`    | druga porównywana figura                                                       |
| `investmentRabat` (`kosztorys/types.ts:164`)     | `discountNetFromTransactions` | wejście recon `reconciliation.ts:35`                                           |
| `globalRabatNet` (`:27`)                         | `globalDiscountNet`           | jedna płaszczyzna → bez sufiksu                                                |
| `itemRabatNet` (`:62`)                           | `itemDiscountNet`             | jw.                                                                            |
| `rabat` (pole werdyktu, `reconciliation.ts:24`)  | `discount`                    | jw.                                                                            |
| `rabatAmount` (`summary-reading.ts:16`)          | `discountAmount`              | **bez sufiksu** — `SummaryReadingT` jest przełącznikiem płaszczyzny            |

Sufiks wisi wyłącznie tam, gdzie obie płaszczyzny realnie się zderzają. Powieszony wszędzie
przestaje ostrzegać.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm typecheck`
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- [ ] `pnpm test:parity`

#### Manual Verification:

- [ ] Blok rekoncyliacji na stronie inwestycji pokazuje ten sam werdykt co przed zmianą — zarówno
      przy zgodności, jak i przy rozjeździe

---

## Phase 5: Q4 — ujednolicenie figury pre-rabat

### Overview

**Nie rename.** Zmiana kształtu API: dwie funkcje o różnych sygnaturach opisujące (na jednym widoku)
tę samą figurę schodzą do jednej nazwy figury plus osobnej nazwy operacji. Osobny commit = czysty
punkt cofnięcia.

### Changes Required

#### 1. `src/lib/kosztorys/summary-economics.ts`

`sumaPracPreRabat(laborCostsNet, rabatAmount)` → `laborCostsNetPreDiscount(laborCostsNet, discountAmount)`.
Docblock zachowuje istniejące uzasadnienie („Robocizna pokazywana pre-rabat, rabat jako własny wiersz
odliczenia poniżej") — to rationale, nie szum.

#### 2. `src/lib/kosztorys/settlement-client-totals.ts`

`executedWorkNetPreRabat(subtotals)` → `sumSectionSubtotalsNet(subtotals)`, zwracające `Σ(net + discount)`.
Docblock musi powiedzieć wprost, czego ta funkcja **nie** robi: nie dolicza rabatu globalnego
z powrotem, więc poza widokiem klienta nie równa się `laborCostsNetPreDiscount` policzonemu na
płaszczyźnie klienckiej. To zdanie jest jedyną obroną przed regresją, którą ta faza wprowadza.

#### 3. Trzy pliki testowe

`subcontractor-due-by-plane.test.ts:66,234,251`, `kosztorys-settlement.test.ts:169,177,184,189,190`,
`summary-economics.test.ts:526-556` — oracle woła kompozycję `laborCostsNetPreDiscount` nad
`sumSectionSubtotalsNet` zamiast trzeciej nazwy tej samej figury.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm typecheck`
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/subcontractor-due-by-plane.test.ts src/__tests__/lib/kosztorys/kosztorys-settlement.test.ts src/__tests__/lib/kosztorys/summary-economics.test.ts`
- [ ] `pnpm test:parity`

---

## Phase 6: `saldo` → `registerBalance`

### Overview

16 nazw / 144 wystąpienia, w całości poza kosztorysem. Semantycznie zero ryzyka, objętościowo druga
co do wielkości faza. Wchodzi do zakresu, żeby guard dało się włączyć z kompletem rdzeni za jednym
razem, a nie w dwóch podejściach.

### Changes Required

`getRegisterSaldo` (`queries/register-saldo.ts:10`) → `getRegisterBalance`;
`useSaldo`/`saldo`/`setSaldo`/`isSaldoLoading`/`setIsSaldoLoading`/`fetchSaldo`/`resetSaldo`
(`components/forms/hooks/use-saldo.ts:5-27`) → `useRegisterBalance` / `registerBalance` /
`setRegisterBalance` / `isRegisterBalanceLoading` / … (+ nazwa pliku);
`saldoColor`/`SaldoDisplay`/`SaldoDisplayPropsT` (`components/ui/saldo-display.tsx:7,13,20`) →
`registerBalanceColor` / `RegisterBalanceDisplay` / `RegisterBalanceDisplayPropsT` (+ plik);
`SaldoSummary`/`SaldoSummaryPropsT` (`forms/form-components/saldo-summary.tsx:4,10`) → analogicznie
(+ plik); `totalSaldo` (`dashboard/user-register-stats.tsx:26`) → `totalRegisterBalance`;
`readSaldo`/`readSaldoStable` (`e2e/helpers.ts:56,66`) → `readRegisterBalance`/`readRegisterBalanceStable`.

Domyślny string `label = 'Saldo'` **zostaje**.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm typecheck`
- [ ] `pnpm test:integration`
- [ ] `grep -rn "aldo" src e2e` zwraca wyłącznie polskie stringi

---

## Phase 7: Resztki, unie stringowe i włączenie guarda

### Overview

Domknięcie i definition of done.

### Changes Required

#### 1. Resztki

`etapFirst` → `stageFirst`, `maxEtap` → `maxStage`, klucz kolumny `rabat` → `discount`, local `rabat`
→ `discountFraction` (`src/scripts/seed-investment-from-sheet.ts:55,98,60,129`,
`seed-kosztorys.ts:118`). `headerMarkPrzedmiar`/`headerMarkPomiar` **zostają** (Category A).

Fixture `etapQty` (`__tests__/fixtures/kosztorys-sheet/header-blocks.ts:9`, 154 wystąpienia) →
`stageQty`. Transkrybowany polski nagłówek w wartości **zostaje verbatim** — to dane arkusza.

Nazwy testowe: `bilans`/`marza`/`materialy`/`wydatkiInwestycyjne`
(`__tests__/settled-vs-unsettled-expense.test.ts:31-35`), `detailBilans`
(`investment-render-parity-db.test.ts:142`), `postRabatNet`, `rabatNet`, `wplaty`, `lacznie`,
`withRabat`, `_originalRabat`, `createItemWithRabat`, `itemRabat`, `nettoDoc`, `sumaPracNet`
(`e2e/investments-listing-kosztorys.spec.ts:16`). `withoutPomiarHeader` **zostaje** (A).

#### 2. Unia stringowa — martwy punkt guarda

`SectionPieBaseT = 'przedmiar' | 'wykonane'` (`chart-slices.ts:47`) — **nieutrwalana**, więc rename
jest darmowy. Reguła działa na `Identifier`, więc literałów nie widzi; to jedyne miejsce, gdzie polska
unia stringowa jest realnym typem domenowym, a nie danymi arkusza. Zmienić na `'planned' | 'executed'`
i odnotować martwy punkt w komentarzu guarda.

#### 3. Odkomentowanie guarda

`eslint.config.mjs` — tablica `DOMAIN_DRIFT`, reguła i blok config wracają do życia. Lista rdzeni
rośnie z 9 do **21**:

```
bilans marza rabat zaliczk wplat wyplat robocizn strata etap        (dziś)
saldo sumaPrac materialy doZaplaty wydatki reszta doRozliczenia
lacznie prace wykonan netto brutto                                   (dochodzą)
```

`zaliczk`, `strata`, `wyplat` mają dziś zero trafień — wchodzą jako czysta regresja.
`kosztorys`, `przedmiar`, `pomiar` **nie wchodzą** — to Category A.

Blok config: `files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts']`, `ignores: ['src/migrations/**']`.
Rozszerzenie o `e2e/` jest konieczne — tam mieszkają `readSaldo` i `sumaPracNet`.

Usunąć znacznik `TODO(EX-548)` z obu komentarzy; zostawić samo uzasadnienie reguły.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm lint` — zielony z **aktywną** regułą (DoD)
- [ ] `pnpm typecheck`
- [ ] `pnpm test` + `pnpm test:parity`

#### Manual Verification:

- [ ] Wprowadzenie testowego `const rabatFoo = 1` w `src/` wywala `pnpm lint` — guard faktycznie łapie

---

## Testing Strategy

Ten slice nie dodaje zachowania, więc nie dodaje testów jednostkowych poza fazą 5. Bramką jest
istniejąca siatka:

- **`pnpm typecheck`** — właściwa bramka rename'u. Type-aware rename plus zielony `tsc` to dowód
  kompletności, którego grep nie daje.
- **`pnpm test:parity`** — golden master całego zbioru; łapie każdą zmianę liczby, gdyby faza 5 albo 4
  przesunęła cokolwiek poza nazwami.
- **`pnpm test:integration`** — pokrywa aliasy SQL (faza 3) i rodzinę salda (faza 6).
- **Faza 5 jest jedyną, która owe test disposition**: `no automated test` po stronie nowych asercji,
  bo trzy istniejące pliki oracle'a pokrywają obie ścieżki; zmienia się ich wywołanie, nie zakres.

E2E: zmiana nie jest browser-level (żaden string UI się nie rusza), więc **nie owe** własnego spec'a.
`e2e/helpers.ts` jest dotknięty wyłącznie rename'em symboli.

## Migration Notes

Zero migracji. Blast radius zweryfikowany jako pusty: żaden przemianowywany identyfikator nie jest
kolumną, polem Payload ani kluczem utrwalonego JSON-a. Dwie nazwy, które migrację by niosły
(`'RABAT'`, `'planowana'`), są jawnie poza zakresem i lądują w glosariuszu jako guardrail.

## Whole-tree Gate

Przed archiwizacją: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:parity && pnpm test:integration`.

## References

- `context/changes/kosztorys-terminology/research.md` — pomiar na `Identifier`, pełna klasyfikacja per
  identyfikator (appendix), §7 kolejność napraw, §8 kolizje nazw, §10 czego wymaga guard
- `context/changes/kosztorys-terminology/decisions.md` — ruling'i Q1–Q9 + re-weryfikacja 2026-08-15
- `context/changes/kosztorys-terminology/change.md` — trzy nienegocjowalne bramki
- `AGENTS.md` → „Naming a financial figure" (4 reguły + wyjątek plane-suffix)
- Linear **EX-548**

## Progress

### Phase 1: Fundament — glosariusz i destylacja

#### Automated

- [x] 1.1 `pnpm lint` — 24de9993 (bramka całodrzewowa, uruchomiona raz na końcu)

### Phase 2: `sheet-import` — rodzina `Robocizna`

#### Automated

- [x] 2.1 `pnpm typecheck` — 45d78dcf
- [x] 2.2 specki `sheet-import` — 45d78dcf
- [x] 2.3 weryfikacja grepem: zero identyfikatorów `Robocizn` — 45d78dcf

### Phase 3: `summary-economics`, aliasy SQL, `wydatki`

#### Automated

- [x] 3.1 `pnpm typecheck` — f1a429c3
- [x] 3.2 `summary-economics.test.ts` — f1a429c3
- [x] 3.3 `pnpm test:integration` — f1a429c3

### Phase 4: Szew B2 — rename płaszczyzn

#### Automated

- [x] 4.1 `pnpm typecheck` — 01d01408
- [x] 4.2 specki `lib/kosztorys/` — 01d01408
- [x] 4.3 `pnpm test:parity` — 01d01408

### Phase 5: Q4 — ujednolicenie figury pre-rabat

#### Automated

- [x] 5.1 `pnpm typecheck` — 33bc7aca
- [x] 5.2 trzy pliki oracle'a — 33bc7aca
- [x] 5.3 `pnpm test:parity` — 33bc7aca

### Phase 6: `saldo` → `registerBalance`

#### Automated

- [x] 6.1 `pnpm typecheck` — f4086127
- [x] 6.2 `pnpm test:integration` — f4086127
- [x] 6.3 weryfikacja grepem: zero identyfikatorów `aldo` — f4086127

### Phase 7: Resztki, unie stringowe i włączenie guarda

#### Automated

- [x] 7.1 `pnpm lint` z aktywną regułą — 24de9993
- [x] 7.2 `pnpm typecheck` — 24de9993
- [x] 7.3 `pnpm test` + `pnpm test:parity` — 24de9993
