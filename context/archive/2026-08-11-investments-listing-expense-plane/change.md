---
change_id: investments-listing-expense-plane
title: Wydatki w liście inwestycji na płaszczyźnie rozliczenia materiałów
status: archived
created: 2026-08-11
updated: 2026-08-12
archived_at: 2026-08-12T08:08:48Z
branch: konradantonik/investments-listing-expense-plane
worktree: .claude/worktrees/investments-listing-expense-plane
---

## Notes

Znalezione podczas dogfoodingu na inwestycji 31 („11 Listopada 40", stawka materiałów 0,25, tryb NET):
lista inwestycji pokazuje „Wydatki inwestycyjne" 191 080,57 zł, a podsumowanie tej samej inwestycji
„Razem" 152 648,46 zł netto / 190 810,57 zł brutto. Podsumowanie liczy dobrze — rozjeżdża się listing.

Przyczyna: `shapeInvestments` (`src/lib/queries/investments.ts:38`) sumuje surowe `categoryCosts`
z ewidencji. To sumowanie nie zna płaszczyzny (miesza kwoty brutto z kwotami wpisanymi od razu netto)
i pomija korektę bez kategorii. Bilans i „Koszty inwestora" są zdrowe — idą osobną ścieżką
(`deriveFinancials`), która widzi pełną ewidencję.

Zakres:

1. Kolumny kategorii i „Wydatki inwestycyjne" wyceniane na płaszczyźnie, na której inwestor jest
   obciążany (ta sama arytmetyka co panel podsumowania, ta sama bramka trybu brutto).
2. Korekta bez kategorii wchodzi do totalu i dostaje własną kolumnę, żeby suma kolumn domykała się
   do totalu.
3. Nowa kolumna „Wydatki wliczone w robociznę" — sam total (`totalSettled`), bez rozbicia na
   kategorie.
4. Nagłówek kolumny „Bilans" w liście → „Bilans netto" (sama etykieta; figura się nie zmienia —
   `calculateBalance` już liczy na płaszczyźnie netto przez `materialsNetDiscount`). Tylko listing.
5. Nowa kolumna „Bilans brutto" = `bilans + vatRate × totalLaborCosts` — bilans netto powiększony
   o VAT od prac. Wymaga dołożenia `vatRate` do `InvestmentRefT` i do reference read.

Rozstrzygnięcia (2026-08-11):

- **Bez oznaczenia trybu w liście.** Po naprawie każda kolumna stoi na płaszczyźnie, na której klient
  jest obciążany, więc jest poprawna per wiersz także w trybie GROSS (stawka wygaszona → paragon).
  Oś netto/brutto materiałów jest już zwinięta do jednej liczby — nie ma czego rozdzielać.
- **„Bilans netto" to VAT, nie materiały.** `calculateBalance` nie dotyka `vatRate`, więc bilans jest
  bez VAT od prac — etykieta jest prawdziwa w każdym trybie.
- **Dwie kolumny bilansu, bo tryb decyduje, która jest kwotą należną** (właściciel, 2026-08-11):
  w NET prawdą jest netto, w GROSS brutto, a w MIXED **obie stoją naraz** — ta sama reguła, którą
  `settlementModeToGridAxis` już stosuje w gridzie (`MIXED → 'both'`). To jest argument za dwiema
  stałymi kolumnami zamiast jednej przełączanej trybem: kolumna nie zna trybu wiersza, a w trybie
  mieszanym żadna pojedyncza liczba nie jest całą należnością.
- **Bez bramki roli** na nowych kolumnach — MANAGER widzi „Korektę" i „Wydatki wliczone w robociznę".
- **W zakresie także naprawa detektorów**: `investment-render-parity-db.test.ts` (woła
  `deriveFinancials` bez stawki i trybu), `audit-investment-parity.ts:51` (powiela wadliwą formułę po
  obu stronach) oraz fixture netto w bazie testowej (dziś 0/109 inwestycji ze stawką, 0 wierszy
  `INVESTMENT_EXPENSE_NET`).

Kwoty docelowe dla inwestycji 31: budowlane 105 712,10 · wykończeniowe 47 156,35 · pozostałe 20,00 ·
korekta −240,00 · wydatki inwestycyjne 152 648,46 · wliczone w robociznę 1 004 421,85.

## Po implementacji (2026-08-11)

- **Punkt 5 był policzony źle w obie strony.** VAT od prac to kolejne obciążenie klienta, więc
  **odejmuje** się od bilansu (bilans ujemny = klient jest winien), a podstawą są prace **po
  rabacie** — złotówka, której klient nie zapłacił, nigdy nie niosła VAT-u. Poprawna postać:
  `bilans − vatRate × (robocizna − rabat)`. Wyliczenie mieszka w jednym miejscu
  (`grossBalance` w `src/lib/kosztorys/summary-economics.ts`), bo powiela je audyt parzystości.
- **Składanie wiersza listingu wyprowadzone do `src/lib/queries/shape-investments.ts`.** W
  `queries/investments.ts` zostały same odczyty. Powód: audyt parzystości (`src/scripts/
audit-investment-parity.ts`) to zwykły skrypt node — import przez moduł zapytań ciągnie
  `server-only` i audyt wracał do przepisywania formuły u siebie, czyli porównywał kopię z kopią.
  Dlatego właśnie ta wada przeszła przez detektor. Teraz audyt woła prawdziwy builder wiersza.

- **Kolumna „Korekta (bez kategorii)" zdjęta** (właściciel, 2026-08-11): materiał bez kategorii to
  legacy z trzech inwestycji, więc nie dostaje stałej kolumny w liście. Kwota nie znika — siedzi
  wewnątrz „Wydatków inwestycyjnych" i ma własny wiersz w panelu „Podsumowanie". Skutek: na tych
  trzech inwestycjach suma kolumn kategorii nie domyka się do „Wydatków inwestycyjnych" — świadomie.
