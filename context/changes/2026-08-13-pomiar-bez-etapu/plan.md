# Plan: Rozjazd „Pomiar z natury" vs suma etapów — trwały podgląd i ręczna naprawa w aplikacji

**Change ID:** `pomiar-bez-etapu` · **Linear:** EX-686
**Upstream:** `change.md` (dowody z trzech arkuszy), `research.md` (mapa importu i siatki)

> **Uwaga o nazwie change-id.** Slug `pomiar-bez-etapu` pochodzi z odrzuconego pomysłu (syntetyczny
> etap-kubełek). Zostaje jako identyfikator folderu; **nic w tym planie nie tworzy takiego etapu**.

## Overview

Arkusze klientów mają w kolumnie „Pomiar z natury" liczbę **wpisaną ręcznie**, nie formułę
`=SUM(etapy)`. Import bierze tylko etapy, więc praca odhaczona w Pomiarze, a nierozbita na etapy,
znika bez śladu — na inwestycji 31 to 41 377 zł w 32 pozycjach.

Rozwiązanie nie zmienia modelu: **suma etapów pozostaje jedyną prawdą o pracy wykonanej.** Import
dokłada obok niej **liczbę odniesienia z arkusza**, która niczego nie liczy — nie wchodzi do
robocizny, marży, rozliczeń z ekipami ani do żadnej sumy. Jej jedyne zadanie to porównanie.

Rozjazd jest **wyliczany na żywo**: `sheetMeasuredQty − Σ etapów`. Lista kurczy się sama, w miarę
jak właściciel wpisuje ilości w etapy — nikt niczego nie kasuje ręcznie, żeby ostrzeżenie zniknęło.

Trzy afordancje na tej jednej liczbie:

| # | Afordancja | Gdzie |
| --- | --- | --- |
| 1 | Czerwony ton komórki „Pomiar z natury" + podpowiedź z obiema liczbami i kwotą | `kosztorys-v2-columns.tsx` (kolumna `stageQtySum`) |
| 2 | Filtr „tylko rozjechane" z licznikiem | pasek narzędzi + memo `viewRows` |
| 3 | Akcja „etapy są prawdą" w menu wiersza (czyści odniesienie) | `kosztorys-row-actions-menu.tsx` |

Wszystko **wyłącznie dla właściciela** — podgląd klienta nie dostaje ani znacznika, ani filtra, ani
akcji.

## Current State

- **Kolumna O arkusza nie jest w ogóle czytana.** `ColumnFieldT` = `plannedQty | unit | clientPrice |
  discount | netValue | comment` (`sheet-import/columns.ts:37-43`); `ROBOCIZNA_FIELDS`
  (`resolve-columns.ts:106-113`) jej nie zna.
- **Formuły zakładki `kosztorys_robocizny` nie są pobierane.** `readImportGrids` bierze render
  `FORMULA` **tylko** dla zakładek „zakres pracy" (`read-sheet.ts:70-74`), z komentarzem
  uzasadniającym, że robocizna czytana jest wyłącznie dla wartości. Ten komentarz przestaje być
  prawdziwy — to jedyne miejsce, gdzie da się odróżnić wpis ręczny od `=SUM(D:M)`.
- `parseRobocizna(grid, resolved)` (`parse-robocizna.ts:58`) dostaje wyłącznie siatkę wartości.
- `number()` (`parse-robocizna.ts:38`) sprowadza wszystko nieparsowalne do `0` — dla liczby
  odniesienia `0` znaczy „arkusz twierdzi, że nic nie zrobiono", więc **pusta komórka musi dać
  `null`**, nie `0`.
- „Pomiar z natury" w siatce to kolumna **wyliczana** `stageQtySum`
  (`kosztorys-v2-columns.tsx:341`), licząca `rowTotalQtyDone(row, viewStages, view)` przez memo na
  `WeakMap` (`:321-328`).
- `computedColumn` przyjmuje `tone` jako funkcję wiersza — precedens `donePercent`
  (`kosztorys-v2-columns.tsx:450`: `tone: (r) => hasStagesOverPlanned(r, stages) ? 'danger' : 'muted'`).
