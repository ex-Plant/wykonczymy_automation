# Plan brief: strata-obniza-bilans (EX-675)

Strata dostaje kierunek rabatu (↓ marża, ↑ bilans), ale w **wartości nominalnej** — ta sama kwota
schodzi z netto i z brutto. Inwestycja przy stracie staje się wymagana.

**Trzy niezależne mechanizmy bilansu muszą dać tę samą liczbę:**

1. `calculateBalance` → listing
2. Σ kafelków `buildFinancialFields` → strona inwestycji (v1), `/raporty`
3. `computeDoZaplatyRM` / `computeMixedSettlement` → panel v2, podgląd klienta

**Fazy:** 0 repro walidacji → 1 bilans + przeniesienie kafelka do wiersza kredytów →
2 krok „Strata" w rozliczeniu v2 → 3 flip wymagalności → 4 guardy.

**Czego nie robimy:** `grossBalance` zostaje nietknięte (dodanie tam `totalLoss` to cicha regresja
1,23× — faza 4 stawia na to test). `calculateMargin` bez zmian. Żadnego backfillu.

**Fixture referencyjny:** inw. 62 → bilans 0, marża −362,84.

Pełny plan: `plan.md`. Kontekst: `research.md`, `change.md`.
