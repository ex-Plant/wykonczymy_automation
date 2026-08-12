---
date: 2026-08-12T12:33:22+0200
researcher: konradantonik
git_commit: 8e14bbbaf8ab63e3247a84b50ce2b953276e95dc
branch: konradantonik/ex-560-przeladuj-z-szablonu
repository: wykonczymy
topic: 'EX-555 — robocizna + rabat z kosztorysu na liście inwestycji; write-switch LABOR_COST/RABAT'
tags: [research, codebase, kosztorys, investment-financials, cache, transfers]
status: complete
last_updated: 2026-08-12
last_updated_by: konradantonik
---

# Research: EX-555 — read-switch na liście inwestycji + write-switch typów

**Date**: 2026-08-12T12:33:22+0200
**Researcher**: konradantonik
**Git Commit**: 8e14bbbaf8ab63e3247a84b50ce2b953276e95dc
**Branch**: konradantonik/ex-560-przeladuj-z-szablonu
**Repository**: wykonczymy

## Research Question

Po decyzjach właściciela z 2026-08-12 (`change.md`): jak dokładnie wygląda powierzchnia zmiany dla
(1) przełączenia źródła robocizny i rabatu na liście inwestycji na kosztorys, oraz (2) ukrycia
`LABOR_COST` i `RABAT` z formularza — przy zachowaniu starych wierszy jako legacy.

## Summary

Research potwierdza obie tezy diagnozy i **podważa jedną z decyzji**.

Co się potwierdziło:

- Write-switch jest chirurgiczny: **jedna tablica, dwie linie** (`constants/transfers.ts:277-278`),
  plus dwa testy. Wszystko inne w tym pliku to routing, layout arkusza albo reguły pól, od których
  zależą wiersze legacy.
- Read-switch na liście dotyka dokładnie czterech kolumn i niczego poza `/inwestycje`.

Co research wywrócił:

- **Materializacja (opcja C) nie ma w tym repo precedensu — ma anty-precedens.** Kolumny
  zmaterializowane istniały i zostały świadomie skasowane cztery dni po dodaniu
  (`src/migrations/20260222_drop_materialized_columns.ts`). Obowiązujący wzorzec to
  compute-on-read + `unstable_cache` + tagi.
- **Nie ma chokepointu na zapisie kosztorysu.** Pięć surowych `INSERT/UPDATE` omija hooki Payloada
  (w tym najgorętszy zapis w aplikacji, `setStageProgressAction`), a panel Payload/REST omija akcje
  serwerowe. Materializacja bez triggera DB jest strukturalnie nieszczelna.
- Istnieje **opcja D**, nierozważana wcześniej: jedno batchowe zapytanie SQL po surowe wiersze
  kosztorysu dla wszystkich inwestycji naraz + istniejąca formuła w TS. Jedna formuła, zero
  staleness, koszt jednego round-tripu. Szczegóły niżej.

Dwie decyzje projektowe, których nie da się odłożyć do implementacji: **wybór szwu** (A czy B) i
**baza VAT w `balanceGross`**.

## Detailed Findings

### 1. Ścieżka odczytu listy

`src/app/(frontend)/inwestycje/page.tsx:16` → `fetchAllInvestments()`
(`src/lib/queries/investments.ts:14-22`) → `fetchInvestmentFinancials()`
(`src/lib/queries/balances.ts:45-66`) → `sumAllInvestmentFinancials`
(`src/lib/db/sum-transfers.ts:144-248`, trzy zapytania w jednym `Promise.all`) → `deriveFinancials`
(`src/lib/db/investment-financials.ts:81-120`) → `shapeInvestments`
(`src/lib/queries/shape-investments.ts:18-74`).

Cała ścieżka jest O(1) zapytań niezależnie od liczby inwestycji. Kosztorys nie jest dotykany.