- `ComputedCell` **nie umie podpowiedzi** (`grid/cells/computed-cell.tsx:28-40`) — renderuje goły
  `ReadOnlyCellText`. Jedyna podpowiedź w komórce to `CellTooltip` w `subcontractor-columns.tsx:76-104`,
  niosąca tekst powodu, nie liczbę.
- Jedyne mechanizmy ukrywania wierszy: szukajka (`row-view.ts:4-13`), zwijanie sekcji
  (`section-band-rows.ts:45-53`) i aktywne sortowanie kasujące pasy. `hiddenInExport`
  (`collections/kosztorys-items.ts:46`) **nic nie ukrywa** — zero odczytów w całym repo.
- Ładunek podglądu klienta **nie jest odchudzany** (`preview-kosztorys.ts:20-22`: właściciel
  zaakceptował wyciek, całe drzewo jedzie, o widoczności decyduje wyłącznie render).
- `rowClassName` (`kosztorys-editor-body.tsx:211-217`) **nie jest objęty** listą kolumn dozwolonych
  w podglądzie — potrzebuje własnej bramki.

## Desired End State

Po imporcie arkusza z ręcznie wpisanym Pomiarem:

- każda pozycja niesie liczbę odniesienia z arkusza, **nieedytowalną i niepoliczalną**;
- pozycja, w której odniesienie ≠ Σ etapów, świeci na czerwono w kolumnie „Pomiar z natury",
  a podpowiedź mówi: arkusz X, etapy Y, różnica Z zł;
- przełącznik w pasku narzędzi zawęża siatkę do samych rozjechanych pozycji i pokazuje ich licznik;
- wpisanie brakującej ilości w etap zdejmuje wiersz z listy **bez żadnej dodatkowej akcji**;
- „etapy są prawdą" w menu wiersza czyści odniesienie i zdejmuje wiersz na stałe — do następnego
  importu, który odniesienie odtwarza z arkusza;
- podgląd klienta nie widzi nic z powyższego;
- pusty arkusz ofertowy (kanoniczny, gdzie Pomiar to formuła) daje **listę pustą** — bo rozjazdu
  tam nie ma.

Fixture referencyjny: inwestycja 31 → **32 pozycje rozjechane, 41 377 zł**, w tym „Posadzki
z mikrocementu" (arkusz 95, etapy 55, 16 000 zł).

## What We're NOT Doing

- **Żadnego syntetycznego etapu, żadnych ujemnych ilości, żadnego kubełka.** Odrzucone przez
  właściciela: „zmieniamy w chuj model danych, żeby obsłużyć import starych arkuszy".
- **Liczba odniesienia nie dostaje kolumny w siatce.** To nie dyscyplina, tylko blokada: ścieżka
  zapisu ma trzy niezależne listy dozwolonych pól (`ITEM_FIELDS` w `v2-rows.ts:6-19`, `ItemPatchT`
  w `types.ts:57-73`, `itemPatchSchema` w `actions/kosztorys.ts:37-52`) i pola nie będzie na żadnej.
  Oszczędza to ~6 plików konfiguracji kolumn i 6 plików testów.
- **Nie podbijamy `SNAPSHOT_SCHEMA_VERSION`** (`snapshot-format.ts:8-10` — pole dodane addytywnie
  nie wymaga podbicia; podbicie unieważniłoby wszystkie zapisane wersje i wzorce globalne).
- Nie backfillujemy. Dane kosztorysowe są jednorazowe do czasu wejścia dogfoodingu na `main`
  (AGENTS.md) — kolumna startuje pusta i wypełnia ją pierwszy import.
- Nie dotykamy `restore-kosztorys.ts` / `apply-preset.ts` / `insert-kosztorys-tree.ts` — wszystkie
  delegują do `insertItems`, więc `insert-rows.ts` jest jedynym miejscem.
- Nie budujemy skakania do wiersza — nie ma takiego mechanizmu w repo (zero trafień
  `scrollIntoView` / `setActiveCell`), a filtr czyni je zbędnym.
- Nie zmieniamy tego, że pasy sekcji i stopka liczą **cały zbiór**, nie przefiltrowany
  (`kosztorys-editor-body.tsx:98-99` — świadome, zgodne z szukajką).

