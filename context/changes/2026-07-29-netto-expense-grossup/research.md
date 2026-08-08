---
date: 2026-07-29T14:27:34+02:00
researcher: Claude
git_commit: e329b12b4e4c38391bce7024e1a9fb8ad25aa584
branch: staging
repository: wykonczymy
topic: 'Wydatek netto — odwrócenie wyliczenia, brutto liczone ze stawki materiałów'
tags: [research, codebase, netto-expense, materials, settlement, vat, bilans]
status: complete
last_updated: 2026-07-29
last_updated_by: Claude
---

# Research: wydatek netto — odwrócenie wyliczenia

## Research Question

Wydatek netto (`INVESTMENT_EXPENSE_NET`) wchodzi dziś do wszystkich figur po face value na obu
osiach (netto === brutto). Propozycja: netto jest daną wejściową, brutto = netto × (1 + stawka).
Co się rusza, co się rozjedzie, i czy ktoś już to rozstrzygnął.

## Summary

**Trzy ustalenia, które zmieniają kształt tego changeu — przeczytaj je przed planowaniem.**

**1. Zapisane brutto to brutto REJESTRU, nie brutto RACHUNKU KLIENTA — to dwie różne
płaszczyzny.** (Rozstrzygnięte przez właściciela, 2026-07-29.) Wiersz `INVESTMENT_EXPENSE_NET`
trzyma dwie kwoty: `amount` = brutto z paragonu, zwykle przy 23%, i `net_amount` = netto po zdjęciu
tej stawki (`src/migrations/20260726_1_add_net_amount_to_transactions.ts:10`).

Firma odzyskuje VAT z paragonu, więc jej realny koszt materiału to **netto**. Inwestycja jest
rozliczana własną stawką (np. 8%), więc inwestorowi wystawiamy **netto + stawka inwestycji**, a nie
paragonowe 23%. Wyliczone brutto nie konkuruje z `amount` — obsługuje inną płaszczyznę.

Konsekwencja dla walidacji `netAmount ≤ amount` (`src/lib/utils/validation.ts:22-33`,
`src/hooks/transfers/validate.ts:106-119`): dopóki doliczana stawka jest niższa od paragonowej,
wyliczone brutto wychodzi poniżej `amount` i reguła trzyma się sama. Przy stawce równej lub wyższej
niż paragonowa przestaje — to brzeg do rozstrzygnięcia w planie, nie blokada.

