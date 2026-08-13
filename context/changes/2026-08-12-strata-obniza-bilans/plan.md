# Plan: Strata obniża bilans jak rabat, pozostając osobną figurą

**Change ID:** `strata-obniza-bilans` · **Linear:** EX-675
**Upstream:** `change.md` (brief + ustalenie VAT-owe), `research.md` (mapa kodu po EX-555)

## Overview

`LOSS` dostaje kierunek rabatu — ↓ marża, ↑ bilans — ale **w wartości nominalnej**, nie pre-VAT.
Kwota wpisana jako strata to kwota, której klient przestaje płacić, identycznie w netto i w brutto.
Osobno: inwestycja przy stracie staje się wymagana.

Zmiana dotyka **trzech niezależnych mechanizmów bilansu**, które muszą się zgodzić:

| #   | Mechanizm                                                         | Gdzie                                                      | Powierzchnia                       |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| 1   | `calculateBalance(financials)`                                    | `src/lib/db/calculate-balance.ts`                          | listing inwestycji                 |
| 2   | Σ kafelków z `buildFinancialFields`                               | `src/lib/db/map-category-costs.ts` → `financial-stats.tsx` | strona inwestycji (v1), `/raporty` |
| 3   | Kroki rozliczenia `computeDoZaplatyRM` / `computeMixedSettlement` | `src/lib/kosztorys/summary-economics.ts`                   | panel v2, podgląd klienta          |

Rozjazd któregokolwiek z nich = ta sama inwestycja pokazuje dwie różne kwoty długu na dwóch
ekranach. To jest główne ryzyko tej zmiany, nie sama arytmetyka.

## Current State

- `calculateBalance` sumuje `totalIncome − (materiały + robocizna) + totalRabat + materialsNetDiscount`.
  `totalLoss` nie występuje (`calculate-balance.ts:8-13`).
- `calculateMargin` już odejmuje `totalLoss` (`calculate-margin.ts:19`) — **wzór bez zmian**.
- Kafelek „Strata" **istnieje**, ale poza sumowanymi wierszami: osobny prop `totalLoss`, render pod
  `ToggleStatButtons` (`financial-stats.tsx:70,78,119-128`). Nie ma przełącznika i nie wchodzi do
  „Bilansu inwestora". Tooltip `:45` mówi wprost „Nie wchodzi do bilansu inwestora".
- v2 nie zna straty w ogóle: `KosztorysEditorDataT` niesie `laborCostsNetFromTransactions` i
  `investmentRabat` (`types.ts:159-160`), nie niesie straty. Podgląd klienta świadomie **nie**
  dostaje `financials` (`preview-kosztorys.ts:64-75`) — to bramka uprawnień, nie wygoda.
- `requiresInvestment('LOSS')` → `false` (`transfers.ts:441-447`); `showsInvestment('LOSS')` → już `true`.
- `validate.ts:67` czyta `d.investment` z przychodzącego payloadu, **bez** fallbacku na `originalDoc` —
  w odróżnieniu od `:33`, gdzie ten sam fallback dla `type` jest zrobiony i opisany komentarzem.

## Desired End State

Strata o kwocie X na inwestycji:

- podnosi bilans o X na **wszystkich trzech** mechanizmach, w tej samej kwocie;
- obniża marżę o X (bez zmian);
- na płaszczyźnie brutto odlicza **X, nie 1,23·X** — baza VAT w `grossBalance` pozostaje nietknięta;
- jest widoczna jako osobna, nazwana pozycja: kafelek „Strata" w wierszu kredytów (v1) i krok
  „Strata" w rozliczeniu (v2 + podgląd klienta);
- nie da się jej zapisać bez inwestycji.

Fixture referencyjny: inwestycja 62 → **bilans 0, marża −362,84**.

## What We're NOT Doing

- **Nie dotykamy `grossBalance`** (`summary-economics.ts:107-114`). Dodanie tam `totalLoss` to
  odruch „symetria z rabatem" i cicha regresja: `+ totalLoss` siedzi już w `balance` i przechodzi
  na brutto nienaruszone. Faza 4 stawia na to test.
- Nie dotykamy `calculateMargin` — wzór jest już poprawny.
- Nie backfillujemy danych. 6 wierszy `LOSS` na produkcji, każdy ma inwestycję (`change.md`).
- Nie wchodzimy w `SummaryReadingT` / rekoncyliację v1↔v2 — strata nie jest figurą kosztorysową
  (`change.md`, konsekwencja 2). Prozę w `summary-reading.ts:6` trzeba tylko poprawić.