## Nazewnictwo

Pole: **`sheetMeasuredQty`** / kolumna `sheet_measured_qty`. W pełni angielskie (glosariusz, reguła 2
— to generyczna figura, nie rzeczownik własny arkusza; `sheetPomiar` łamałoby regułę 3). Prefiks
`sheet` niesie całą treść: „tyle twierdzi arkusz". Nazwa celowo nawiązuje do skasowanego
`measured_qty` (EX-494), bo to **jest** ta sama liczba — różni ją to, że niczego nie liczy;
komentarz przy polu musi to powiedzieć wprost, żeby nikt nie odczytał tego jako cofnięcia EX-494.

Wyliczany rozjazd: `measureDiscrepancy(row, stages, view)` w `src/lib/kosztorys/settlement-rows.ts`
— obok `hasStagesOverPlanned`, korzystając z tego samego `rowTotalQtyDone`, **nigdy nie licząc sumy
etapów od nowa** (memo na `WeakMap` istnieje właśnie po to, `kosztorys-v2-columns.tsx:317-320`).

---

## Phase 1 — Import zapisuje liczbę odniesienia

Bez tego nie ma czego pokazywać. Największa faza; reszta to warstwa widoku na gotowym polu.

### Changes

**1a. Odczyt formuł zakładki robocizny** (`sheet-import/read-sheet.ts`)

- `ImportGridsT` dostaje `robociznaFormulas: unknown[][]`.
- `read(wanted, 'FORMULA')` zamiast `read(rateTitles, 'FORMULA')` — jeden batch obejmuje wszystkie
  zakładki; `robociznaFormulas = formulaGrids[0]`, `rateFormulas = formulaGrids.slice(1)`.
