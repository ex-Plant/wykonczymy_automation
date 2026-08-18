---
date: 2026-08-18T08:38:54+02:00
researcher: Claude (Opus 5)
git_commit: 1ba173a7dc66b0bc3ce5b8dd8c8923edc50d1dc9
branch: staging
repository: wykonczymy
topic: 'Zakładka „Marża" — prognoza z przedmiaru obok marży rzeczywistej, obie z kosztorysu (EX-649)'
tags: [research, codebase, kosztorys, margin, subcontractor-due, summary-panel]
status: complete
last_updated: 2026-08-18
last_updated_by: Claude (Opus 5)
---

# Research: dwie marże — prognoza z przedmiaru obok marży rzeczywistej

**Date**: 2026-08-18T08:38:54+02:00
**Researcher**: Claude (Opus 5)
**Git Commit**: `1ba173a7dc66b0bc3ce5b8dd8c8923edc50d1dc9`
**Branch**: `staging`
**Repository**: wykonczymy

## Research Question

Co w kodzie, w testach i w dokumentacji trzeba ruszyć, żeby zakładka „Marża" pokazywała dwie
figury — prognozę liczoną z przedmiaru (scenariusz z narzędziami / bez narzędzi) obok marży
rzeczywistej z wykonanych prac — przy czym „wypłaty" zastępuje kwota należna podwykonawcom liczona
z kosztorysu, a „obniżka materiałów" wypada z formuły.

## Summary

Cztery rzeczy decydują o kształcie planu.

**1. Formuła ma jeden argument i nie ma w nim miejsca na kosztorys.** `calculateMargin`
(`src/lib/db/calculate-margin.ts:16`) to sześć składników jednego obiektu `InvestmentFinancialsT`.
Należne podwykonawcom jest per-etap × per-płaszczyzna i nie ma w tym typie żadnej reprezentacji, a
`financialsOnReading` (`src/lib/kosztorys/summary-reading.ts:51`) — jedyny istniejący szew do
podmiany źródła — podmienia dokładnie dwa nazwane pola i nic więcej. Drugi składnik prognozy
(przedmiar wyceniony stawką podwykonawcy) **nie istnieje nigdzie w kodzie**: oba agregaty świadomie
odmawiają liczenia przedmiaru poza widokiem inwestora (`sectionSubtotalsForView` zwraca
`plannedNet: null`, `columnTotalsForRows` tak samo).

**2. Zasięg zmiany w UI jest mniejszy, niż wygląda — ale nie tam, gdzie się wydaje.** Zakładka
„Marża" jest wyłączona jedną linijką (`summary-panel-content.tsx:186`, `TODO(EX-649)`), więc dziś
marża ma **dwie żywe powierzchnie**: kolumna „Marża" na liście inwestycji i blok v1 na stronie
inwestycji. Za to lista inwestycji jest problemem architektonicznym: należne podwykonawcom liczy się
dziś wyłącznie po stronie klienta (`subcontractorDueByPlane`, `use-kosztorys-editor.ts:335`) z
całego drzewa, a lista ma na to jednorzędowy fold SQL, bo drzewa to 10 MB przy 200 inwestycjach i
49 MB przy 1000. Kosztorysowe należne na liście = drugi fold SQL, albo regres wydajności.

