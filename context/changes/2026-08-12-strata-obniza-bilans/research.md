---
date: 2026-08-13T11:15:37+02:00
researcher: Claude (Opus 5)
git_commit: 9d0054380cd7be731b27fa3391e7e5791c3f21c1
branch: konradantonik/ex-675-strata-obniza-dlug-klienta-jak-rabat-pozostajac-osobna
repository: wykonczymy
topic: 'Strata obniża bilans jak rabat — co ta zmiana dotyka po EX-555/557/680'
tags: [research, codebase, transfers, loss, balance, margin, kosztorys-v2, settlement, vat]
status: complete
last_updated: 2026-08-13
last_updated_by: Claude (Opus 5)
---

# Research: strata-obniza-bilans (EX-675) na kodzie po EX-555

**Date**: 2026-08-13T11:15:37+02:00
**Researcher**: Claude (Opus 5)
**Git Commit**: `9d005438` (staging zmergowane do gałęzi EX-675 na potrzeby tego researchu)
**Branch**: `konradantonik/ex-675-strata-obniza-dlug-klienta-jak-rabat-pozostajac-osobna`
**Repository**: wykonczymy

## Research Question

`change.md` powstał **przed** EX-555 i sam się oznaczył jako „Blocked on EX-555". EX-555, EX-557
i EX-680 przepisały dokładnie te funkcje, które ta zmiana rusza. Pytanie: **co dziś, na
zmergowanym staging, naprawdę trzeba tknąć, żeby strata obniżała dług klienta w face value —
i gdzie ta zmiana policzy coś dwa razy albo skłamie po cichu?**

## Summary

**Cztery ustalenia, w kolejności ważności.**

**1. EX-555 nie tknęło żadnej z dwóch formuł.** `calculate-balance.ts` i `calculate-margin.ts` są
bajt w bajt takie, jak przed EX-555 (ostatni commit ich dotykający to `a500703a`, EX-596). To, co
zmieniło EX-555, to **wejście** do nich: nowa warstwa `summary-reading.ts` podmienia
`totalLaborCosts` / `totalRabat` w obiekcie financials **zanim** obie formuły go dostaną. Blokada
z `change.md` była realna, ale wyparowała bez śladu w samych formułach — plan można pisać wprost
na dzisiejszym kształcie.

**2. Zmiana ma dwie połowy, nie jedną, i druga jest tą, którą łatwo przeoczyć.** `+ totalLoss`
w `calculateBalance` rusza **listing**. Bilans na v1 stronie inwestycji **nie jest**
`calculateBalance` — to suma kafelków z `buildFinancialFields`, a strata została z nich wykluczona
**świadomie** w czerwcowej specyfikacji. Bez kafelka Strata listing i szczegół się rozjadą, a
`investment-render-parity-db.test.ts:141` zaświeci na czerwono z komunikatem, który nie wygląda na
związany ze zmianą. To nie jest bug do obejścia — to jest druga połowa tej zmiany.

**3. Trzecia powierzchnia — v2 / podsumowanie — jest osobnym problemem, i jest też widoczna dla
klienta.** `computeDoZaplatyRM` / `computeMixedSettlement` nigdy nie widzą `financials`. Strata
musi tam wejść jako **własny wiersz odliczenia**, bo nie ma wiersza w kosztorysie. Ale payload
podglądu klienta (`preview-kosztorys.ts:64-75`) **celowo nie zawiera `financials`** — to bramka
ADMIN/OWNER na zakładkę Marża. Więc strata musi tam pojechać jako **osobny skalar `totalLoss`**,
nigdy przez poluzowanie tej bramki (inaczej wypłaty i marża wyciekną do RSC payloadu klienta).

**4. Face value = jedna linijka, której NIE wolno napisać.** `grossBalance` odejmuje
`vatRate × (totalLaborCosts − totalRabat)`. Rabat tnie bazę VAT, bo „zrabatowana złotówka nigdy
nie była zafakturowana". Strata w face value **nie może** tam wejść — i **nie musi**, bo `+totalLoss`
siedzi już w `balance` i przechodzi na brutto nietknięta samo z siebie. Dodanie `totalLoss` do
`grossBalance` to jedyny naturalny odruch symetrii z rabatem, i to dokładnie ten odruch, który
złamie ustalenie właściciela (1000 zł straty warte 1230 zł długu).