- Nie ruszamy dostępności `LOSS` w dialogu transferów — typ zostaje bookowalny.

## Phase 0 — Repro: fallback `originalDoc` przy `investment`

**Hipoteza:** `validate.ts:67` nie ma fallbacku, więc częściowa aktualizacja (payload nie wymieniający
`investment`) wywala walidację na wierszu, który inwestycję w bazie **ma**. Jeśli prawda, dotyczy to
już dziś 5 typów, a flip dokłada szósty.

Konkretna ścieżka: `updateTransferInvoice` wysyła `data: { invoice: next }`
(`src/lib/actions/transfers.ts:311-315`). Druga: akcja edycji rozlewa `parsed.data`, gdzie
`investment` bywa `undefined` (`edit-transfer-form.tsx:81`).

### Changes

- Test w `src/__tests__/hooks/transfers/validate-hook.test.ts` (plik istnieje, nie zna `LOSS`):
  wołaj `validateTransfer` z `operation: 'update'`, `data: { invoice: 5 }`,
  `originalDoc: { type: 'INVESTMENT_EXPENSE', investment: 62, … }`. Asercja: **nie rzuca**.

### Success criteria

#### Automated

- [ ] 0.1 Repro napisany i uruchomiony; wynik (czerwony/zielony) zapisany w `review-gate.md`
- [ ] 0.2 Jeśli czerwony → `validate.ts:67` czyta `d.investment ?? originalDoc?.investment`,
      komentarz wzorowany na `:33`; test zielony. Jeśli zielony → test zostaje jako guard, żadnej zmiany kodu

**Uwaga:** ścieżka anulowania jest bezpieczna niezależnie od wyniku — `validate.ts:47-49` wraca wcześniej.

## Phase 1 — Bilans + kafelek (mechanizmy 1 i 2, razem)

Razem, bo osobno powstaje faza, w której listing i strona inwestycji pokazują różne liczby.

### Changes

1. `calculate-balance.ts` — `+ financials.totalLoss` w sumie. Komentarz: dlaczego nominalnie, nie pre-VAT.
2. `map-category-costs.ts` — `buildFinancialFields` dostaje kafelek `LOSS_LABEL` (`'Strata'`),
   `amount: totalLoss`, warunkowo przy `!== 0` (jak `RABAT_LABEL` na `:130-132`). Wyeksportować `LOSS_LABEL`.