**Kolumny, które się zmienią** — wyłącznie `/inwestycje`:
„Koszty inwestora" (`tables/investments.tsx:32`), „Bilans netto" (`:40`), „Bilans brutto" (`:46`),
„Marża" (`:54`). Żadna kolumna nie renderuje `totalLaborCosts` wprost — pole jedzie w
`InvestmentRowT` i karmi te cztery. Poza listą `shapeInvestments` konsumuje tylko audyt parity.

**Dashboard nie dotyka finansów w ogóle** (`src/lib/queries/dashboard.ts`) — mock w
`dashboard-aggregation.test.ts:83` to martwe rusztowanie. **Sheets sync też nie** konsumuje
`InvestmentFinancialsT`.

### 2. Cache — dziura, którą trzeba zamknąć w tej samej zmianie

`fetchInvestmentFinancials` jest tagowane **tylko** `[transfers, investments]`
(`balances.ts:65`). Kosztorys nie ma tam żadnego tagu. Efekt po przełączeniu źródła: zmiana
`qtyDone` w edytorze nie unieważnia listy.

Niespójność już istnieje i jest gorsza niż jednolity błąd: część akcji kosztorysowych bumpuje
`'investments'` (`actions/kosztorys.ts:151, 167, 185, 203, 222` — współczynniki, VAT, tryb, rabat
globalny), ale edycje per-komórka nie (`:117` `kosztorysItems`, `:566` `stageProgress`, i kilkanaście
dalszych). Dokładnie te dwie ostatnie ruszają `sumaPracNet`.

**Naprawa jest po stronie czytelnika, nie pisarzy**: dodać `kosztorysItems`, `kosztorysSections`,
`kosztorysStages`, `stageProgress` do listy tagów (`balances.ts:65`) — wzorem
`preview-kosztorys.ts:22-32`, które już tak robi. Wszystkie akcje zapisu już te tagi bumpują.

Konsekwencja kosztowa: każdy debounce'owany autosave w edytorze wygasza agregat całej listy. Przy
`deferRefresh: true` to samo wygaszenie, nie re-render — ale następny wjazd na `/inwestycje` płaci
pełne przeliczenie.

**Klucz `unstable_cache`**: `['investment-financials-v2']` (`balances.ts:60`) → **`-v3`**, jeśli
payload zmieni kształt (`lessons.md:992`). Analogicznie `['reference-data-v2']`
(`reference-data.ts:152`), jeśli `InvestmentRefT` dostanie np. `hasKosztorysRows`.