**Czego research nie potwierdził:** nigdzie w repo nie ma reguły brzmiącej „żadna figura
transakcyjna nie tnie bazy VAT figury kosztorysowej" — `change.md:68` cytuje ją jako rozstrzygnięcie.
Najbliższa istniejąca reguła (EX-555 `plan.md:100-105`) mówi coś węższego: netto i brutto muszą być
grossowane **tą samą parą**, z której zbudowano netto. Wniosek dla straty wychodzi ten sam, ale
uzasadnienie jest inne i warto to poprawić w `change.md`, żeby nie cytować własnego wniosku jako
źródła.

## Detailed Findings

### 1. Plaszczyzna transakcyjna — `calculateBalance` / `calculateMargin`

Dzisiejsze formuły:

```ts
// calculate-balance.ts:8-13
balance = totalIncome − (totalMaterialCosts + totalLaborCosts) + totalRabat + materialsNetDiscount

// calculate-margin.ts:15-21
margin  = totalLaborCosts − totalPayouts − totalRabat − totalLoss − totalSettled − materialsNetDiscount
```

`totalLoss` powstaje w `investment-financials.ts:107` (`sumBucket(rows, 'loss')`) i ma **jednego**
konsumenta liczącego: `calculate-margin.ts:19`. Wszystkie pozostałe użycia to render.

Co EX-555 faktycznie zmieniło — `summary-reading.ts:50-59` (`financialsOnReading`) podmienia
w obiekcie **tylko** `totalLaborCosts` i `totalRabat`; `totalLoss` przelatuje nietknięty. Docblock
`:42-46` mówi wprost, dlaczego podmiana siedzi w obiekcie, a nie w parametrach: „switch przekazany
jako parametr da się podać jednej formule i zapomnieć przy drugiej".

**Trzy różne bilanse, trzy różne ścieżki:**

| Powierzchnia                      | Skąd bilans                                     | Plik                                                              |
| --------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| Listing inwestycji                | `calculateBalance(financialsOnReading(...))`    | `shape-investments.ts:29-44`                                      |
| Strona inwestycji v1              | **Σ kafelków**, nie `calculateBalance`          | `map-category-costs.ts:104-146` → `toggle-stat-buttons.tsx:33-38` |
| Podsumowanie v2 / podgląd klienta | `computeDoZaplatyRM` / `computeMixedSettlement` | `summary-economics.ts:143-216`                                    |

Niezmiennik spisany w kodzie — `map-category-costs.ts:133-135`: _„The header's bilans is the SUM of
these tiles, so every term of `calculateBalance` owes one, or the two readings drift apart."_
Egzekwuje go `investment-render-parity-db.test.ts:141-146`.

### 2. Płaszczyzna v2 / rozliczenie

`computeDoZaplatyRM` (`summary-economics.ts:143-156`) i `computeMixedSettlement` (`:185-216`)
nie dostają `financials` w ogóle — budują się z `laborCostsNet`, `materials`, `depositsTotal`,
`vatRate`.

**Precedens face value już istnieje i nazywa się wpłata.** `faceValue(net)` (`:17-19`) zwraca
`{ net, gross: net }`. W trybie mieszanym `paidNet` schodzi z **obu** osi tym samym groszem
(`:195` i `:200`), a `paidGross` z obu figur zamykających (`:201`, `:214`) — komentarz `:211-213`
mówi to wprost: „Wpłaty brutto enter at FACE VALUE, not de-grossed". Wiersz Wpłaty renderuje się
jako `faceValue(-depositsTotal)` z `span: true` (`settlement-groups.ts:44-50`) — jedna komórka na
oba tory. **To jest dokładnie kształt, który strata ma skopiować.**

Kontrprzykład, którego kopiować nie wolno: wiersz Rabat, `settlement-summary.tsx:88` —
`moneyPair(-rabatAmount, vatRate)`, czyli **grossuje**.

