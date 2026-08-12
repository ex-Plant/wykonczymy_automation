---
date: 2026-08-11T19:29:17+0200
researcher: Claude
git_commit: ddc1f6302ee353198358ea7ee6440875c5e7879e
branch: konradantonik/archive-distil-ex577
repository: wykonczymy
topic: 'Wydatki w liście inwestycji nie znają płaszczyzny rozliczenia materiałów'
tags: [research, codebase, investments-listing, materials-net-plane, parity]
status: complete
last_updated: 2026-08-11
last_updated_by: Claude
---

# Research: wydatki w liście inwestycji vs podsumowanie inwestycji

## Research Question

Dogfooding na inwestycji 31 („11 Listopada 40"): lista inwestycji pokazuje „Wydatki inwestycyjne"
191 080,57 zł, a podsumowanie tej samej inwestycji „Razem" 152 648,46 netto / 190 810,57 brutto.
Skąd rozjazd, które powierzchnie mają ten sam błąd, i co się posypie po zmianie definicji figury.

## Summary

Rozjazd jest realny i ma **jedną przyczynę**: listing sumuje surowe `categoryCosts` — kwoty tak, jak
leżą w ewidencji. To sumowanie nie zna płaszczyzny (dodaje kwoty brutto do kwot wpisanych od razu
netto) i pomija korektę bez kategorii. Podsumowanie liczy poprawnie i jest wzorcem.

Trzy rzeczy, które research dołożył ponad pierwotną diagnozę:

1. **Ta sama zła formuła istnieje w repo w trzech kopiach**, w tym w skrypcie, który ma pilnować
   parzystości listingu i szczegółu — i który przez to nie może niczego wykryć.
2. **Baza testowa nie zawiera ani jednej inwestycji ze stawką materiałów** (0/109) ani jednego
   wydatku wpisanego netto (0 wierszy). Cała ta płaszczyzna jest niewidoczna dla wszystkich testów
   jadących po realnych danych — łącznie z golden masterem i testem parity.
3. **Kafle na stronie inwestycji (stats v1) wyglądają na ten sam błąd, ale nim nie są** — tam suma
   kafli JEST bilansem, a ulga siedzi w osobnym kaflu „Obniżka materiałów". Przeliczenie tych kafli
   na netto policzyłoby ulgę dwa razy. To osobna decyzja, nie część tej naprawy.

## Detailed Findings

### 1. Arytmetyka rozjazdu (zweryfikowana na lokalnej bazie, inwestycja 31)

`materials_net_rate = 0,25`, `settlement_mode = NET`. Ewidencja:

| bucket | kwota |
| --- | --- |
| `INVESTMENT_EXPENSE` kat. 1, niesettled | 135 460,37 |
| `CORRECTION` kat. 1 | −3 445,24 |
| `INVESTMENT_EXPENSE` kat. 2 | 58 945,44 |
| `CORRECTION` bez kategorii | −300,00 |
| `INVESTMENT_EXPENSE_NET` kat. 1 | 100,00 netto |
| `INVESTMENT_EXPENSE_NET` kat. 3 | 20,00 netto |
| `INVESTMENT_EXPENSE` settled (kat. 1 + 2) | 1 000 000,00 + 4 421,85 |

Listing: `Σ categoryCosts` = 132 115,13 + 58 945,44 + 20,00 = **191 080,57**.
Panel „Razem": 190 810,57 brutto / **152 648,46** netto.
Różnica 270,00 = +300 (brakująca korekta) −125+100 (netto kat. 1) −25+20 (netto kat. 3).

Kolumna „Materiały budowlane" 132 115,13 to **132 015,13 brutto + 100,00 netto w jednej komórce** —
mieszanka płaszczyzn wewnątrz jednej liczby. „Pozostałe koszty" 20,00 to z kolei czysta kwota netto
stojąca w rzędzie kwot brutto.

Bilans i „Koszty inwestora" są zdrowe, bo idą inną ścieżką (`deriveFinancials` po typach, nie po
kategoriach) — sprawdzone do grosza: 461 731,57 i −20 217,12.

### 2. Dlaczego żaden guard tego nie złapał

- **`src/__tests__/investment-render-parity-db.test.ts:94-103`** porównuje **wyłącznie bilans i
  marżę**. `shapeInvestments` nie jest w nim nigdy wywołane, `totalInvestmentExpense` ani kolumny
  kategorii nie są dotknięte.