3. `financial-stats.tsx`:
   - `LOSS_LABEL` do `CREDIT_LABELS` (`:23`) → strata trafia do `incomeRow` i dostaje przełącznik;
   - usunąć standalone blok `:119-128` i prop `totalLoss` (`:70,78`);
   - `CREDIT_TOOLTIPS` dostaje wpis dla straty;
   - przepisać `TOOLTIPS.loss` (`:45` — „Nie wchodzi do bilansu inwestora" staje się nieprawdą)
     i `TOOLTIPS.balance` (`:50` — wzór).
4. Usunąć `totalLoss={…}` z `inwestycje/[id]/page.tsx:102` i `raporty/page.tsx:73`.
5. `calculate-margin.ts:5` — komentarz „never touches bilans" jest teraz fałszywy, poprawić.

### Success criteria

#### Automated

- [ ] 1.1 `calculate-balance.test.ts:45-55` przepisany red-first (`totalLoss: 5000` → oczekiwane 6500)
- [ ] 1.2 Nowy test: Σ `amount` z `buildFinancialFields` === `calculateBalance(financials)` przy niezerowej stracie
- [ ] 1.3 `transfer-loss.test.ts:17-20` przepisany
- [ ] 1.4 Złoty master przeliczony (`financial-golden-master.json`) — inw. 62 i 98 zmieniają bilans
- [ ] 1.5 `pnpm typecheck` zielony (prop `totalLoss` usunięty z dwóch call-site'ów)

## Phase 2 — Krok „Strata" w rozliczeniu v2 (mechanizm 3)

Wartość nominalna: ta sama kwota schodzi z osi netto i z osi brutto.

### Changes

1. `summary-economics.ts`:
   - `computeDoZaplatyRM` — nowy parametr `loss`, odjęty od `.net` **i** `.gross` (`:155`);
   - `computeMixedSettlement` — nowy parametr `loss`, odbity na `paidNet`:
     `doRozliczeniaNet = combined.net − paidNet − loss` (`:195`) oraz
     `resztaGross = combined.gross − paidNet − loss` (`:200`).
     **Nie** dotykać `paidGross`, `doZaplatyGross` ani `doZaplatyNet` — obie przepływają same.
2. `types.ts:159-160` — `KosztorysEditorDataT` dostaje `investmentLoss: number`
   (angielski identyfikator, wzorowany na sąsiednim `investmentRabat`).
3. Karmienie pola z obu wejść:
   - właściciel: `inwestycje/[id]/kosztorys_v2/page.tsx` (obok `:91-92`);
   - klient: `preview-kosztorys.ts:64-75` — **własny skalar**, nie luzowanie bramki `financials`;
     `fetchWholeInvestmentFinancials` jest tam już awaitowane (`:53`).
4. Call-site'y: `summary-panel-content.tsx:214` i `summary-overview-tab.tsx:91` przekazują `investmentLoss`.
5. Render: krok „Strata" jako widoczna pozycja odejmowana, w obu trybach.
6. `summary-reading.ts:6` — poprawić prozę („strata … kosztorys nie zna" jest teraz mylące).

### Success criteria

#### Automated

- [ ] 2.1 `computeDoZaplatyRM`: strata X obniża `.net` i `.gross` **o tyle samo** (test na VAT ≠ 0)
- [ ] 2.2 `computeMixedSettlement`: strata odbija `paidNet` — pinowane `doRozliczeniaNet` i `resztaGross`; `doZaplatyGross` przesuwa się o X
- [ ] 2.3 Istniejące 40+ testów w `summary-economics.test.ts` zielone (nowy parametr domyślnie 0 lub jawnie 0 w każdym)
- [ ] 2.4 `settlement-groups.test.ts` i `settlement-mode.test.ts` zielone

## Phase 3 — Flip wymagalności inwestycji

### Changes

- `transfers.ts:441-447` — `'LOSS'` dopisany do `REQUIRES_INVESTMENT_TYPES`.
- Schemat formularza / `transfer-schema` — jeśli lustruje ten zbiór, zsynchronizować.

### Success criteria

#### Automated

- [ ] 3.1 `transfer-constants.test.ts:81-90` przepisany red-first
- [ ] 3.2 Nowy test: `LOSS` bez inwestycji odrzucony przez `validateTransfer`
- [ ] 3.3 Nowy test: `LOSS` z inwestycją, częściowa aktualizacja `{ invoice }` — przechodzi (domyka fazę 0)
- [ ] 3.4 `transfer-schema.test.ts` — pokrycie `LOSS` (dziś zero wzmianek)

## Phase 4 — Guardy i domknięcie

### Changes

- Fixture regresyjny na kształcie inw. 62: dwa `INVESTMENT_EXPENSE` (222,88 + 139,96, `settled: false`)
  - `LOSS` 362,84, robocizna 0, wpłaty 0 → **bilans 0, marża −362,84**.
- Guard VAT: `grossBalance` przy niezerowej stracie **nie** zmienia bazy — 1000 zł straty warte
  dokładnie 1000 zł ulgi w brutto, nie 1230 zł.

### Success criteria

#### Automated

- [ ] 4.1 Fixture inw. 62 zielony
- [ ] 4.2 Guard VAT zielony i czerwony po dopisaniu `totalLoss` do `grossBalance` (zweryfikowane ręcznie raz)
- [ ] 4.3 `investment-render-parity-db.test.ts:141-146` przeanalizowany — jeśli czerwony, to **po fazie 1 nie powinien być**; czerwień tam oznacza rozjazd mechanizmów 1 i 2
- [ ] 4.4 `pnpm typecheck && pnpm lint && pnpm test` zielone
- [ ] 4.5 `pnpm test:parity` zielony

## Testing Strategy

Trzy mechanizmy → trzy poziomy guardów, plus jeden fixture spinający je razem:

| Poziom                                                      | Co pinuje                             | Ryzyko, które zamyka                                  |
| ----------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| Jednostkowy `calculateBalance`                              | `+ totalLoss` w formule               | listing liczy źle                                     |
| Jednostkowy Σ kafelków === `calculateBalance`               | zgodność mechanizmów 1↔2              | nagłówek strony inwestycji rozjeżdża się z listingiem |
| Jednostkowy `computeDoZaplatyRM` / `computeMixedSettlement` | wartość nominalna na obu osiach       | v2 i podgląd klienta pokazują inny dług niż v1        |
| Guard VAT na `grossBalance`                                 | linijka, której **nie wolno** napisać | cicha regresja 1,23×                                  |
| Fixture inw. 62                                             | całość end-to-end                     | defekt, dla którego zmiana powstała                   |

**Złoty master nie jest tu strażnikiem** — tylko 2 ze 109 inwestycji mają niezerową stratę
(`research.md`), więc łapie zmianę, ale nie broni przed regresją.

E2E: brak pokrycia straty w `e2e/` (grep `Strata|LOSS` → zero). Do rozstrzygnięcia przy bramce
review — autorować albo odłożyć jako `e2e-backlog`.

## Open Risks & Assumptions

1. **Wynik fazy 0 nieznany.** Twierdzenie o defekcie walidacyjnym pochodzi z czytania kodu, nie z
   uruchomienia. Jeśli repro wyjdzie zielone — coś po drodze dokleja `investment`, a wtedy faza 0
   redukuje się do samego guardu i faza 3 nie ma czego domykać.
2. **Podwójna droga do tego samego wyniku.** Zaznaczenie „wliczone w robociznę" na wydatku _i_
   dodanie straty na tę samą kwotę wychyli bilans do +362,84. Kod tego nie wykryje (dwa niezależne
   wiersze) — świadomie przyjęte w `change.md`.
3. **Odpuszczona robocizna a VAT.** Właściciel musi wpisywać kwotę, o którą chce zmniejszyć rachunek
   klienta. Aplikacja jej nie ubruttowi. To jedyna rzecz do zakomunikowania właścicielowi.
4. **`change.md:68` cytuje regułę, której w repo nie ma** („no transaction figure ever cuts the VAT
   base of a kosztorys figure"). Wniosek jest poprawny i wsparty niezależnie (materiały są
   pass-through), ale cytat jest kołowy — nie opierać na nim decyzji przy implementacji.

## Progress

### Phase 0

#### Automated

- [x] 0.1 Repro fallbacku `originalDoc` — f50cf210
- [x] 0.2 Naprawa albo guard, zależnie od wyniku — f50cf210

### Phase 1

#### Automated

- [x] 1.1 `calculate-balance.test.ts` red-first — 4a169452
- [x] 1.2 Σ kafelków === `calculateBalance` — 4a169452
- [x] 1.3 `transfer-loss.test.ts` — asercje z `:17-20` poleciały z flipem w fazie 3 — 7a009ecc
- [x] 1.4 Złoty master przeliczony — 4a169452
- [x] 1.5 typecheck — zielony w bramce końcowej (poza istniejącym szumem `importMap.js`) — 0d76ff26

### Phase 2

#### Automated

- [x] 2.1 `computeDoZaplatyRM` nominalnie — 9c367f1f
- [x] 2.2 `computeMixedSettlement` odbija `paidNet` — 9c367f1f
- [x] 2.3 `summary-economics.test.ts` zielony — 9c367f1f
- [x] 2.4 `settlement-groups` + `settlement-mode` zielone — 9c367f1f

### Phase 3

#### Automated

- [x] 3.1 `transfer-constants.test.ts` red-first — 7a009ecc
- [x] 3.2 `LOSS` bez inwestycji odrzucony — 7a009ecc
- [x] 3.3 Częściowa aktualizacja `LOSS` przechodzi — 7a009ecc
- [x] 3.4 `transfer-schema.test.ts` pokrywa `LOSS` — 7a009ecc

### Phase 4

#### Automated

- [x] 4.1 Fixture inw. 62 (bilans 0, marża −362,84, rozliczenie v2 na zero) — 0d76ff26
- [x] 4.2 Guard VAT (strata przesuwa brutto o 1000, rabat o 1230) — 0d76ff26
- [x] 4.3 Parity zielony — mechanizmy 1 i 2 zgodne — 0d76ff26
- [x] 4.4 typecheck + lint + test (2153 zielone) — 0d76ff26
- [x] 4.5 `pnpm test:parity` zielony — 0d76ff26