**3. Zmiana definicji nie wysadzi testów — część z nich po cichu zzielenieje.** Osiem asercji
padnie głośno (to dobrze). Ale `investment-render-parity-db.test.ts:147` liczy obie strony **tą
samą funkcją**, więc dla marży jest już blisko tautologii i przejdzie bez względu na nową formułę —
chyba że lista i widok szczegółów zaczną brać należne z dwóch różnych źródeł (SQL vs TS), czyli
dokładnie ten dryf, przed którym ta parytetówka miała chronić. `shape-investments.test.ts:351`
(„wypłaty bez robocizny, która by je pokryła") ma pułapkę: naiwna poprawka na `0` czyni asercję
nieodróżnialną od „mapa nie znalazła kosztorysu". A golden master hashuje wejścia bez osi
podwykonawcy — po zmianie edycja płaszczyzny etapu ruszy marżę bez ruszenia hasha i strażnik zacznie
kłamać na pre-push.

**4. Prognoza „z narzędziami / bez narzędzi" to kształt, który raz już wyprodukował błąd.**
`domain-notes:595-604` opisuje bramkę rozliczenia: suma należnych w widoku z/bez jest **hipotezą**,
nigdy nie zestawianą z realnym PAYOUT (to jest ten 78 033 vs 56 431). change.md już to respektuje
(„scenariuszem … nie widełkami") — plan musi to utrzymać w nazewnictwie i w układzie tabeli.

## Detailed Findings

### Formuła i jej konsumenci

`calculateMargin` (`src/lib/db/calculate-margin.ts:16`):

```ts
f.totalLaborCosts -
  f.totalPayouts -
  f.totalDiscount -
  f.totalLoss -
  f.totalSettled -
  f.materialsNetDiscount
```

Cztery produkcyjne miejsca wywołania:

| #   | Miejsce                        | Powierzchnia                                   | Źródło                                               |
| --- | ------------------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| 1   | `shape-investments.ts:64`      | kolumna „Marża" na `/inwestycje` (ADMIN/OWNER) | kosztorys (robocizna+rabat), reszta z transakcji     |
| 2   | `inwestycje/[id]/page.tsx:100` | blok v1 → `FinancialStats`                     | wyłącznie transakcje, celowo                         |
| 3   | `raporty/page.tsx:71`          | agregat wszystkich inwestycji                  | transakcje; `materialsNetDiscount` = 0 z konstrukcji |
| 4   | `summary-margin-tab.tsx:47`    | zakładka „Marża" (**wyłączona**)               | kosztorys przez `financialsOnReading`                |

`FinancialStats` nigdy nie przelicza — dostaje gotową liczbę (`financial-stats.tsx:70-72`), ale
zawiera zahardkodowany opis formuły w tooltipie (`:56-58`), który zdezaktualizuje się pierwszego dnia.

**Konsekwencje usunięcia dwóch składników:**

- `materialsNetDiscount` ma jeszcze trzech konsumentów i wszyscy przeżywają, ale **bilans dodaje go z
  powrotem** (`calculate-balance.ts:17`). Dziś ten składnik jest dwustronny — po zmianie staje się
  jednostronny: podnosi bilans i nie obniża niczego. To jest świadoma decyzja do zapisania, nie
  skutek uboczny. Pole musi zostać w `InvestmentFinancialsT` (bilans go potrzebuje).
- `totalPayouts` zostaje w czterech innych miejscach — w tym w **sąsiedniej kolumnie „Wypłaty" na tej
  samej liście**. Po zmianie lista pokaże „Wypłaty" (Σ PAYOUT) obok „Marży", która ich już nie
  zawiera: dwie sąsiadujące kolumny z dwóch płaszczyzn, bez niczego, co by to mówiło. To jest
  najbardziej widoczna konsekwencja zmiany.

### Prymitywy wyceny — na czym stoją obie marże

- **Stawka podwykonawcy jest z konstrukcji przed rabatem**: `netForQtyForView` nakłada
  `applyDiscount` tylko gdy `view === 'client'`. Zgodne z regułą EX-554 („cała płaszczyzna
  podwykonawcy jest wolna od rabatu"). Strażnik trzyma stawkę na `0.8 × cena klienta`.
- `subcontractorPrice(row, plane)` czyta rozłączne pary pól per płaszczyzna, a nadpisanie typu
  `'amount'` jest **zamrożoną stawką jednostkową** ignorującą współczynnik. Skutek: przełącznik
  scenariusza nie przelicza takich pozycji — dwa scenariusze przestają być porównywalne wiersz po
  wierszu dokładnie tam, gdzie ktoś wpisał kwotę ręcznie. To jest ta sama sytuacja, którą właśnie
  oflagowaliśmy strażnikiem z EX-708.
- `subcontractorDueByPlane` (`subcontractor-due.ts:39`, jedyne wywołanie produkcyjne
  `use-kosztorys-editor.ts:335`, deps `[rows, stages]`) **pomija etapy bez wybranej płaszczyzny**
  (`:51-56`). Marża rzeczywista jest wtedy zawyżona — dokładnie wtedy, gdy `hasUnconfirmedPlane`.
  W edytorze jest na to ostrzeżenie przy „Podsumowaniu podwykonawców"; przy marży go nie ma, a na
  liście inwestycji nie byłoby nawet komu go pokazać.
- Rabat globalny to płaska `value` nakładana wyłącznie na `doneNet` w `clientTotalsFromSubtotals`,
  nigdy na `plannedNet`. Czy schodzi z prognozy — decyzja jednolinijkowa, dziś nierozstrzygnięta.
- Pozostałe wejścia obu marż są już na reaktywnym kręgosłupie edytora: `plannedNet`
  (`use-kosztorys-editor.ts:565`), `laborCostsNetFromKosztorys`/`doneNet` (`:560`),
  `subcontractorDue.combined` (`:335`).

### Panel podsumowania — gdzie to wyląduje

Pięć zakładek w `SUMMARY_VIEW_OPTIONS` (`summary-panel-content.tsx:36`). Bramka:

```ts
if (value === 'margin') return false // :186, TODO(EX-649)
// sugerowane przywrócenie: return !preview && financials !== undefined
```

Trzy warstwy filtrowania: allowlist hosta (`views`) → `allowedViews` → strażnik renderu (`:333`).
Fallback `view` (`:190`) chroni przed uwięzieniem czytelnika na wyborze zapamiętanym w localStorage.

**Hosty**: edytor (`kosztorys-editor-body.tsx:356`, wszystkie pięć zakładek) i strona inwestycji
(`INVESTMENT_PANEL_VIEWS = ['summary','expenses','margin']` — bez „Robocizny", bo ta czyta kontekst
edytora). Kwoty gatuje się na granicy RSC: `isAdminOrOwnerRole` w dwóch miejscach
(`kosztorys_v2/page.tsx:88`, `inwestycje/[id]/page.tsx:111`).

**Podgląd dla inwestora**: `preview-kosztorys.ts:81` wysyła pełny `financials` bez okrojenia —
udokumentowana i zaakceptowana przez właściciela decyzja (`:25-30`). Zakładkę trzyma poza jego
zasięgiem wyłącznie warunek `preview`. Sugerowane przywrócenie tę postawę zachowuje. **Konsekwencja
dla przełącznika scenariusza**: nie może być czymś, co inwestor sam sobie przestawi — patrz zamek
ujawniania w `use-kosztorys-view-state.ts:22-26,52`, gdzie płaszczyzna jest przypięta pod `preview`
właśnie dlatego, że `localStorage['kosztorys-view:<id>']` jest pisany przez klienta.

**Zakładka dziś**: jedna tabela, dwie kolumny („Marża" | „Kwota"), siedem wierszy `faceValue`, każdy
z podpowiedzią, oś netto. Robocizna i rabat przychodzą **jako propsy** (`SummaryReadingT`), nie z
`financials` — komentarz `:28-35` mówi dlaczego: zakładka czytająca figury transakcyjne pokazywała w
tym samym panelu dwie różne robocizny.

**Ryzyko nakładania się z „Podwykonawcami”**: ta zakładka renderuje już „Suma wykonanej pracy" /
„Zaliczki (wypłaty)" / „Pozostało do wypłaty", gdzie należne jest **rozstrzygnięte per etap** (każdy
etap po swojej stawce). Scenariusz przelicza 100% prac po jednej stawce — to inna liczba. Powtórzenie
tych wierszy w „Marży" postawiłoby dwie różne „wypłaty" dwie zakładki od siebie.

**Precedens dla przełącznika**: `StatsVersionToggle` (`stats-version-toggle.tsx:16-29`) — ten sam
gatunek rzeczy (dwa odczyty jednej liczby), ten sam prymityw `ToggleGroup`, i jest już gotowe
miejsce: `topBarSlot` (`summary-panel-content.tsx:88-89,257`). **Nie** sięgać po `usePersistedEnum` z
kluczem `kosztorys-*` — to jest rodzina, którą zamek ujawniania traktuje jako kontrolowaną przez
atakującego.

### Testy — co padnie, a co zzielenieje po cichu

**Padnie głośno (dobrze):** `calculate-margin.test.ts:25,30,36,43-45,78`;
`investment-financials.test.ts:66` (dedykowany strażnik dwustronności `materialsNetDiscount` — to
jest dokładnie ta niezmienniczość, którą zmiana świadomie niszczy); `shape-investments.test.ts:57,328,351`;
`financial-golden-master-db.test.ts:206` (per inwestycja, wymaga `pnpm test:golden:update` po
`db:import:test` + `seed:kosztorys:test`).

**Zzielenieje po cichu (niebezpieczne):**

- `investment-render-parity-db.test.ts:147` — obie strony przez tę samą `calculateMargin`. Przejdzie
  zawsze, chyba że spec zostanie rozszerzony tak, by obie strony budowały się z **własnych,
  rzeczywistych** źródeł.
- `calculate-margin.test.ts:51,56,71-75` — po przepisaniu będą wyglądać na pokrycie, asertując jeden
  ocalały składnik. `:71-75` staje się w pełni tautologiczne na osi netto.
- `e2e/investments-listing-kosztorys.spec.ts:112-122` — seed tworzy etap **bez płaszczyzny**, więc
  należne wnosi 0 i spec zostaje zielony, przestając pokrywać nowy składnik.
- `summary-reading.test.ts:87-91` („nie rusza żadnej figury przepływu gotówki") — wymaga rozszerzenia,
  jeśli należne pojedzie przez `SummaryReadingT`.

**Golden master — realna pułapka.** Sygnatura wejść (`financial-golden-master-db.test.ts:139-160`)
pokrywa liczbę pozycji, wykonaną ilość i rabat globalny, ale **nie** `kosztorys_stages.plane`,
`worker_id`, współczynników ani nadpisań. Po zmianie edycja którejkolwiek z tych rzeczy ruszy marżę
bez ruszenia hasha → fałszywy raport „dryfu kodu" na pre-push. Oś podwykonawcy musi wejść do tego SQL
w tej samej zmianie.

### Cache

Żadna marża nie jest nigdzie zapisywana ani cache'owana — cache trzyma wejścia, marża liczy się przy
renderze. Dwie rzeczy do zapamiętania:

- `fetchInvestmentFinancials` (`balances.ts:48`, klucz `investment-financials-v2`) — komentarz `:60-63`
  zapisuje precedens: **zmiana kształtu `InvestmentFinancialsT` wymaga bumpu klucza**, inaczej stary
  wpis deserializuje się w nowy kod i marża cicho robi się `NaN`.
- `fetchKosztorysClientTotals` (`balances.ts:89`) — jego tagi **już pokrywają** wszystkie tabele,
  które czytałby fold należnego (`kosztorys_stages` z płaszczyzną i pracownikiem). Nowy fold potrzebuje
  bumpu klucza, ale **żadnego nowego tagu**.

## Code References

- `src/lib/db/calculate-margin.ts:16` — formuła, sześć składników
- `src/lib/db/calculate-balance.ts:17` — bilans dodaje `materialsNetDiscount` z powrotem
- `src/lib/kosztorys/summary-reading.ts:20,33,51` — szew podmiany źródła robocizny/rabatu
- `src/lib/queries/shape-investments.ts:26-27,64` — marża listy
- `src/components/kosztorys/summary/summary-panel-content.tsx:186` — wyłączona zakładka (`TODO(EX-649)`)
- `src/components/kosztorys/summary/tabs/summary-margin-tab.tsx:24-26,47` — zakładka dziś
- `src/lib/kosztorys/subcontractor-due.ts:39-69` — należne per etap × płaszczyzna; `:51-56` pomija etapy bez płaszczyzny
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:335,560,565` — należne, doneNet, plannedNet
- `src/lib/db/kosztorys-client-totals.ts:9-15,35-99` — fold SQL listy + pomiar kosztu drzew
- `src/lib/queries/preview-kosztorys.ts:25-30,81` — `financials` w podglądzie inwestora, bez okrojenia
- `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:22-26,52` — zamek ujawniania
- `src/components/investments/stats-version-toggle.tsx:16-29` — precedens przełącznika w URL
- `src/components/kosztorys/summary/summary-panel-content.tsx:88-89,257` — `topBarSlot`
- `src/__tests__/investment-render-parity-db.test.ts:147` — parytetówka bliska tautologii
- `src/__tests__/financial-golden-master-db.test.ts:139-160` — sygnatura wejść bez osi podwykonawcy
- `src/lib/queries/balances.ts:60-63,81-87` — precedens bumpu klucza; tagi kosztorysu
- `src/components/investments/financial-stats.tsx:56-58` — zahardkodowany opis formuły

## Architecture Insights

- **Jedna figura, jeden obiekt.** `financialsOnReading` istnieje po to, żeby `calculateMargin` i
  `calculateBalance` brały **ten sam** obiekt — inaczej podmiana źródła zostałaby wpięta do jednej
  formuły i zapomniana w drugiej. Nowa figura powinna respektować ten kształt: drugi obiekt
  `SummaryReadingT`-podobny (prognoza), nie poszerzony jeden.
- **Scenariusz to inna oś niż płaszczyzna etapu.** `subcontractorDueByPlane` rozstrzyga płaszczyznę
  per etap; scenariusz wybiera jedną dla wszystkiego. `settlement-client-totals.ts:78-84` nazywa tę
  różnicę wprost i trzyma drugą jako „wyrocznię jednopłaszczyznową".
- **Granica ujawniania jest po stronie renderu, nie payloadu** — świadomie. Wszystko, co nowa zakładka
  doda, musi być liczone z tego, co już jedzie, albo bramkowane tak jak w dwóch hostach RSC.
- **Lista inwestycji jest ograniczeniem wydajnościowym, nie detalem.** Każda kosztorysowa figura na
  liście to fold SQL w Postgresie, plus spec parytetu SQL↔TS (precedens EX-555).

## Historical Context (from prior changes)

Wiąże (rozstrzygnięcia właściciela, nie do cichego odwrócenia):

1. **VAT, 2026-07-26** — materiał to przelotka, **żadnego `+VAT` w marży**; pytane i odrzucone dwa
   razy (`investment-financials-and-discount.md:97-102`). Ginie wyłącznie konsekwencja z `:103-105`
   („ustępstwo materiałowe obniża marżę"). Usunięcie składnika trzeba opisać jako **usunięcie
   składnika**, nigdy jako „firma księguje odzyskany VAT".
2. **EX-555, 2026-08-12** — brak fallbacku, żadna figura nie deklaruje źródła, szew w
   `shapeInvestments` (nie w `deriveFinancials`), v1 = transakcje / v2 = kosztorys. Nowa figura musi
   zadeklarować płaszczyznę: prognoza jest czysto kosztorysowa, rzeczywista staje się hybrydą.
3. **Kosztorys JEST robociznę** (właściciel, 2026-07-16) — nie re-litygować.
4. **EX-551/EX-554, 2026-07-21** — stawka podwykonawcy definiuje należne (przed rabatem, z prac
   wykonanych, w aktywnym widoku); `PAYOUT` je spłaca.
5. **Bramka rozliczenia** (`domain-notes:595-604`) — suma z/bez to hipoteza, nigdy zestawiana z realnym
   PAYOUT.
6. **EX-675** — strata w wartości nominalnej, obie figury, świadomie zaakceptowany double-count z
   `settled`.
7. **Trzy mechanizmy muszą się zgadzać** (`investment-financials-and-discount.md:132-147`) + reguła
   niezależnej wyroczni (`test-plan.md:29-37`).
8. **FR-015 to zapora zapisu** — to pozostaje zmianą odczytu.

Informuje (nieobowiązujące lub nieaktualne):

- `kosztorys-editor-domain-notes.md:208-221` — „Panel plan-vs-actual, z marżą planowaną": najbliższy
  wcześniejszy szkic, ale jego formuły są sprzed EX-555.
- `01-domain-distillation.md:210` i `domain-notes:844-853` — „v2 rozłączony od marży": **nieaktualne**,
  obalone 2026-08-12; do poprawienia w tej zmianie.
- `domain-notes:424-431` — „PAYOUT jest wiarygodniejszy niż ręczna lista": to o **arkuszu**, nie o
  składniku marży; nie cytować jako blokera.
- `context/archive/2026-07-26-materials-net-pricing-persisted/change.md` — historyczne uzasadnienie
  usuwanego składnika; przeczytać raz, nie cytować jako obowiązujące.
- roadmap `:656` pytanie otwarte 12(b) (czy „suma etapu" to figura fakturowa czy wypłatowa) —
  prawdopodobnie rozpuszcza się w tej zmianie.

**Dokumenty do poprawienia, gdy zmiana wyląduje:** `foundation/investment-financials-and-discount.md`
(`:21-23, 47-48, 66, 73, 84-86, 88, 94-95, 103-105, 111-116`), `domain/01-domain-distillation.md`
(`:54, 65-68, 122-124, 190, 210, 221`), `domain/02-glossary.md:53-58` + nowe hasła,
`foundation/prd.md:277` (i przypis przy `:255`), `reference/kosztorys-editor-domain-notes.md`
(`:208-221, 844-853`), `foundation/manual-checks.md:425-440` (martwa sekcja) oraz `:415, 722, 845,
890-902`, `foundation/roadmap.md` (nowy wiersz slice'a / otwarcie pasma 2),
`foundation/test-plan.md` (wiersz ryzyka: zmiana definicji → tautologia).

**Roadmapa**: nie ma slice'a na zakładkę „Marża". Powstała wewnątrz S-11/S-12, oba `done`. EX-649 to
nowy, nienumerowany slice w zamkniętym paśmie. **S-10 `kosztorys-column-rbac`** (`proposed`,
plan-ready) należy ustawić **za** tą zmianą — prognoza, której przełącznik JEST osią z/bez, poszerza
to, co S-10 ma ukrywać po stronie serwera. **S-17** (`deferred`) przeżywa, bo to zmiana odczytu, ale
warto to napisać wprost.

## Open Questions

1. **Czy rabat globalny schodzi z prognozy?** Dziś rabat dotyka wyłącznie prac wykonanych, nigdy
   przedmiaru. Prognoza to oferta — a oferta jest po rabacie albo przed. change.md tego nie
   rozstrzyga.
2. **Co robi przełącznik scenariusza z pozycją, która ma wpisaną ręcznie kwotę?** Nadpisanie
   `'amount'` jest zamrożone i ignoruje współczynnik, więc taka pozycja nie zmienia się między
   scenariuszami. Czy prognoza ma to sygnalizować (jest już do tego strażnik z EX-708), czy milczeć?
3. **Czy nowe figury trafiają na listę inwestycji, czy tylko do panelu?** Jeśli na listę — potrzebny
   drugi fold SQL nad `kosztorys_stages.plane` plus spec parytetu SQL↔TS. Jeśli tylko do panelu —
   kolumna „Marża" na liście zostaje na starej definicji i lista rozjeżdża się z panelem.
4. **Etapy bez wybranego sposobu rozliczenia** — należne je pomija, więc marża rzeczywista jest wtedy
   zawyżona. Ostrzeżenie przy figurze czy wykluczenie z liczenia?
5. **„Obniżka materiałów" po stronie bilansu** — składnik zostaje w bilansie i traci drugą stronę.
   Kafelek na v1 zostaje bez zmian? (reguła domknięcia z `lessons.md:1053-1064`).
6. **Czy `calculateMargin` dostaje nowy argument, czy nową funkcję?** Nowy argument = błąd kompilacji
   we wszystkich czterech miejscach wywołania, czyli najgłośniejszy i najbezpieczniejszy wynik.