Komentarz `actions/kosztorys.ts:100-106` („jedynym cache'owanym czytelnikiem tych tagów jest link
share") staje się fałszywy w chwili przełączenia. To komentarz, nie test — nic tego nie zgłosi.

### 3. Ścieżki zapisu kosztorysu — brak chokepointu

Figury zależą od: `client_price`, `discount_type/value` (per item), `stage_progress.qty_done`,
istnienia etapu, przynależności do sekcji, oraz `investments.global_discount_type/value`.
`vat_rate`, współczynniki narzędziowe, `settlement_mode`, `materials_net_rate`, `hidden_in_export`
— **nie wpływają**. Widok `client` nie filtruje etapów po `plane` (`settlement-view.ts:16`), więc
`plane`/`label`/`worker` też nie.

Ścieżki, które ruszają figury: `updateItemFieldAction` (`actions/kosztorys.ts:108`),
`updateInvestmentGlobalDiscountAction` (`:207`), `applyPercentRabatToAllItemsAction` (`:230`,
**surowy SQL** `:244-248`), `removeSectionAction` (`:278`), `removeItemAction` (`:415`),
`removeStageAction` (`:517`), `setStageProgressAction` (`:547`, **surowy SQL** `:558-563`).

Hurtowe: `reloadFromPresetAction` (`kosztorys-presets.ts:165`), `appendPresetSectionsAction`
(`:103`), `restoreSnapshotAction` (`kosztorys-snapshots.ts:62`), `applyKosztorysImport`
(`kosztorys-import.ts:93`), `createInvestmentAction` → `seedInvestmentFromPreset`
(`actions/investments.ts:38`, **best-effort — seed może paść, a inwestycja i tak powstanie**).
Wszystkie trzy pierwsze schodzą do `restore-kosztorys.ts:12` (wipe + `insertKosztorysTree`).

Undo/redo **nie jest osobnym miejscem zapisu** — jest w całości po stronie klienta
(`use-kosztorys-editor.ts:69-89`) i odgrywa te same akcje. Item nigdy nie zmienia sekcji — nie ma
akcji przenoszenia.

**Trzy warstwy, żadna nie łapie wszystkiego:**

1. `protectedAction` (`run-action.ts:34`) — auth/perf/revalidacja, **nie dostaje `investmentId`**
   (`updateItemFieldAction` ma tylko `itemId`, `setStageProgressAction` `itemId`+`stageId`).
2. `withPayloadTransaction` — tylko 6 miejsc, żadne z per-komórkowych.
3. Hooki kolekcji — jedyna warstwa łapiąca też panel Payloada/REST, ale omija ją **pięć surowych
   SQL**: `actions/kosztorys.ts:244`, `:558`, `insert-rows.ts:99` i `:126`,
   `insert-kosztorys-tree.ts:96` i `:120`. Do tego hurtowe ścieżki przekazują
   `{ skipRevalidation: true }` (`revalidate-collection.ts:21`) — hook-owy recompute nie może być
   za tą flagą.

Panel Payloada/REST: każdy MANAGER+ może PATCH-ować `clientPrice`, `globalDiscountValue`,
POST/DELETE `stage-progress`. Odpalają się tylko hooki, a te wołają wyłącznie `revalidateTag`.

### 4. Anty-precedens materializacji

- `src/migrations/20260218_add_investment_financials.ts:4-8` — dodaje `investments.total_income`
  + `labor_costs`.
- `src/migrations/20260222_drop_materialized_columns.ts:4-12` — kasuje `cash_registers.balance`,
  `investments.total_costs`, `investments.total_income`. **Cztery dni później.**
- `recalcAfterChange` (`hooks/transfers/recalculate-balances.ts:9-11`) **nic nie zapisuje** — jego
  własny komentarz mówi, że salda liczą się na odczycie. (Zapis w AGENTS.md o „przeliczaniu sald
  hookami" jest nieaktualny.)

Dodatkowo: `investments.updated_at` jest **tokenem rewizji edytora**
(`kosztorys-tree.ts:118-120`). Zapis kolumny na `investments` bumpuje go przy każdej edycji
kosztorysu — trzeba sprawdzić, co to robi z detekcją nieświeżej rewizji.

Gdyby jednak materializować: kolumny wiszą na `investments` (tam już są oba pola rabatu globalnego,
1:1 z figurą, wiersz i tak jest joinowany). Migracje hand-written, wzorzec
`20260726_4_add_materials_net_rate_to_investments.ts`, rejestracja ręcznie w
`src/migrations/index.ts:400-404`.

### 5. Opcja D — batchowy odczyt zamiast materializacji

Nierozważana przy wyborze C. Kształt: jedno zapytanie w `src/lib/db/` zwracające surowe wiersze
kosztorysu (items + `stage_progress` + sekcje + rabat globalny) **dla wszystkich inwestycji naraz**,
potem istniejące `sectionSubtotalsForView` → `clientTotalsFromSubtotals` w TS per inwestycja.

- **Formuła jedna** — te same funkcje co panel. Znika ryzyko „two-planes-both-green", które
  wykluczyło opcję B.
- **Zero staleness** — nie ma czego przeliczać, więc żadna z siedmiu ścieżek zapisu ani panel
  Payloada nie może rozjechać figury. Znika cały problem z §3.
- **Zero migracji, zero backfillu, zero triggera.**
- Koszt: jeden round-trip. `kosztorys-tree.ts:17-25` notuje, że na Neonie liczy się liczba
  round-tripów, nie wierszy (5 odczytów = 101-178 ms, 1 wiersz = 83-119 ms). Dziś to 3 491 wierszy
  / 12 inwestycji; docelowo ~30 tys. Naiwna pętla per-inwestycja (~109 round-tripów) jest
  wykluczona — ale batch nią nie jest.
- Ryzyko do zmierzenia w planie: czas mapowania ~30 tys. wierszy w JS na każde wygaszenie cache'a.

Porównanie z C: C kupuje szybszy odczyt ceną kolumny, która **musi** być przeliczana w siedmiu
miejscach plus panel Payloada, w repo bez ani jednego precedensu na taki wzorzec i z jednym
udokumentowanym cofnięciem. D kupuje prostotę ceną jednego zapytania.

### 6. Szew — decyzja A vs B

**Szew A — wewnątrz `deriveFinancials`** (`investment-financials.ts:104,106`): lista i strona
szczegółów lecą razem.

**Szew B — wewnątrz `shapeInvestments`**: zmienia się tylko lista.

Szew A **zabija instrument uzgodnienia**. `investment-summary-panel.tsx:91-96` podaje do
`buildKosztorysReconciliation` wprost `financials.totalLaborCosts` i `financials.totalRabat` jako
stronę „actual". Jeśli to staną się `sumaPracNet`/`rabatClientNet`, komparator dostaje tę samą
liczbę po obu stronach i `mismatch` jest strukturalnie zawsze `false`. Pięć testów „reconciles
silently" (`reconciliation.test.ts:90,97,113,135,142`) zostaje na zielono, testując `x === x`.

To samo dotyczy `summary-reading.ts`: `readingFromTransactions` to dosłownie
`totalLaborCosts − totalRabat`. Nakarm je figurami z kosztorysu, a stanie się bajt w bajt tożsame
z `readingFromKosztorys` — `summary-reading.test.ts:36` degeneruje się do tożsamości algebraicznej.

Szew B zachowuje instrument, ale **lista i strona szczegółów zaczynają legalnie się nie zgadzać** —
a `investment-render-parity-db.test.ts` jest zbudowany po to, żeby tego zakazać. Do tego lista
pokaże marżę liczoną ze strony, o której krzyk uzgodnienia mówi „niezweryfikowana".

Niezależnie od szwu: `investment-summary-panel.tsx:91-96` musi zostać przypięte do obiektu
finansów **wyłącznie transakcyjnego**, a test red-first musi udowodnić, że figura z kosztorysu tam
nie wchodzi.

### 7. `balanceGross` — ukryta zmiana bazy VAT

`shape-investments.ts:55-60` karmi `grossBalance(balance, vatRate, totalLaborCosts, totalRabat)`.
Komentarz `:51-54` **wprost uzasadnia**, że bazą VAT dla bilansu zbudowanego z transferów jest
robocizna z płaszczyzny transferów, bo „płaszczyzny są rozłączne z mocy obowiązującego
rozstrzygnięcia".

Przełączenie pól cicho przenosi bazę VAT na drugą płaszczyznę. To zmiana zachowania, o którą nikt
nie prosi, schowana w tej samej edycji. Albo przekazać figury transakcyjne jawnie, albo zmienić
płaszczyznę świadomie i przypiąć testem red-first. Test `shape-investments.test.ts:169-196` musi
zostać przepisany tak czy inaczej.

### 8. Write-switch — czysta edycja i trzy furtki

**Edycja**: skasować `'LABOR_COST'` (`constants/transfers.ts:277`) i `'RABAT'` (`:278`) z
`TRANSACTION_TRANSFER_TYPES`. Jedyny konsument tej tablicy to `expense-form.tsx:250`.
Plus `transfer-constants.test.ts:245-256` (pin exact-array, twardy fail) i
`transfer-rabat.test.ts:27` (`toContain('RABAT')` → `.not.toContain`).

**Czego NIE ruszać** — wszystko poniżej jest nośne dla legacy:

| Eksport | Linia | Dlaczego |
| --- | --- | --- |
| `TRANSFER_TYPES` | `:2-16` | union, enum Payloada, filtry, `z.enum` |
| `TRANSFER_TYPE_SPECS` | `:135-156` | `financialBucket`, `transfersSheetTab` |
| `TRANSFER_TYPE_LABELS` | `:247` | tabela, CSV, **kryterium SUMIF w arkuszu** (`sheet-configs.ts:85`) |
| `SHEET_TRANSFER_TAB_TYPES` | `:292-298` | bez tego legacy przestaje się synchronizować i zostaje sierotą w arkuszu klienta |
| `TRANSFERS_SUMMARY_TYPES` | `:323-330` | **layout zamrożony** — sloty 2 i 3 |
| `INVESTMENT_TYPES` (prywatne) | `:423, :427` | usunięcie → `validate.ts:75-77` **zeruje `investment` na 89 wierszach legacy przy pierwszej edycji** |
| `REQUIRES_INVESTMENT_TYPES` | `:438-439` | osłabia walidację edycji legacy |
| `isLaborCost` | `:466` | `updateTransferAction` (`actions/transfers.ts:246`) pozwala edytować kwotę tylko dla `LABOR_COST` |

Uwaga na `roles.ts:39` — `transferType === 'LABOR_COST' && isManagementRole(role)` daje MANAGER-owi
prawo anulowania cudzych wierszy `LABOR_COST`. Nośne dla „legacy dalej daje się anulować".

Filtr tabeli (`transfer-filters.tsx:121`) czyta `TRANSFER_TYPES`, więc **sam z siebie zachowuje oba
typy** — nie „porządkować" go na `TRANSACTION_TRANSFER_TYPES`.

Warstwa walidacji jest bezpieczna: `validate.ts:33` cofa się do `originalDoc.type`, wszystkie reguły
jadą po predykatach, a `editExpenseFormSchema` (`expense-schema.ts:190-203`) **nie ma pola `type`**.

**Trzy furtki, które zostają otwarte** i wymagają rozstrzygnięcia właściciela (albo zapisania jako
zaakceptowane, wzorem EX-557 pkt 6):

1. **Panel Payloada** (`collections/transfers.ts:26-27`) — własna lista opcji, a asercja
   wyczerpania `:42-46` uniemożliwia usunięcie wpisów bez ruszania uniona. Dostęp
   `isAdminOrOwner`.
2. **Akcje serwerowe** — `z.enum(TRANSFER_TYPES)` (`schemas/transfer.ts:19`,
   `expense-schema.ts:136`) dalej przyjmują oba typy z zewnątrz.
3. **Draft w sessionStorage** (`expense-form.tsx:124-126`, `create-form-store.ts:12-24`) —
   użytkownik z otwartą sesją i draftem `type: 'LABOR_COST'` dostanie tę wartość z powrotem: Select
   wyrenderuje się pusty, a formularz i tak wyśle `LABOR_COST` (serwer przyjmie, patrz 2). Naprawa:
   koercja nieznanego typu do `'INVESTMENT_EXPENSE'` przy odtworzeniu albo bump nazwy store'a.

### 9. Testy — co pęka, co zgnije po cichu

Wzorzec do zapamiętania: **ani jeden spec w `src/__tests__` nie karmi `shapeInvestments` ani
`calculate*` inwestycją, która ma wiersze kosztorysu.** Każdy fixture w tym obszarze to inwestycja
wyłącznie transakcyjna, czyli gałąź fallbacku. Cały suite przejdzie na zielono, testując wyłącznie
starą definicję (`lessons.md:342` + `:1020`).

**Pęka / do przepisania:**

- `shape-investments.test.ts:47-51` — najważniejszy spec w obszarze; nie ma ani jednego przypadku
  z kosztorysem.
- `shape-investments.test.ts:169-196` — `balanceGross`, patrz §7.
- `sum-transfers.test.ts:109-144` i `:256-299` — `toEqual` na całym obiekcie; przy szwie A pękają.
  Uwaga: łańcuch `mockResolvedValueOnce` (`:114-126`) — nowe zapytanie w tej funkcji zje mock
  przeznaczony dla czegoś innego.

**Zgnije po cichu (zielone, ślepe):**

- `derive-financials-bucketing.test.ts:63-74` + matryca `:106-123` — przypina buckety, których lista
  już nie czyta. Wymaga jawnej zmiany nazwy na „reguła fallbacku" + nowej asercji red-first dla
  gałęzi kosztorysowej.
- `summary-reading.test.ts:22-38` — patrz §6.
- `reconciliation.test.ts:90-150` — patrz §6.
- `financial-golden-master-db.test.ts:170-175` i `investment-render-parity-db.test.ts:125-143` —
  ślepe na tym zbiorze danych, patrz niżej.

**Golden master ma fingerprint, ale nie ten.** `financial-golden-master-db.test.ts:100-137` hashuje
wyłącznie kolumny **transakcji**; `DATASET_FLOOR` (`:200`) to inwestycje/rejestry/transakcje. Zero
sygnału z kosztorysu. Po przełączeniu edycja kosztorysu zgłosi się jako dryf kodu, a nieświeży
odczyt jako nic. Do domknięcia w tej samej zmianie: hash liczby itemów / Σ `qty_done` / rabatu
globalnego per inwestycja.

**Zbiór danych jest pusty na nowej osi.** W `dumps/dump-latest.sql` (12 sierpnia): 109 inwestycji,
3 565 transakcji, **0 `kosztorys_items`, 0 `kosztorys_sections`, 0 `stage_progress`**. Zero
inwestycji ma jednocześnie transakcje i kosztorys. Zielony `pnpm test:parity` po tej zmianie nie
mówi nic o feature'rze — dokładnie `lessons.md:1020`.

To samo dotyczy `src/scripts/audit-investment-parity.ts`. Jego nagłówek (`:3-14`) — „siedem figur
liczonych dwiema niezależnymi ścieżkami, które muszą się zawsze zgadzać" — **staje się fałszywy**
przy szwie B: ścieżki *powinny* się wtedy różnić.

**Ścieżki nie strzeże nic DB-owego na push.** Oba specy dotykające figur są jawnie wyłączone z
`scripts/test-integration.sh:45-47` i siedzą za ręcznym `pnpm test:parity`.

**Jedyny istniejący fixture z obiema płaszczyznami** to `src/scripts/seed-kosztorys-reconciliation.ts`
(`pnpm seed:kosztorys-recon`) — dwie inwestycje z kosztorysem **i** transakcjami `LABOR_COST`/`RABAT`,
jedna zgodna, jedna nie. To najcenniejszy zasób w repo dla tej zmiany i naturalna baza nowych testów.

**E2E**: żaden spec nie czyta figur z `/inwestycje` ani listy typów w formularzu.
`e2e/kosztorys-reconciliation.spec.ts` jest jedynym powiązanym i przy szwie A idzie na czerwono
albo — gorzej — na ślepą zieleń. Jego obejście z klikaniem „Odśwież dane" (`global-setup.ts:37-48`)
to zapowiedź problemu ze staleness z §2 i **nie wolno go skopiować** do nowego testu, bo test
wyprodukuje sobie własną zieleń.

**Brakujący strażnik**: nic nie sprawdza, że figury listy są unieważniane po zapisie kosztorysu.
Kształt: E2E na `seed:kosztorys-recon` — odczytaj marżę na `/inwestycje`, zmień `qtyDone` w
edytorze, wróć **bez** klikania „Odśwież dane", asertuj deltę. Plus tani spec jednostkowy
porównujący zbiór tagów `fetchInvestmentFinancials` z listami rewalidacji w `actions/kosztorys.ts`.

### 10. Kolizja z EX-557

Ten sam plik, rozłączne linie: EX-557 rusza `DEPOSIT_UI_TYPES` (`:271`) i `INVESTMENT_TYPES`
(`:420-431`), EX-555 rusza `:277-278`. W `transfer-constants.test.ts` sąsiadujące hunki (EX-557:
`:68-82`, `:241-243`; EX-555: `:245-256`) — trywialny merge.

Jedno realne zagrożenie semantyczne: **EX-557 wprowadza wzorzec „usuń typ z `INVESTMENT_TYPES`"**.
EX-555 nie może go skopiować dla `LABOR_COST`/`RABAT` — patrz tabela w §8. Naturalna kolejność:
EX-557 pierwszy (ustanawia `forbidsInvestment` i test rejestracji predykatów), EX-555 na nim.

## Code References

- `src/lib/queries/shape-investments.ts:24,37,45,55-61` — punkt aplikacji read-switcha (szew B)
- `src/lib/db/investment-financials.ts:104,106` — narodziny obu figur (szew A)
- `src/lib/queries/balances.ts:60,65` — klucz `investment-financials-v2` i lista tagów bez kosztorysu
- `src/lib/kosztorys/settlement-client-totals.ts:54-70` — jedyna kopia formuły
- `src/lib/kosztorys/summary-reading.ts:19-35` — wspólna reguła obu odczytów
- `src/components/investments/investment-summary-panel.tsx:60-66,91-96` — istniejący switch + karmienie komparatora
- `src/lib/constants/transfers.ts:277-278` — cała edycja write-switcha
- `src/lib/actions/kosztorys.ts:244,558` — surowy SQL omijający hooki
- `src/lib/kosztorys/restore-kosztorys.ts:12` — wspólny rdzeń trzech ścieżek hurtowych
- `src/migrations/20260222_drop_materialized_columns.ts:4-12` — anty-precedens materializacji
- `src/scripts/seed-kosztorys-reconciliation.ts` — jedyny fixture z obiema płaszczyznami

## Architecture Insights

- Repo konsekwentnie wybiera **compute-on-read + tagi** zamiast denormalizacji; jedyna próba w drugą
  stronę została cofnięta po czterech dniach.
- Rozdzielenie `shape-investments.ts` od `queries/investments.ts` jest celowe (`:14-17`): audyt
  parity musi wołać prawdziwy builder wiersza bez wciągania `server-only`. Każdy nowy argument
  `shapeInvestments` musi tę własność zachować.
- Reguła decyzji („są wiersze → kosztorys, nie ma → transakcje") istnieje, ale mieszka **inline w
  panelu**. Jej ekstrakcja do `summary-reading.ts` jest warunkiem, żeby lista i panel nie rozjechały
  się jako dwie kopie reguły.
- Lista tagów rewalidacji deklarowana w każdej akcji kosztorysowej to de facto ręcznie utrzymywany
  spis „wszystkiego, co zmienia stan pochodny kosztorysu" — użyteczny jako zarodek dowolnego
  mechanizmu przeliczania.

## Historical Context (from prior changes)

- `context/changes/2026-08-12-ex-557-legacy-deposit-types/change.md:19-29` — commit `72ddc5d7` zdjął
  `OTHER_DEPOSIT` z jednej listy UI dzień po powstaniu wiersza produkcyjnego; pominięte powierzchnie
  to formularz edycji, panel Payloada i hook walidacji.
- `context/changes/2026-08-12-ex-557-legacy-deposit-types/research.md:44-49,122-133` — pole ukryte
  w JSX to nie pole wyczyszczone; asercja podzbioru przeszła przez regresję na zielono.
- `context/foundation/lessons.md:19, 342, 590, 992, 1020` — cztery reguły, które ta zmiana narusza
  domyślnie, jeśli się ich świadomie nie zaadresuje.

## Open Questions

1. **Szew A czy B** (§6) — decyzja produktowa, nie techniczna: czy strona szczegółów ma przełączyć
   się razem z listą, i co wtedy z krzykiem uzgodnienia.
2. **Opcja D zamiast C** (§5) — czy batchowy odczyt wystarczy wydajnościowo przy ~30 tys. wierszy.
   Wymaga pomiaru, nie dyskusji.
3. **Baza VAT w `balanceGross`** (§7) — przenosimy świadomie czy przekazujemy figury transakcyjne
   jawnie.
4. **Trzy furtki write-switcha** (§8) — hartujemy czy zapisujemy jako zaakceptowane.
5. **`investments.updated_at` jako token rewizji** (§4) — istotne tylko przy wariancie C.