`SettlementRowT` (`summary-totals-table.tsx:16-30`) nie potrzebuje nowego pola; `span: true` jest
istniejącą flagą „jedna wyśrodkowana komórka przez oba tory". Jedyny wyjątek: `linkToDeposits`
(`:68-77`) hardkoduje `DEPOSIT_TYPES` — drill-down do transferów LOSS wymagałby uogólnienia
(`linkTypes`), a nie reużycia.

### 3. `LOSS` jako typ i wymagana inwestycja

Wiersz specyfikacji (`constants/transfers.ts:157-167`) **nie wymaga żadnej zmiany**:
`financialBucket: 'loss'`, `billedAmount: 'amount'`, `sourceRegister: 'never'` zostają.

Cała powierzchnia „inwestycja wymagana" to **jedna tablica**: `REQUIRES_INVESTMENT_TYPES`
(`:441-447`). `showsInvestment('LOSS')` jest już `true` (`INVESTMENT_TYPES:435`), więc gałąź
zerująca w `validate.ts:78-80` nie jest w ogóle dotykana — to **odwrotność** pułapki EX-557.

**Pułapka, która jednak jest.** `validate.ts:67` czyta `d.investment` **bez fallbacku na
`originalDoc`**, w przeciwieństwie do `type` linijkę wyżej (`:33`). Dwie żywe ścieżki
częściowej aktualizacji na tym polegną po flipie:

- `actions/transfers.ts:311-315` — `data: { invoice: next }`, nic więcej
- `actions/transfers.ts:252-265` — edit rozsypuje `parsed.data`, gdzie `investment` jest `undefined`
  przy pustym pickerze (`edit-transfer-form.tsx:81`)

Anulowanie jest bezpieczne (`validate.ts:47-49` wychodzi wcześniej).

Druga rzecz: `expense-form.tsx:162` wysyła `investment` **bezwarunkowo**, bez bramki
`showsInvestment` — inaczej niż formularz wpłaty (`deposit-form.tsx:99-109`). Reset przy zmianie
typu (`:230-246`) przywraca default zasianą z URL, nie czyści. To znana lekcja
(`lessons.md:1090-1102`).

Anulowanie w agregatach: **każdy** SQL sumujący LOSS ma `cancelled IS NOT TRUE`
(`sum-transfers.ts:159, 170, 271, 433`). Nic nie zapomina.

Jedna asymetria, którą flip **likwiduje**: LOSS bez inwestycji jest niewidoczna dla
`sumAllInvestmentFinancials` (`WHERE investment_id IS NOT NULL`, `:158`), ale **liczy się**
w `/raporty` przez `sumFilteredByType` (`:433`, brak predykatu). Dziś to udokumentowana intencja
(`investment-financials-and-discount.md:115`); po flipie klasa znika.

Nazewnictwo: `loss` / `LOSS` / `totalLoss` jest kanoniczne (`context/domain/02-glossary.md:50`),
`strata*` to drift do zbicia. **W `src/` nie ma ani jednego identyfikatora `strata*`** — wszystkie
trafienia to polskie stringi UI i angielskie komentarze.

### 4. Poprzednia decyzja, którą ta zmiana odwraca

`context/reference/superpowers/archive/2026-06-11-loss-strata-transfer-type.md` — „bilans nietknięty"
było **celowe i nośne**, powtórzone trzy razy, i jest **jedyną** różnicą behawioralną między LOSS
a RABAT (`:7`). Zostało przypięte testem napisanym specjalnie w tym celu (`:235-249` →
`calculate-balance.test.ts:45-55`), a wykluczenie z `buildFinancialFields` też jest osobną
świadomą decyzją (`:387`).

Uzasadnienie natomiast to **jedno zdanie, nigdy nierozwinięte**: „strata to koszt firmy, nie koszt
inwestora". Żadnego przykładu, żadnego cytatu właściciela, żadnego rozważenia przypadku, który
`change.md` opisuje (strata wpisana **właśnie po to**, żeby klient nie płacił). Odwracamy więc
decyzję świadomą, ale słabo uzasadnioną — i to jest uczciwe postawienie sprawy w planie.

Dokument projektowy, do którego ta specyfikacja się odwołuje (`:11`), **już nie istnieje** w repo.

### 5. Napięcie, którego repo nie rozstrzyga