- **Komentarz `:71-73` („robocizna czytana wyłącznie dla wartości, więc drugi odczyt byłby po nic")
  staje się fałszywy — przepisać go na powód, dla którego teraz jest potrzebny.**

**1b. Rozpoznanie kolumny** (`sheet-import/columns.ts`, `resolve-columns.ts`)

- `ColumnFieldT` += `'measuredQty'`; `FIELD_LABELS.measuredQty = 'Pomiar z natury'`;
  `FIELD_MATCHERS` — dopasowanie po `fold('pomiar')` (arkusze piszą „Pomiar z natury" i „pomiar
  z natury"; sprawdzić oba arkusze referencyjne przed zamrożeniem wzorca).
- Dopisać do `OPTIONAL_FIELDS` (`columns.ts:59`) — arkusz bez tej kolumny **nie może** wywalić
  importu.
- Dopisać do `ROBOCIZNA_FIELDS` (`resolve-columns.ts:106-113`), inaczej nigdy się nie rozwiąże.

**1c. Parser** (`sheet-import/parse-robocizna.ts`)

- Sygnatura: `parseRobocizna(grid, resolved, formulas)`. `build-import-plan.ts:152` przekazuje
  `grids.robociznaFormulas`.
- W literale pozycji (`:114-126`): `sheetMeasuredQty: readSheetMeasure(row, formulaRow, columns)`.
- `readSheetMeasure` zwraca `null` gdy: kolumny nie ma, komórka pusta, **albo formuła zaczyna się od
  `=`**. W przeciwnym razie liczba. **Nie używać `number()`** — jego `|| 0` jest tu regresją.
- `ParsedItemT` to `Omit<KosztorysItemT, …>`, więc nowe pole w `KosztorysItemT` wywali build tutaj,
  jeśli się o nim zapomni. To pożądane.

**1d. Warstwa danych**

- Migracja `src/migrations/20260813_0_add_sheet_measured_qty_to_kosztorys_items.ts` — wzorzec:
  `20260728_1_add_worker_to_kosztorys_stages.ts:7`, `ADD COLUMN IF NOT EXISTS … numeric` (nullable,
  bez `DEFAULT`, bez backfillu). **Ręcznie pisana** (AGENTS.md: `migrate:create` emituje fantomowy
  drift). Rejestracja w `src/migrations/index.ts`.
- `collections/kosztorys-items.ts` — pole `sheetMeasuredQty` (`number`, `admin.readOnly`). **Nagłówek
  pliku `:5-9` twierdzi dziś, że „Pomiar z natury" nie jest zapisywany — przepisać.** Brak pola w
  kolekcji = `payload.update` cicho ignoruje klucz i akcja czyszcząca nic nie robi.
- `lib/kosztorys/types.ts:36-52` — `sheetMeasuredQty: number | null` w `KosztorysItemT`.
- `lib/db/kosztorys-tree.ts` — **obie połówki**: lista `SELECT` (`:71-75`) i `mapItem` (`:134-150`).
  Brak w `mapItem` → błąd kompilacji; brak w `SELECT` → cicho `null`/`0`. Dokładnie ten hazard pilnuje
  `kosztorys-tree-sql-drift.test.ts`.
- `lib/kosztorys/insert-rows.ts` — `ITEM_INSERT_COLUMNS` (`:21-37`) **i** krotka `VALUES` w
  `insertItems` (`:123`), w jednym ruchu. Drift między nimi jest niewidoczny dla testu schematu
  (`insert-schema-drift.test.ts:20` mówi to wprost) — łapie go dopiero roundtrip z Fazy 5.
- `lib/kosztorys/serialize-preset.ts:14-21` — **zerowanie do `null`** obok `plannedQty: 0`. Wzorzec to
  szkielet na inną inwestycję; pomiar z cudzej budowy nie ma tam czego szukać.
- `lib/kosztorys/row-ops.ts:37-64` `buildBlankRow` — dopisać `sheetMeasuredQty: null`. Funkcja kończy
  się rzutowaniem `as KosztorysV2RowT` (`:64`), więc kompilator tego nie wyłapie.
- `sheet-import/build-import-plan.ts:209-222` — pole jedzie ze `...sheetItem` (`:210`) i **musi
  zostać nadpisane**, czyli **nie** kopiować idiomu `current?.x ??` używanego dla `note` /
  `hiddenInExport` (`:218-221`). Pozycje zatrzymane (`:257`) zachowują swoją wartość.
- `pnpm generate:types` (plik gitignorowany).

### Success criteria

#### Automated

- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/parse-robocizna.test.ts` —
      nowe przypadki: wpis ręczny trafia do `sheetMeasuredQty`; komórka z formułą → `null`; komórka
      pusta → `null`; brak kolumny → `null` na wszystkich pozycjach.
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/resolve-columns.test.ts` — kolumna
      rozpoznana; jej brak **nie** produkuje problemu blokującego.
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts` —
      ponowny import **nadpisuje** odniesienie na pozycji dopasowanej; pozycja zatrzymana zachowuje swoje.
- [ ] `pnpm test:integration` — `insert-schema-drift` i `kosztorys-tree-sql-drift` zielone po migracji.
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts` — wzorzec
      nie niesie odniesienia.
- [ ] `pnpm typecheck`

#### Manual

- [ ] Import inwestycji 31 z arkusza `1s5HKoWbXtY8Kw183ggTsacMq6dgJiuqA566wOjopwsA`: 32 pozycje
      z odniesieniem ≠ Σ etapów, suma różnic 41 377 zł.
- [ ] Import arkusza kanonicznego (16 lipca): **zero** pozycji z odniesieniem — Pomiar jest tam formułą.

---

## Phase 2 — Czerwony znacznik i podpowiedź na „Pomiar z natury"

### Changes

- `lib/kosztorys/settlement-rows.ts` — `measureDiscrepancy(row, stages, view)`: `null` gdy
  `sheetMeasuredQty == null`, inaczej `sheetMeasuredQty − rowTotalQtyDone(…)`. Porównanie ilości
  z tolerancją (ilości bywają ułamkowe; rekoncyliacja pieniędzy jest groszowo dokładna
  `reconciliation.ts:41`, ale to inna oś — dobrać epsilon do jednostek, nie do złotówek).
- `grid/cells/computed-cell.tsx` — `ComputedCellDataT` += `tip?: (row) => string | null`, wynik
  owinięty w `SimpleTooltip`. ~10 linii w jednym współdzielonym pliku, działa dla wszystkich ~15
  kolumn wyliczanych. **Tożsamość komponentu zostaje na poziomie modułu**, funkcja idzie przez
  `columnData` (`computed-cell.tsx:23-27` — pułapka remountu, `lessons.md:145-156`).
- `kosztorys-v2-columns.tsx`, kolumna `stageQtySum` (`:341`):
  - `tone: (r) => measureDiscrepancy(r, stages, view) != null ? 'danger' : undefined` — wzorzec
    `donePercent` (`:450`);
  - `tip: (r) => …` — tekst w rejestrze arkusza: „Arkusz: 95 · etapy: 55 · różnica 16 000 zł".
    Kwota liczona istniejącym `netForQtyForView` na różnicy ilości, nie liczona ręcznie.
- Bramka podglądu: znacznik i podpowiedź tylko gdy `!preview`.

### Success criteria

#### Automated

- [ ] Spec dla `measureDiscrepancy` w `src/__tests__/lib/kosztorys/` — brak odniesienia → `null`;
      równe → `null`; arkusz > etapy → dodatnia; arkusz < etapy → ujemna (obie strony krzyczą).
- [ ] `pnpm typecheck`

#### Manual

- [ ] Inwestycja 31, sekcja Podłogi: „Posadzki z mikrocementu" na czerwono, podpowiedź niesie 95 / 55 / 16 000 zł.

---

## Phase 3 — Filtr „tylko rozjechane" z licznikiem

### Changes

- Stan **ulotny** `useState` w `use-kosztorys-editor.ts`, obok `search` (`:172`) i
  `collapsedSectionIds` (`:179-181`) — tryb pracy, nie preferencja; zapamiętany przywitałby
  właściciela pustą siatką bez wyjaśnienia. Uzasadnienie jest już zapisane przy zwijaniu sekcji.
- Pod podglądem wymuszony `false` — wzorzec przypinania `view` (`use-kosztorys-editor.ts:171`).
- Trzeci etap w memo `viewRows` (`:394-398`), **przed** `buildSectionBandRows` — pasy liczą się
  z wierszy już przefiltrowanych, więc pusta sekcja nie emituje pasa za darmo
  (`section-band-rows.ts:58-63`).
- `section-band-rows.ts:35` — `searchActive` rozszerzyć do `foldSuppressed = searchActive ||
  divergedOnly`, żeby zwinięta sekcja nie zasłoniła rozjechanego wiersza.
- Pasek narzędzi: przełącznik obok `KosztorysSectionFilterMenu`, licznik przez istniejący
  `src/components/ui/count-badge.tsx`. Renderowany tylko gdy `!preview`
  (`kosztorys-editor-body.tsx:175-186` już to zapewnia dla całego paska).
- Licznik liczy **cały zbiór**, nie widoczny — inaczej po włączeniu filtra pokazywałby sam siebie.

### Success criteria

#### Automated

- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/section-band-rows.test.ts` — sekcja bez
      rozjechanych pozycji nie emituje pasa; zwinięta sekcja z rozjechaną pozycją **pokazuje** ją.
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts` — filtr zwraca
      wyłącznie pozycje z rozjazdem.
- [ ] `pnpm typecheck`

#### Manual

- [ ] Inwestycja 31: licznik pokazuje 32; po włączeniu filtra widać 32 wiersze; wpisanie brakującej
      ilości w etap zdejmuje wiersz i licznik spada na 31.

---

## Phase 4 — Akcja „etapy są prawdą"

### Changes

- `lib/actions/kosztorys.ts` — dedykowana akcja `clearSheetMeasuredQtyAction` (~12 linii), wzorzec
  `updateItemFieldAction` (`:108-120`): `protectedAction(…, ['kosztorysItems'], { deferRefresh: true })`.
  **Celowo osobna zamiast dopisania klucza do `itemPatchSchema`** — dzięki temu „odniesienie jest
  tylko do odczytu" pilnuje typ, nie dyscyplina.
- Menu wiersza (`grid/menus/kosztorys-row-actions-menu.tsx`) — pozycja w grupie „Praca", widoczna
  **tylko** gdy wiersz ma odniesienie. Bez `ConfirmDialog` (odwracalne przez ponowny import), ale
  z podpowiedzią mówiącą, co zniknie.
- Nowy callback w `BuildV2ColumnsOptsT` (`kosztorys-v2-column-opts.ts:46-67`), wpięty w
  `use-kosztorys-editor.ts:348-357` przez `editorOnly()` (`:321`) — to bramka podglądu dla wszystkich
  akcji wiersza.
- Optymistycznie przez istniejące `patchRows` (`use-kosztorys-editor.ts:980-988`, wzorzec
  `handleSetSectionColor` `:966`) — patchuje `rows` i `prevById.current` razem.

### Success criteria

#### Automated

- [ ] Spec akcji w `src/__tests__/lib/actions/` — asercja na **stanie zapisanym** (pole = `NULL`
      w bazie), nie na wyniku akcji.
- [ ] `pnpm typecheck`

#### Manual

- [ ] „etapy są prawdą" na pozycji rozjechanej: wiersz znika z listy, licznik spada; po odświeżeniu
      strony nadal go nie ma; po ponownym imporcie **wraca**, bo arkusz nadal twierdzi swoje.

---

## Phase 5 — Guardy przecinające warstwy

Trzy rzeczy, których żadna faza wyżej nie pilnuje same z siebie, a każda jest cichą regresją.

### Changes

- **Nigdy nie wyceniane.** Spec w `kosztorys-v2-rows.test.ts`: wiersz różniący się **wyłącznie**
  odniesieniem nie produkuje `itemPatch`. To pinuje „read-only" jako test, nie konwencję.
- **Nie wycieka do klienta.** Spec w `src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`
  (`:93-122` — istniejące miejsce na takie przypadki): pod podglądem brak tonu `danger`, brak
  podpowiedzi, brak przełącznika, brak akcji. Ładunek **będzie** niósł liczbę
  (`preview-kosztorys.ts:20-22` — świadoma decyzja właściciela); bramką jest render.
- **Przeżywa zapis i odtworzenie wersji.** `serialize-restore-roundtrip.test.ts:31-60` porównuje całe
  pozycje po `serialize → restore → serialize` na prawdziwej bazie, więc pole zgubione w krotce
  `VALUES` wywala się samo. Rozszerzyć fixture o niezerową wartość, żeby test faktycznie ją niósł.
- **Skrypty seedujące** (`src/scripts/seed-kosztorys.ts`, `seed-kosztorys-reconciliation.ts`,
  `perf-seed-kosztorys.ts`, `seed-kosztorys-bands.ts`) — literały pozycji. `seed-kosztorys.ts` czyta
  arkusz, więc powinien nieść realne odniesienie; reszta `null`. Bez tego `pnpm seed:kosztorys:test`
  zostawia zbiór, na którym `pnpm test:parity` nie testuje o tym niczego (AGENTS.md).

### ⚠️ Hazard: golden master

`src/__tests__/financial-golden-master-db.test.ts:139-158` hashuje m.in. `sum(sp.qty)`. Zmienione
dane wejściowe powodują **ciche pominięcie** (`:314-370`), nie czerwony test. Przed jakimkolwiek
`test:golden:update` **skopiować** `src/__tests__/fixtures/financial-golden-master.json` na bok
i porównać ręcznie. `investment-render-parity-db.test.ts` tego nie złapie — porównuje dwa rendery
tej samej figury.

### Success criteria

#### Automated

- [ ] `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts`
- [ ] `pnpm test:integration` (roundtrip + drift)
- [ ] `pnpm test:parity` po `pnpm db:import:test && pnpm seed:kosztorys:test`
- [ ] `pnpm typecheck && pnpm lint`

---

## Open Risks & Assumptions

1. **Wzorzec dopasowania nagłówka.** Zakładam, że „Pomiar z natury" da się dopasować po `fold('pomiar')`
   bez kolizji z inną kolumną. Do sprawdzenia na obu arkuszach referencyjnych **w fazie 1**, zanim
   wzorzec zamarznie — `resolveFields` zgłasza problem przy trafieniu w >1 kolumnę
   (`resolve-columns.ts:98-100`), więc kolizja jest głośna, ale lepiej jej nie mieć.
2. **Formuła jako sygnał.** Cała wartość funkcji stoi na tym, że `=SUM(D:M)` znaczy „nie ma tu
   ręcznego pomiaru". Dowody: kanoniczny 435/435 formuł, inwestycja 31 — 0/245, arkusz testowy
   0/253 (`change.md`). Ryzyko resztkowe: arkusz, w którym część wierszy ma formułę, a część wpis
   — to jest obsłużone per wiersz, nie per arkusz, więc działa.
3. **Epsilon porównania ilości.** Ilości bywają ułamkowe (m², mb). Porównanie na gołe `!==` zapali
   pół kosztorysu na czerwono przez śmieci zmiennoprzecinkowe. Do rozstrzygnięcia w fazie 2 —
   sugestia: zaokrąglenie do tej samej precyzji, w jakiej ilości są zapisywane, nie arbitralny epsilon.
4. **Podpowiedź w komórce wyliczanej to nowa powierzchnia** dzielona przez ~15 kolumn. Zmiana jest
   mała i addytywna (`tip` opcjonalny), ale dotyka wszystkiego, co wyliczane.

---

## Whole-tree Gate

Uruchamiane **raz**, po ostatniej fazie — nie po każdej.

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:integration`
- [ ] `pnpm build`

`pnpm test:parity` wymaga świeżego `db:import:test` + `seed:kosztorys:test` — uruchamiane ręcznie
przy weryfikacji, nie w bramce.

---

## Progress

### Phase 1: Import zapisuje liczbę odniesienia

- [x] 1.1 Odczyt formuł zakładki robocizny w `read-sheet.ts` (+ przepisany komentarz) · 5cc3173b
- [x] 1.2 Rozpoznanie kolumny „Pomiar z natury" (`columns.ts`, `resolve-columns.ts`, opcjonalna) · 5cc3173b
- [x] 1.3 Parser czyta wpis ręczny, formuła/pusta → `null` (`parse-robocizna.ts`) · 5cc3173b
- [x] 1.4 Migracja `sheet_measured_qty` + rejestracja w `migrations/index.ts` · 5cc3173b
- [x] 1.5 Kolekcja, `KosztorysItemT`, `kosztorys-tree` (SELECT + `mapItem`), `insert-rows` (kolumny + krotka) · 5cc3173b
- [x] 1.6 `serialize-preset` zeruje, `buildBlankRow` uzupełnione, `build-import-plan` nadpisuje przy re-imporcie · 5cc3173b
- [x] 1.7 Testy fazy 1: parser, resolver, plan importu, drift schematu, wzorzec · 5cc3173b

### Phase 2: Czerwony znacznik i podpowiedź

- [x] 2.1 `measureDiscrepancy` w `settlement-rows.ts` (z progiem porównania ilości)
- [x] 2.2 `ComputedCellDataT.tip` + `SimpleTooltip` w `computed-cell.tsx`
- [x] 2.3 Ton `danger` i podpowiedź na kolumnie `stageQtySum`, tylko poza podglądem
- [x] 2.4 Spec `measureDiscrepancy`

### Phase 3: Filtr „tylko rozjechane" z licznikiem

- [ ] 3.1 Stan ulotny + wymuszenie `false` pod podglądem (`use-kosztorys-editor.ts`)
- [ ] 3.2 Trzeci etap w memo `viewRows`
- [ ] 3.3 `foldSuppressed` w `section-band-rows.ts`
- [ ] 3.4 Przełącznik + licznik w pasku narzędzi
- [ ] 3.5 Testy: pasy sekcji, filtr wierszy

### Phase 4: Akcja „etapy są prawdą"

- [ ] 4.1 `clearSheetMeasuredQtyAction` w `lib/actions/kosztorys.ts`
- [ ] 4.2 Pozycja w menu wiersza + callback przez `editorOnly()`
- [ ] 4.3 Optymistyczny `patchRows`
- [ ] 4.4 Spec akcji na stanie zapisanym

### Phase 5: Guardy przecinające warstwy

- [ ] 5.1 Spec „nigdy nie wyceniane" (`kosztorys-v2-rows.test.ts`)
- [ ] 5.2 Spec „nie wycieka do klienta" (`preview-columns.test.ts`)
- [ ] 5.3 Roundtrip niesie niezerowe odniesienie
- [ ] 5.4 Skrypty seedujące