- Gorzej: ten test woła `deriveFinancials` z **trzema** argumentami (`:78-82`) — bez stawki i bez
  trybu — więc po stronie szczegółu `materialsNetDiscount` jest zerowane, podczas gdy strona listingu
  (`sum-transfers.ts:236`) dostaje prawdziwą stawkę. Dla dowolnej inwestycji ze stawką ten test
  **fałszywie by krzyknął** na bilansie. Jest zielony wyłącznie dlatego, że w bazie testowej takich
  inwestycji nie ma.
- **`src/scripts/audit-investment-parity.ts:51`** liczy `wydatkiInwestycyjne` jako
  `f.categoryCosts.reduce(...)` — **znak w znak ta sama formuła co `investments.ts:38`** — i podaje ją
  obu stronom (`:109`, `:113`). Jego różnica jest strukturalnie zawsze zerem. Skrypt nie jest przy tym
  nigdzie zautomatyzowany (brak w `package.json`, w `.husky/pre-push`, w workflowach).
- **`src/__tests__/financial-golden-master-db.test.ts`** zamraża `categoryCosts` (`:175`, `:296-300`),
  ale **nie** `totalInvestmentExpense` — `buildSnapshot` czyta `sumAllInvestmentFinancials` i nigdy nie
  woła `shapeInvestments`. Sam plik przyznaje, że dowodzi „preservation, not correctness".
- **`src/__tests__/shape-rows.test.ts:107-133`** to jedyny test tej linii — i **koduje błąd jako
  specyfikację**: `expect(row.totalInvestmentExpense).toBe(1200) // correction not folded in`. Nie ma
  ani jednego przypadku ze stawką netto.
- **Kolumny kategorii w tabeli (`investments.tsx:84-91`) nie mają żadnego testu.**

**Stan bazy testowej (5435), zmierzony:** `investments` 109 wierszy, z czego **0** ma
`materials_net_rate`; `transactions` typu `INVESTMENT_EXPENSE_NET`: **0**. To jest korzeń całej
ślepoty — restore pochodzi sprzed wprowadzenia tej funkcji.

### 3. Inwentarz powierzchni czytających koszty per kategoria

**Liczą poprawnie** (wszystkie schodzą przez jedną bramkę
`summary-panel-content.tsx:209` i jeden moduł arytmetyki `summary-economics.ts`):

- `materials-breakdown-table.tsx:41-78` — tabela netto/brutto/różnica + „Razem"
- `chart-slices.ts:85-96` — udziały na wykresie
- `summary-overview-tab.tsx:112`, `summary-panel-content.tsx:213-220` — „Materiały" i „Do zapłaty"
- hosty: panel na stronie inwestycji (stats v2), edytor kosztorysu, share/podgląd klienta

**Czytają surowe `categoryCosts`:**

- **B1** `src/components/tables/investments.tsx:84-91` — kolumny kategorii (bez stawki, bez bramki,
  bez korekty) — **cel tej zmiany**