`investment-financials-and-discount.md:97-105` — materiały są **pass-through, VAT w cenie**
(„materiał to koszt, który klient zwraca w cenie brutto", odrzucone dwa razy). Skoro strata na
inw. 62 pokrywa dwa wydatki materiałowe, ten akapit **niezależnie** prowadzi do face value.
To wzmacnia ustalenie właściciela z 2026-08-12, ale drugą ścieżką — warto to mieć w planie jako
niezależne potwierdzenie, nie jako to samo źródło.

## Code References

**Musi się zmienić — płaszczyzna transakcyjna**

- `src/lib/db/calculate-balance.ts:10-12` — `+ financials.totalLoss`; nagłówek `:3-7` wylicza dziś tylko rabat i `materialsNetDiscount`
- `src/lib/db/calculate-margin.ts:5` — komentarz „never touches bilans" staje się fałszem; formuła bez zmian
- `src/lib/db/map-category-costs.ts:109-141` — **kafelek Strata** (`LOSS_LABEL` obok `:17-20`), inaczej listing ≠ szczegół
- `src/components/investments/financial-stats.tsx:119-128` — dzisiejszy samodzielny kafelek Strata jest **poza** sumą toggle; musi trafić do `CREDIT_LABELS` (`:59-62`) i `incomeRow` (`:96-101`), inaczej figura renderuje się dwa razy
- `src/components/investments/financial-stats.tsx:50-56` — tooltipy cytują obie formuły verbatim

**Musi się zmienić — płaszczyzna v2**

- `src/lib/kosztorys/summary-economics.ts:143-156` — `computeDoZaplatyRM`, odjąć od `.net` **i** `.gross` w `:155`
- `src/lib/kosztorys/summary-economics.ts:185-216` — `computeMixedSettlement`, lustrzanie do `paidNet`: `:195` i `:200` (nie `paidGross`)
- `src/lib/kosztorys/summary-economics.ts:158-175` — pole w `MixedSettlementT`
- `src/components/kosztorys/summary/settlement-groups.ts:15-20, 39-61, 69-121` — wiersz `{ label: 'Strata', line: faceValue(-lossTotal), discount: true, span: true }`
- `src/lib/kosztorys/types.ts:146-180` — `totalLoss: number` na `KosztorysEditorDataT`, **wymagane, nie opcjonalne**
- `src/lib/queries/preview-kosztorys.ts:64-75` — `fetchWholeInvestmentFinancials` jest już awaitowane w `:53`; brakuje tylko projekcji

**Wolno NIE ruszać (i lepiej nie)**

- `src/lib/kosztorys/summary-economics.ts:107-114` (`grossBalance`) — **żadnego członu `totalLoss`**
- `src/lib/queries/shape-investments.ts:44, 61-66` — dziedziczy zmianę bez edycji
- `src/lib/kosztorys/summary-reading.ts:13-16` — strata **nie wchodzi** do `SummaryReadingT`
- `src/lib/kosztorys/reconciliation.ts:114-140` — nie wciągać straty do `rabatClientNet`; bramka `nothingBooked` (`:131`) klucza po stronie transakcji i **nie** uciszyłaby fałszywego alarmu
- `src/lib/kosztorys/summary-economics.ts:249-261` (`bucketDepositsByPlane`) — LOSS nie ma `vatPlane`

**Proza, która staje się nieprawdą**

`calculate-balance.ts:3-7` · `calculate-margin.ts:5` · `summary-reading.ts:4-12` ·
`summary-margin-tab.tsx:33-35` · `sheets-sync.ts:125-127` („An investment-less transfer (LOSS
allows that)…") · `financial-stats.tsx:45, 49-56` ·
`investment-financials-and-discount.md:82-86, 111-116, 127-129` · `AGENTS.md:216` (traci całą klauzulę
kontrastu — po zmianie LOSS i RABAT są arytmetycznie identyczne, więc `:215` też wymaga przecelowania)

## Architecture Insights

- **Trzy bilanse, trzy mechanizmy, jeden niezmiennik.** Listing liczy formułą, v1 sumuje kafelki,
  v2 sumuje wiersze rozliczenia. Każda z tych powierzchni musi dostać stratę **własnym** sposobem —
  to jest lekcja `lessons.md:1048` („dwie powierzchnie czytające tę samą figurę źle to nie zawsze
  ta sama usterka") w czystej postaci.
- **`faceValue` vs `moneyPair` to jest ta decyzja.** Cała reguła VAT-owa tej zmiany sprowadza się
  do wyboru jednego z dwóch primitives w każdym miejscu, gdzie strata się pojawia. Wpłata to wzorzec,
  rabat to antywzorzec.
- **Bramka `financials` jest bramką uprawnień, nie wygodą.** Podgląd klienta jej nie dostaje,
  bo w środku są wypłaty, marża i materiały wliczone w robociznę. Strata idzie obok niej.
- **`span: true` nie jest kosmetyką.** Bez niego face-value figura drukuje identyczne netto i brutto,
  co czyta się jako para, która przypadkiem się zgadza — a nie jedna figura na oba tory.

## Historical Context (from prior changes)

- `context/reference/superpowers/archive/2026-06-11-loss-strata-transfer-type.md:5, 7, 104, 235-249, 387`
  — decyzja odwracana przez tę zmianę, wraz z testem, który ją przypina, i wykluczeniem z kafelków
- `context/archive/2026-08-12-ex-555-write-switch-labor-rabat/plan.md:100-105` — reguła spójności
  pary VAT (najbliższa istniejąca reguła, węższa niż to, co cytuje `change.md:68`); `:107-111` —
  klucz cache **bumpuje się**, nie re-taguje, gdy payload financials się poszerza
- `src/lib/constants/transfers.ts:425-427` — ocalałe rozstrzygnięcie EX-557: typ na poziomie firmy
  z inwestycją „silently move that investment's bilans". To jest precedens dla pytania „który typ
  może ruszać figurę klienta", na które EX-675 odpowiada twierdząco dla LOSS
- `context/foundation/lessons.md:349` — test strzegący STAREJ definicji idzie w tautologię, gdy
  definicja się zmienia; `:1048` — dwie powierzchnie, dwie usterki

## Powierzchnia testowa

**(a) Przypina STARE zachowanie — przepisać na czerwono jako pierwsze**

| Plik                                                            | Co przypina                                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/__tests__/calculate-balance.test.ts:45-55`                 | **Ten** test decyzji: `totalLoss: 1500` → balance `5000`. Ma być `6500`, z odwróconym tytułem |
| `src/__tests__/transfer-loss.test.ts:17-20`                     | `requiresInvestment('LOSS') === false`                                                        |
| `src/__tests__/transfer-constants.test.ts:81-90`                | Zawartość `REQUIRES_INVESTMENT_TYPES`; pada głośno, nie po cichu                              |
| `src/__tests__/fixtures/financial-golden-master.json:893, 1318` | inw. 62 (`balance -362.84`) i inw. 98 (`balance -39`) → oba `0`                               |

**(b) Pójdzie w tautologię albo zaświeci z mylącego powodu**

- **`investment-render-parity-db.test.ts:141-146` — najniebezpieczniejszy plik tej zmiany.**
  Nie pójdzie w tautologię, pójdzie **na czerwono z powodem, który nie wygląda na związany**:
  listing się ruszy, suma kafelków nie. Naprawą jest kafelek Strata, nie poluzowanie porównania.
- `investment-render-parity-db.test.ts:157-160` — `bilans brutto`. **Tu** jest tautologia: test
  sprawdza, że dwa call-site'y `grossBalance` się zgadzają, nigdy **która płaszczyzna jest właściwa**.
  Zostanie zielony, cicho odpowiadając „face value" na pytanie o VAT.
- `src/__tests__/lib/kosztorys/summary-economics.test.ts` — 40+ przypadków, **ani jeden o stracie**.
  Po dodaniu wiersza odliczenia wszystkie zostają zielone, przetestowawszy wyłącznie ścieżkę
  `strata = 0`. To największa realnie niepokryta powierzchnia.
- `derive-financials-bucketing.test.ts:79-82` — bucketing, nietknięty. Plik, który sprawia, że
  zmiana **wygląda** na pokrytą, choć `deriveFinancials` nigdy nie dotyka bilansu.
- `map-category-costs.test.ts:19` — `totalLoss: 0` w fixture, zero przypadków kafelka Strata.

**(c) Bez pokrycia w ogóle**

`transfer-schema.test.ts` i `validate-hook.test.ts` — **ani jednego odniesienia do LOSS**, obie
jadą po ręcznych mapach (`:48` / `:34-52`). Połowa „inwestycja wymagana" ma **zerowe pokrycie na
obu ścieżkach egzekwowania** (`transfer-validation.ts:48-52` klient, `validate.ts:67-69` serwer).
E2E: `grep -rn "Strata\|LOSS" e2e/` — pusto.

**Dane testowe: są.** `dumps/dump-latest.sql` ma 6 wierszy LOSS, wszystkie z inwestycją: żywe
3298 (362,84 / inw. 62 — dokładnie kształt defektu z `change.md`), 3737 (39 / inw. 98),
4470 (142,65 / inw. 47); anulowane 3× (inw. 63 ×2, inw. 121).

**Ale golden master nie jest strażnikiem tej zmiany.** Tylko 2 ze 109 inwestycji w fixture mają
niezerowy `totalLoss` (62 i 98 — LOSS inw. 47 jest **nowsza niż fixture**, więc jej hash się nie
zgadza i jest **pomijana**, `financial-golden-master-db.test.ts:316-333`, cicho poza `console.warn`).
Podłoga staleness (`:378-386`) odpala dopiero powyżej połowy pominiętych — daleko. Gdyby inw. 62
albo 98 dostała nową transakcję przed wdrożeniem, cała zmiana bilansu przechodzi na zielono nie
porównawszy niczego. Golden master to **diff do przejrzenia**, nie strażnik.

Realny strażnik: przepisany `calculate-balance.test.ts` + fixture w kształcie inw. 62
(2 nierozliczone `INVESTMENT_EXPENSE` = 362,84 + `LOSS` 362,84, robocizna 0, wpłaty 0) →
**bilans 0, marża −362,84**, plus przypadki face-value w `summary-economics.test.ts` na wzór
istniejącego `:330` („credits wpłaty brutto at face value").

## Open Questions

1. **Czy `/raporty` ma pokazywać bilans z `+ totalLoss`?** Strona renderuje `buildFinancialFields`
   (`raporty/page.tsx:67, 72`), więc kafelek pojawi się tam **automatycznie**. Agregat idzie przez
   `sumFilteredByType` (`sum-transfers.ts:414-438`), które **nie** filtruje po `investment_id` —
   więc dopóki flip „inwestycja wymagana" nie wejdzie, raport zsumuje też straty bez inwestycji,
   których żaden bilans inwestycji nie widzi. `WarningBanner` (`raporty/page.tsx:60-73`) już ostrzega
   przed tą klasą rozjazdów. Po flipie klasa znika — ale **kolejność w planie ma znaczenie**.
2. **Czy `validate.ts:67` dostaje fallback na `originalDoc`?** Bez niego flip psuje dwie ścieżki
   częściowej aktualizacji (`actions/transfers.ts:311-315` i `:252-265`). To poprawka jednolinijkowa,
   ale zmienia zachowanie edycji dla **wszystkich** typów wymagających inwestycji, nie tylko LOSS.
3. **Wiersz w torze fakturowym trybu mieszanego** — czy „Rozliczenie fakturą" dostaje własny wiersz
   Strata, czy przepisujemy hint przy „Pozostało brutto" (`settlement-groups.ts:109`)? Bez jednego
   z dwóch tor brutto drukuje figurę, której czytelnik nie odtworzy z wierszy powyżej.
4. **`change.md:68` cytuje regułę, której w repo nie ma.** Wniosek (face value) jest poprawny
   i wsparty niezależnie przez `investment-financials-and-discount.md:97-105`, ale zdanie „no
   transaction figure ever cuts the VAT base of a kosztorys figure" należy przeformułować albo
   oznaczyć jako wniosek tej zmiany, nie jako zastane ustalenie.
5. **Klucz cache financials** — czy poszerzenie payloadu podglądu o `totalLoss` wymaga bumpa
   (EX-555 `plan.md:107-111`)? Do sprawdzenia przy planowaniu, nie przy implementacji.