Konsekwencja dla marży: materiał przestaje być czystym przelotem. Firma płaci netto, wystawia
netto × (1 + stawka) — zarabia dokładnie `netBilled × stawka`. Rozstrzygnięcie z 2026-07-26
(„marża nie dostaje żadnego członu za materiały") zapadło dla przypadku brutto, gdzie przelot był
prawdziwy. Tutaj nie jest.

**1b. Reguła jest funkcją TRYBU ROZLICZENIA, nie obecności koncesji** (właściciel, 2026-07-29).
Stawka doliczana = `materialsNetRate ?? vatRate` — ta sama, co w kolumnie prezentacyjnej.

| tryb         | wydatek brutto        | wydatek netto                      | oś               |
| ------------ | --------------------- | ---------------------------------- | ---------------- |
| **netto**    | `brutto ÷ (1+stawka)` | `netto` face value — **bez zmian** | netto            |
| **mieszany** | `brutto ÷ (1+stawka)` | `netto` face value — **bez zmian** | netto (patrz 1c) |
| **brutto**   | `brutto` z paragonu   | `netto × (1 + vatRate)`            | brutto           |

W danym trybie wszystkie materiały lądują na tej samej osi — sprzeczność „jeden wydatek netto,
drugi brutto w tej samej tabelce" nie powstaje.

**Defekt jest jednomodowy:** przy rozliczeniu brutto wydatek netto jest fakturowany netto, kiedy
wszystkie pozostałe materiały idą brutto. Przy rozliczeniu netto dzisiejszy face value jest
poprawny i nic się nie zmienia.

Ironia implementacyjna: tryb brutto to dokładnie ten, w którym kod dziś **celowo zeruje** stawkę
materiałów (`investment-financials.ts:89`, lustrzane `effectiveNetRate` w
`summary-panel-content.tsx:213`). Doliczana stawka to więc `vatRate`, nie `materialsNetRate` —
koncesja w tym trybie z definicji nie obowiązuje (właściciel, 2026-07-29).

**1c. Tryb mieszany nie wymaga żadnej zmiany** (ustalone 2026-07-29). `computeMixedSettlement`
(`summary-economics.ts:160-184`) grossuje **wyłącznie kwotę jeszcze nierozliczoną**:

```
NETTO:  Robocizna + Materiały = Łącznie netto → − wpłaty netto → Do rozliczenia netto
BRUTTO: Do rozliczenia netto + VAT = Reszta brutto → − wpłaty brutto → Do zapłaty brutto
```

Wpłaty netto (gotówka, bez faktury) osłaniają swoje złotówki przed VAT-em; reszta idzie na fakturę
i tam dostaje VAT. Granica między „bez VAT" a „z VAT" to **suma wpłat oznaczonych jako netto**,
nie procent. Wydatek netto wchodzi do tej puli po netto i jeśli trafi na fakturę, VAT doliczy się
sam, na wspólnym worku. Dogrossowanie go wcześniej dałoby VAT dwa razy na części fakturowanej
i VAT na części gotówkowej, gdzie faktury nie ma.

**1d. Bilans się rusza, marża nie.** Przy rozliczeniu brutto inwestor jest fakturowany brutto, więc
`totalMaterialCosts` musi wzrosnąć o `netBilled × vatRate` i bilans o tyle spada. Marża nie dostaje
członu: firma kupuje za netto (VAT z paragonu odzyskany), fakturuje `netto × (1 + vatRate)`
i ten VAT odprowadza — zysk zero. Rozstrzygnięcie „marża nie dostaje żadnego członu za materiały"
(właściciel, pytany dwukrotnie, 2026-07-26) zostaje w mocy.

**2. Właściciel już raz na to odpowiedział — i odpowiedź jest „zależy od trybu".**
`context/archive/2026-07-26-materials-net-pricing-persisted/change.md:114-122` (właściciel,
2026-07-26):

> - **Klient płaci dokładnie kwotę wpisaną w formularzu.** Przy rozliczeniu netto i mieszanym
>   **nie** doliczamy VAT-u na wierzch kwoty materiałów.
> - **Przy rozliczeniu brutto VAT _jest_ doliczany na wierzch**, i wtedy obniżka nie ma sensu.

To rozstrzygnięcie dotyczyło koncesji („Rozliczanie wydatków"), nie typu netto — ale to najbliższa
istniejąca reguła i mówi ona, że gross-up jest **poprawny wyłącznie w trybie brutto**, a błędny
w netto i mieszanym. Dokładnie odwrotnie niż działa dziś kod: w trybie brutto `effectiveNetRate`
jest zerowany (`summary-panel-content.tsx:213`), więc akurat tam żadna stawka nie jest dostępna.

Drugie rozstrzygnięcie, `change.md:103-108`, **odrzucone dwukrotnie**: „Materiał to koszt, który
klient zwraca w cenie brutto" — materiał jest przelotowy, marża nie dostaje żadnego członu za
materiały. Gross-up tego nie łamie (marża i tak nie czyta `materialsNetBilled`), ale łamie zdanie
obok: „pass-through means pass-through on both axes"
(`context/foundation/investment-financials-and-discount.md:77`).

**3. Nikt nigdy nie rozważył i nie odrzucił gross-upu.** Jedyna alternatywa na papierze to „dodać
tylko do `.net`", odrzucona w `context/archive/2026-07-24-netto-expense-type/plan.md:370-373`.
Face value na obu osiach wynika z ogólnej reguły warstwy księgowej — **„VAT dotyczy WYŁĄCZNIE prac"**
(właściciel, 2026-07-19, `context/reference/kosztorys-editor-domain-notes.md:298-308`). Wydatek
netto z wyliczonym brutto byłby **drugim** wyjątkiem od tej reguły (pierwszy to `vatPlane` zaliczki),
a notatki domenowe żadnego drugiego wyjątku nie znają. Ten dokument trzeba będzie zmienić.

**Czwarte, mniej fundamentalne, ale blokujące: przy dzisiejszym okablowaniu osi zmiana byłaby
w Podsumowaniu niewidoczna.** `moneyAxis = settlementModeToPanelAxis(settlementMode)` — tryb NET
renderuje tylko kolumnę netto, tryb MIXED idzie do `MixedSummary`, który czyta wyłącznie `.net`,
a tryb GROSS zeruje stawkę. Oś brutto `materialsPair` jest dziś praktycznie nieobserwowalna zawsze
wtedy, gdy stawka jest aktywna (`src/lib/kosztorys/money-axis.ts:19-24`,
`src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:81`). Sam gross-up bez zmiany
okablowania osi nie zmieni ani jednej liczby na ekranie w Podsumowaniu — zmieni tylko kolumnę
Brutto w tabelce materiałów.

---

## Detailed Findings

### Skąd bierze się `materialsNetBilled`

Jeden typ: `INVESTMENT_EXPENSE_NET` („Wydatek inwestycyjny netto"),
`src/lib/constants/transfers.ts:201-216`. Jedyny wiersz w tabeli specyfikacji z
`billedAmount: 'netAmount'` (`:214`) i `financialBucket: 'materialsNet'` (`:213`), plus
`settleable: false` (`:212`) — nigdy nie trafia do `totalSettled`.

Kolumny: `amount` (wymagana, nieedytowalna, `src/collections/transfers.ts:85-96`),
`netAmount` (nullable, immutable, widoczna tylko dla tego typu, `:97-109`).
SQL sumuje `COALESCE(SUM(net_amount), 0) AS net_total` w czterech miejscach
(`src/lib/db/sum-transfers.ts:156,167,268,429`).

### Co rusza gross-up po stronie serwera

`deriveFinancials` (`src/lib/db/investment-financials.ts:70-106`):

```ts
const materialsNetBilled = sumRows(rows, isNetMaterial)
const materialsNetDiscount =
  settlementMode === 'GROSS' ? 0 : concessionOn(materialsGrossBase, materialsNetRate)
return { …, totalMaterialCosts: materialsGrossBase + materialsNetBilled, … }
```

Przy Δ = `netBilled × stawka`:

| Figura                 | Wzór                                                                                                  | Ruch                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `totalMaterialCosts`   | `materialsGrossBase + materialsNetBilled` (`:94`)                                                     | **+Δ**                                             |
| bilans                 | `totalIncome − (materiały + robocizna) + rabat + materialsNetDiscount` (`calculate-balance.ts:8-13`)  | **−Δ**                                             |
| marża                  | `robocizna − wypłaty − rabat − strata − settled − materialsNetDiscount` (`calculate-margin.ts:15-21`) | **0** — żaden człon nie czyta `materialsNetBilled` |
| `materialsNetDiscount` | baza to `materialsGrossBase`, celowo **nie** `totalMaterialCosts` (`:83-89`)                          | 0                                                  |

Jeśli gross-up ma kosztować firmę (tak jak `RABAT` czy `materialsNetDiscount`), marża potrzebuje
**nowego członu**. Inaczej bilans się rusza, a marża nie — i przestają być dwustronne.

### Sześć miejsc, które rozjadą się przy zmianie częściowej

1. 🔴 **`uncategorisedRemainder`** (`src/lib/db/map-category-costs.ts:27-30`) =
   `totalMaterialCosts − Σ categoryCosts`. Jeśli `deriveCategoryBreakdowns` nie urośnie w tym samym
   kroku, na stronie inwestycji i w nagłówku wydruku pojawia się kafelek-widmo
   „Korekta (bez kategorii)" o wartości dokładnie Δ.
2. 🔴 **Dwa bilanse.** `calculateBalance(financials)` vs `calculateBalance(headerFields, visibility)`
   (`src/lib/export/header-fields.ts:7-16`) — drugi to suma widocznych kafelków liczonych
   z `categoryCosts`, nie z `totalMaterialCosts`.
3. 🔴 **Most do Arkuszy.** `src/lib/google/tab-rows.ts:53-61` wysyła netto:
   `const billed = billsNetAmount(t.type) ? t.netAmount : t.amount`. Zakładka
   „wydatki inwestycyjne" ma `=SUM(E:E)` i `SUMIF` per kategoria (`sheet-summary.ts:28-46`).
   Gross-up po stronie apki bez zmiany serializacji = rachunek klienta niższy od bilansu o Δ.
   To ten sam kształt co udokumentowany błąd FAZY 2 (`context/foundation/lessons.md:40-44`).
4. 🔴 **`preview-kosztorys.ts:50` i `raporty/page.tsx:42-46`** wołają `deriveFinancials` **bez**
   stawki i trybu → `materialsNetRate = null`, `settlementMode = 'NET'`. Gross-up sterowany stawką
   jest tam no-opem. Podgląd klienta i raport rozjadą się ze stroną inwestycji.
5. 🔴 **`materialsPair`** (`summary-economics.ts:49-52`) — panel liczy własną oś brutto. Zmiana
   tylko na serwerze zostawia Podsumowanie na face value.
6. 🔴 **`sumBilled` / `partitionWydatkiRows`** (`src/lib/kosztorys/wydatki-datasets.ts:16-47`) —
   „Razem" zakładki netto przestanie się spinać z `totalMaterialCosts`.

### Co rusza się na ekranie (i czego nie widać)

**Rusza się (oś brutto, tylko jeśli zmieni się też okablowanie osi):** „Materiały" brutto,
„Łącznie" brutto, „Do zapłaty" brutto.

**Rusza się od razu, jeśli tabelka dostanie wyliczone brutto:** kolumna „Brutto" i „Razem" wierszy
`… netto` w „Wydatkach inwestycyjnych", „Różnica", oraz odpowiadające im kawałki wykresu
(`expensePieSlices` czyta surowe `row.net`, `chart-slices.ts:83-91`).

**Nie rusza się nic z tego:** wszystkie udziały (mianownik `combinedNet` jest netto — żaden udział
nigdzie nie liczy się z brutto), oś netto „Materiały"/„Łącznie"/„Do zapłaty", „Robocizna",
„Rabat", „Wpłaty", **cały tryb mieszany** (`computeMixedSettlement` czyta `materialy.net`
i przelicza brutto od reszty netto), pie „Struktura kosztów", zakładka Marża
(„Obniżka materiałów", „Marża"), kafelek „Obniżka materiałów", bilans i marża na liście inwestycji.

### Niezmiennik Σ — sedno problemu z tabelką

`buildMaterialyBreakdown` (`map-category-costs.ts:44-71`) rozbija kategorię mieszaną na wiersz
`origin: 'gross'` (kwota kategorii **minus** jej część netto) i osobny wiersz `origin: 'netBilled'`
(„<kategoria> netto"). Niezmiennik: **Σ wierszy === `totalMaterialCosts`**, domknięty wierszem
„Korekta (bez kategorii)".

Dziś kolumna „Brutto" tabelki to po prostu `row.net`, więc `Razem` === `totalMaterialCosts`.
Jeśli wiersz `netBilled` zacznie pokazywać `row.net × (1 + stawka)`, `Razem` **przestaje** się
zgadzać z `totalMaterialCosts` i z wierszem „Materiały" w Podsumowaniu. Trzeba wybrać jedno:
albo `totalMaterialCosts` przechodzi na podstawę po gross-upie (czyli zmiana idzie do serwera
i do bilansu), albo tabelka dostaje osobną, jawnie prezentacyjną podstawę brutto, która **nie jest**
bazą Σ.

### Stawka — co jest w zasięgu i gdzie

| Warstwa                              | Wartość                                                                                                     | Uwaga                                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `deriveFinancials`                   | `materialsNetRate` i `settlementMode` jako parametry (`:74-75`)                                             | `vatRate` **nie jest** przekazywany — jeśli gross-up ma używać VAT-u, serwer go nie ma                                          |
| listing / strona inwestycji / edytor | per-inwestycja, przekazywane                                                                                | ok                                                                                                                              |
| `/raporty`, `preview-kosztorys`      | **brak → `null` / `'NET'`**                                                                                 | gross-up tam nie zadziała                                                                                                       |
| panel — obliczenia                   | `effectiveNetRate = settlementMode === 'GROSS' ? null : materialsNetRate` (`summary-panel-content.tsx:213`) | lustro bramki serwerowej                                                                                                        |
| panel — zakładka Materiały           | **surowy** `materialsNetRate` (`:310`), potem `materialsNetRate ?? vatRate` (`summary-expenses-tab.tsx:55`) | ⚠️ **niespójność** — tabelka trzyma kolumnę Netto przy zapisanej stawce nawet w trybie brutto, gdzie marża i bilans ją ignorują |

Ta ostatnia niespójność to nasza świeża, niezacommitowana zmiana (kolumna prezentacyjna
z fallbackiem na VAT). Trzeba ją rozstrzygnąć **przed** gross-upem, bo to ona definiuje, „która
stawka" w ogóle znaczy coś w tej zakładce.

### Testy — co spadnie, a co jest ślepe

**Spadnie natychmiast (leg 2 pre-pusha, `pnpm vitest run`):**

- `src/__tests__/lib/kosztorys/summary-economics.test.ts:326` — „both axes: a netto expense raises
  Do zapłaty .net AND .gross by exactly its netAmount"
- `src/__tests__/lib/kosztorys/summary-economics.test.ts:355` — B5, `.net === .gross === 1234.56`

Cały blok `:293-374` nazywa się _„the netto-billed bucket is frozen against the materiały toggle"_ —
to jawny pin dzisiejszej reguły. Pozostałe cztery przypadki w nim asertują **oś netto**, więc
zostaną zielone i dadzą fałszywe poczucie bezpieczeństwa.

**Ślepe na tę zmianę — i to jest ważne:** golden master (`financial-golden-master-db.test.ts`)
i parity sweep nie mogą się zaczerwienić, bo w `dumps/dump-latest.sql` jest **zero** wierszy
`INVESTMENT_EXPENSE_NET` i **zero** inwestycji z `materials_net_rate`. Dwie najdroższe bramki
pre-pusha nie dotykają tej funkcjonalności w ogóle.

**Luki bez żadnego testu:**

- `Razem` tabelki materiałów === wiersz „Materiały" w Podsumowaniu. Dwa niezależne wyliczenia osi
  brutto, nic ich nie wiąże. `src/__tests__/components/kosztorys/summary/` to **pusty katalog**.
- Σ wierszy rozbicia po **osi brutto** (istniejące testy sumują `row.net`, czyli netto).
- Most apka↔Arkusze: `tab-rows.test.ts:327-352` pokrywa serializację, `derive-financials-bucketing`
  pokrywa agregat, **nic** nie asertuje `Σ(wierszy wysłanych do arkusza) === totalMaterialCosts`.
- `calculate-balance.test.ts` nie ma ani jednego przypadku z wydatkiem netto.
- `e2e/` — zero pokrycia zakładki Materiały i Podsumowania.

Kotwice w `context/foundation/test-plan.md`: **Ryzyko #1** („dwie powierzchnie apki się nie zgadzają";
anty-wzorzec: „oracle skopiowany z wyliczenia jednej z powierzchni") dla luk 1–2, **Ryzyko #5**
(„apka liczy inaczej niż Arkusz") dla mostu.

## Code References

- `src/lib/constants/transfers.ts:201-216` — specyfikacja typu `INVESTMENT_EXPENSE_NET`
- `src/lib/db/investment-financials.ts:70-106` — `deriveFinancials`, `totalMaterialCosts`
- `src/lib/db/calculate-balance.ts:8-13`, `src/lib/db/calculate-margin.ts:15-21` — bilans i marża
- `src/lib/kosztorys/summary-economics.ts:49-52` — `materialsPair`, face value na obu osiach
- `src/lib/kosztorys/summary-economics.ts:118-131` — `computeDoZaplatyRM`
- `src/lib/db/map-category-costs.ts:27-30,44-71` — reszta bez kategorii i rozbicie per kategoria
- `src/lib/google/tab-rows.ts:53-61` — serializacja do arkusza klienta
- `src/components/kosztorys/summary/summary-panel-content.tsx:213,310` — bramka trybu brutto
  i surowa stawka do zakładki Materiały
- `src/components/kosztorys/summary/tables/materials-breakdown-table.tsx:44-47` — `netOf`
- `src/lib/utils/validation.ts:22-33` — `netAmount ≤ amount`
- `src/migrations/20260726_1_add_net_amount_to_transactions.ts:10` — „`amount` stays the brutto
  that left the register"

## Architecture Insights

- **`totalMaterialCosts` to jeden skalar obsługujący dwie osie.** Działa wyłącznie dlatego, że dziś
  netto === brutto dla tego kubełka. Gross-up wymusza rozstrzygnięcie, którą oś ten skalar reprezentuje.
- **`faceValue()` to zaszyta reguła domenowa, nie helper.** Jego docstring
  (`summary-economics.ts:12-14`) mówi wprost: bez niego „grossing an expense would invent VAT that
  never existed on the ledger".
- **Model „zapisane `netAmount`" został wybrany po to, żeby skasować ryzyko zaokrągleń** —
  `context/archive/2026-07-24-netto-expense-type/design.md:101-111`: wcześniejszy projekt oparty na
  stawce miał realny dryf `ROUND` Postgresa vs `Math.round` JS-a łamiący „lista === podsumowanie".
  Wyliczone brutto **przywraca dokładnie to ryzyko**.

## Historical Context (from prior changes)

- `context/archive/2026-07-24-netto-expense-type/plan.md:370-373` — uzasadnienie face value na obu
  osiach; jedyna rozważana alternatywa to „tylko `.net`"
- `context/archive/2026-07-26-materials-net-pricing-persisted/change.md:114-122` — rozstrzygnięcie
  właściciela: VAT na wierzch nigdy przy netto/mieszanym, zawsze przy brutto
- `context/archive/2026-07-26-materials-net-pricing-persisted/change.md:100-108` — „typ netto jest
  już poprawny na obu figurach"; odrzucenie członu `+VAT` w marży (właściciel pytany dwukrotnie)
- `context/reference/kosztorys-editor-domain-notes.md:298-308` — „VAT dotyczy WYŁĄCZNIE prac";
  ten dokument trzeba będzie zmienić, jeśli change wejdzie
- `context/foundation/lessons.md:40-44` — niezmiennik żyjący w dwóch płaszczyznach potrzebuje testu
  na **moście**, nie po jednym teście na płaszczyznę

## Rozstrzygnięcia właściciela (2026-07-29)

Wszystkie cztery pytania domenowe zamknięte — szczegóły w sekcjach 1, 1b, 1c, 1d powyżej.

1. Zapisane `amount` to brutto **rejestru** (paragon, zwykle 23%), nie brutto **rachunku klienta**.
   Firma odzyskuje VAT z paragonu, więc jej koszt to netto; inwestor jest fakturowany stawką
   inwestycji. Dwie płaszczyzny, obie poprawne.
2. Gross-up **wyłącznie przy rozliczeniu brutto**. Tryb netto i mieszany bez zmian.
3. Stawka = `vatRate` (koncesja w trybie brutto z definicji nie obowiązuje).
4. Bilans rusza się o `netBilled × vatRate`; marża bez zmian.

**Zakres changeu po zawężeniu:** jeden tryb rozliczenia, jeden kubełek, oś brutto.

## Open Questions

Techniczne, do rozstrzygnięcia w planie:

1. **`deriveFinancials` nie dostaje `vatRate`** (`investment-financials.ts:74-75` — tylko
   `materialsNetRate` i `settlementMode`). Trzeba go dopiąć albo policzyć gross-up wyżej.
2. **`totalMaterialCosts` — jeden skalar na dwie osie.** Przy trybie brutto musi reprezentować
   brutto; przy netto/mieszanym zostaje na netto. Czy to jedno pole zmienne w zależności od trybu,
   czy nowe pole obok?
3. **`preview-kosztorys.ts:50` i `raporty/page.tsx:42-46`** wołają `deriveFinancials` bez stawki
   i trybu → domyślnie `'NET'`, więc gross-up tam nie zadziała. Podgląd klienta na inwestycji
   rozliczanej brutto pokaże złą kwotę. **Do dopięcia — to nie jest kosmetyka.**
4. **Serializacja do Arkuszy** (`tab-rows.ts:53-61`) wysyła netto. Przy trybie brutto rachunek
   klienta w arkuszu byłby niższy od bilansu o Δ. Plus brakujący test mostu.
5. **Σ wierszy rozbicia === `totalMaterialCosts` na osi brutto** — dziś tabelka pokazuje
   `row.net` jako Brutto; przy trybie brutto wiersz `netBilled` musi pokazać kwotę po gross-upie,
   inaczej `Razem` rozjeżdża się z Podsumowaniem.
6. ~~Zakładka Materiały dostaje surowy `materialsNetRate`, nie `effectiveNetRate`.~~ **Domknięte
   2026-07-29** — `summary-panel-content.tsx:310` przekazuje teraz `effectiveNetRate`, więc przy
   rozliczeniu brutto stawka jest `null` i kolumna spada na `vatRate`. To ta sama stawka, którą
   właściciel wskazał jako doliczaną w trybie brutto, więc prezentacja i przyszły gross-up czytają
   jedną liczbę.
7. **Notatki domenowe** (`kosztorys-editor-domain-notes.md:298-308`, „VAT dotyczy WYŁĄCZNIE prac")
   mówią dziś coś przeciwnego — wymagają aktualizacji jako część changeu.
8. **Brzeg walidacji:** przy `vatRate ≥` stawce paragonu wyliczone brutto przekroczy zapisane
   `amount`. W praktyce 8% < 23%, ale reguła nie jest gwarantowana.