- **B2** `src/lib/queries/investments.ts:38` — „Wydatki inwestycyjne" — **cel tej zmiany**
- **B3** kafle stats v1 na stronie inwestycji (`page.tsx:67` → `mapCategoryCostsToFields`) — **NIE ten
  sam błąd**: tam suma widocznych kafli JEST bilansem (`lib/export/header-fields.ts:7`), korekta ma
  swój kafel, a ulga swój („Obniżka materiałów"). Przeliczenie kafli kategorii na netto przy
  zachowaniu kafla ulgi policzyłoby ulgę podwójnie i rozjechało bilans. Osobna decyzja.
- **B4** nagłówek wydruku/eksportu transferów — powiela kafle z B3, ta sama uwaga
- **B5** `/raporty` (`raporty/page.tsx:42`) — woła `deriveFinancials` bez stawki i trybu; świadome,
  oznaczone banerem (EX-598), agregat wielu inwestycji nie ma jednej stawki
- **B6** mirror do Google Sheets (`lib/google/tab-rows.ts:56`) — konwencja per wiersz, inna z
  założenia; do potwierdzenia z właścicielem, poza tą zmianą

### 4. Czego brakuje mechanicznie, żeby listing umiał policzyć

`deriveCategoryBreakdowns` produkuje trzy mapy, ale agregat listingu **wyrzuca `netCategoryCosts`**
zanim cokolwiek go zobaczy: `sum-transfers.ts:229-231` destrukturyzuje tylko
`{ categoryCosts, settledCategoryCosts }`. `netCategoryCosts` istnieje wyłącznie na
`CategoryBreakdownsT` (`types/investment-financials.ts:51-59`), **nie** na `InvestmentFinancialsT` —
więc listing fizycznie nie ma jak odróżnić części brutto od części netto w obrębie kategorii.

To jest dokładnie ten jeden brakujący kabel. Bez niego kolumna kategorii nie da się policzyć
poprawnie żadnym sposobem.

`totalSettled` jest już w `InvestmentFinancialsT` i tylko nie jest przepisywany do wiersza
(`queries/investments.ts:39-61`). Korekta (`uncategorisedRemainder`, `map-category-costs.ts:27-30`)
jest policzona, ale **prywatna w module** — trzeba ją wyeksportować.

### 5. Plumbing nowych kolumn

- Łańcuch: `inwestycje/page.tsx:15-29` → `investment-data-table.tsx:46-49` → `getInvestmentColumns`.
- Widoczność kolumn **jest persystowana** w localStorage pod `table-columns:investments`
  (`column-visibility-storage.ts:3-21`). **Nowe id domyślnie widoczne** — `column-toggle.tsx:23`
  traktuje brak wpisu jako widoczny. Nic do migracji; każdy użytkownik zobaczy nowe kolumny sam.
- Brak listy domyślnie ukrytych kolumn, brak `columnOrder` — kolejność to kolejność literału.
- **Listing nie ma żadnego eksportu** (CSV/print istnieją tylko dla transferów) — jedno miejsce do
  zmiany.
- **Żaden test ani spec E2E nie asertuje zestawu kolumn listingu.**
- Brak wariantu mobilnego — jedyny mechanizm to `overflow-x-auto`
  (`data-table.tsx:106`). Dwie kolumny więcej = szerszy scroll.
- Precedens dla bramki roli: `marża` i `wypłaty` są admin/owner-only (`investments.tsx:71-80`,
  `100-109`). `totalSettled` zasila marżę, więc „Wydatki wliczone w robociznę" ma naturalne miejsce za
  tą samą bramką.
- `SETTLED_TYPE.label` = „Materiały wliczone w robociznę" (`lib/constants/transfers.ts:256-259`) —
  etykieta istnieje jako stała, ale jest też dwukrotnie zaszyta stringiem
  (`materials-transactions-table.tsx`, `summary-margin-tab.tsx:74`).
- „Wydatki inwestycyjne" **nie ma wspólnej stałej** — string żyje osobno w nagłówku kolumny
  (`investments.tsx:94`) i jako caption tabeli w panelu (`materials-breakdown-table.tsx:23`).

### 6. Co się posypie przy dołożeniu pola do `InvestmentFinancialsT`

- `sum-transfers.test.ts:265-279` i `:282-295` — `toEqual` na całym obiekcie
- `derive-financials-bucketing.test.ts:28-31` — `BucketNameT = Exclude<keyof InvestmentFinancialsT,
  'categoryCosts' | 'settledCategoryCosts'>` wciągnie nowe pole do mapy bucketów i porówna tablicę z
  liczbą; trzeba dopisać `'netCategoryCosts'` do `Exclude` i do filtra w `:99-101`
- literały typowane: `financial-golden-master-db.test.ts:65`, `calculate-balance.test.ts:5`,
  `map-category-costs.test.ts:10,161`, `calculate-margin.test.ts:6`, `shape-rows.test.ts:69,108`
- **cichy ocalały**: `summary-reading.test.ts:13` używa `as InvestmentFinancialsT` (asercja, nie
  anotacja) — nie zgłosi błędu

Golden master: dane zostaną zielone (snapshot nie zawiera nowego pola ani
`totalInvestmentExpense`), ale `ZERO_FINANCIALS` wywali się na typecheck. Regeneracja:
`pnpm test:golden:update` po `pnpm db:import:test`; fingerprint `DATASET_FLOOR` w `:199`.

## Code References

- `src/lib/queries/investments.ts:34-38` — wadliwa definicja totalu
- `src/components/tables/investments.tsx:84-97` — kolumny kategorii + total
- `src/lib/db/sum-transfers.ts:229-231` — miejsce, gdzie ginie `netCategoryCosts`
- `src/lib/db/investment-financials.ts:33-57` — `deriveCategoryBreakdowns`, źródło trzech map
- `src/lib/db/map-category-costs.ts:27-30` — `uncategorisedRemainder` (prywatna)
- `src/lib/kosztorys/summary-economics.ts:25-38` — `billedMaterialsPair` / `breakdownRowPair`
- `src/components/kosztorys/summary/summary-panel-content.tsx:209` — jedyna bramka trybu brutto
- `src/scripts/audit-investment-parity.ts:51` — trzecia kopia wadliwej formuły
- `src/__tests__/shape-rows.test.ts:107-133` — test kodujący błąd jako spec

## Architecture Insights

- Arytmetyka przechodzenia między płaszczyznami jest **skupiona w jednym module**
  (`summary-economics.ts`) i to jest zdrowe. Chore jest to, że **bramka trybu brutto** żyje jako
  inline `settlementMode === 'GROSS' ? null : rate` w komponencie panelu — więc każda nowa
  powierzchnia musi ją odtworzyć z pamięci. To wprost przyczyna, dla której listing jej nie ma.
- `categoryCosts` jest typem **niedomówionym**: tablica `{categoryId, total}` nie niesie informacji,
  na jakiej płaszczyźnie stoi `total`. Dopóki `netCategoryCosts` nie jedzie razem z nią, każdy
  konsument może ją policzyć źle i nic go nie zatrzyma.
- Lista pokazuje wszystkie inwestycje w jednej tabeli, a **tryb rozliczenia jest per inwestycja** —
  więc jedna kolumna z definicji miesza wiersze netto z wierszami brutto. To nie jest bug do
  naprawienia, to własność powierzchni; wymaga decyzji o nagłówku/oznaczeniu, nie o arytmetyce.

## Historical Context

- `context/foundation/lessons.md:19` — „A parity test must run the REAL per-surface assembly on REAL
  data". Ta lekcja powstała z **dokładnie tego samego rozjazdu** (legacy nieskategoryzowane korekty
  liczone przez listing, nieobecne w sumie kafli szczegółu). Guard, który wtedy powstał, dziś
  porównuje tylko bilans i marżę — czyli lekcja została wdrożona za wąsko i defekt wrócił inną osią.
- `context/foundation/lessons.md:342` — „test pilnujący starej definicji staje się tautologiczny".
  `shape-rows.test.ts:107` to podręcznikowy przypadek: musi zostać **przepisany na czerwono**, nie
  uzupełniony.
- `context/foundation/lessons.md:323` — „sekwencjonuj zmiany, które przesuwają tę samą definicję".
  Naprawa płaszczyzny przesuwa definicję „Wydatków inwestycyjnych"; dwie nowe kolumny to nowe figury.
  Warto rozdzielić na fazy, żeby zła liczba była przypisywalna.
- `context/foundation/lessons.md:590` — golden master nad pożyczonym datasetem; tu dochodzi mocniejszy
  wniosek: dataset nie tylko jest pożyczony, ale **nie zawiera badanej funkcji wcale**.

## Open Questions

1. **Nagłówek „Bilans netto" a tryb brutto.** Dla inwestycji rozliczanej brutto bilans stoi na
   płaszczyźnie brutto. Stała etykieta „netto" będzie dla takiego wiersza nieprawdą. Ta sama uwaga
   dotyczy kolumn wydatków. Czy lista dostaje oznaczenie trybu (kolumna/badge), czy przyjmujemy netto
   jako regułę i brutto jako akceptowalny wyjątek?
2. **Czy „Korekta" i „Wydatki wliczone w robociznę" idą za bramkę admin/owner?** Precedens: marża i
   wypłaty tak; `totalSettled` zasila marżę.
3. **Kafle stats v1 (B3/B4)** — zostawiamy brutto z osobnym kaflem ulgi (spójne, bilans się domyka),
   czy ujednolicamy z panelem v2? To zmiana bilansu na wydruku, więc osobna decyzja.
4. **Czy naprawiamy przy okazji test parity** (`:78-82`, brak stawki i trybu) i skrypt audytu
   (`:51`, zduplikowana formuła)? Bez tego zostawiamy dwa martwe detektory na tej samej figurze.
5. **Dataset testowy bez ani jednej inwestycji netto** — czy tworzymy fixture (inwestycja ze stawką +
   wydatek netto + korekta) w bazie testowej, żeby guardy w ogóle mogły widzieć tę płaszczyznę?
