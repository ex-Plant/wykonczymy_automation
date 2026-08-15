# Kolejność kolumn w edytorze kosztorysu — Implementation Plan

## Overview

Właściciel ustawia własną kolejność kolumn w edytorze kosztorysu, przeciągając pozycje na liście
w osobnym oknie („Ustaw kolejność kolumn…"), otwieranym z menu „Kolumny". Kolejność jest preferencją
osoby czytającej — trzymana w localStorage, globalnie dla wszystkich kosztorysów, jak szerokości
i ukryte kolumny.

Linear: **EX-692**.

## Current State Analysis

Kolejność kolumn w gridzie to po prostu kolejność tablicy `columns` — `react-datasheet-grid` nie ma
żadnego API reorderu (potwierdzone w docs: `columns` przyjmuje tablicę, `title`/`component`/
`columnData` konfigurują pojedynczą kolumnę, nic więcej). Cały mechanizm jest nasz.

Pipeline dziś (`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`):

1. `assembleV2Columns` (`:271`) buduje pełną listę w kolejności arkusza — `dataColumns` (`:572`)
   składa bloki: `divergence`, `identity`, `przedmiar`, `stageCols`, `measure`, `pricing`,
   `computed`, `komentarz`, `stageValue*Cols`, `donePercent`, `remaining`. Kolumna akcji doklejana
   na czoło (`:590`).
2. `selectV2Columns` (`:625`) filtruje (oś kwot, warstwa, etapy, ukryte, allowlist preview,
   rabat globalny), nadaje szerokości przez `withResize`, dokleja `layerGapColumn` na końcu.
3. `selectV2ToggleItems` (`:685`) zwraca pozycje pickera **w kolejności gridu**, zwijając kolumny
   etapów do wpisów grupowych przez `toggleKey` (`:597`).
4. `buildV2Grid` (`:713`) robi jeden przebieg assemble i zwraca `{ columns, columnToggleItems }`.

Stan trwały kolumn żyje w dwóch bliźniaczych hookach nad wspólnym prymitywem
`createJsonMapStore` (`src/hooks/create-json-map-store.ts`): `useColumnWidths` (`id → px`)
i `useHiddenColumns` (`id → bool`). Oba są **rzadkie** — brak klucza znaczy „domyślna wartość
z kodu", nigdy „wartość zapisana". `useHiddenColumns` uzasadnia to wprost: zaszycie domyślnych
w localStorage zamroziłoby je u każdego użytkownika i uniemożliwiło późniejszą zmianę w kodzie.

Trzy powierzchnie kotwiczą etykietę na `IDENTITY_COLUMN_ID = 'description'`
(`src/lib/kosztorys/constants.ts:55`): pas nagłówka sekcji (`section-header-cell.tsx:25`), wiersz
„Razem" (`kosztorys-synthetic-rows.tsx:95`) i stopka sekcji (`section-footer-cell.tsx:21`,
z fallbackiem na `sectionName`). Wszystkie są id-owe, nie pozycyjne — reorder ich nie zepsuje
funkcjonalnie, ale przeciągnięcie „Opis prac" na prawy kraniec zostawiłoby pas sekcji pusty po lewej
z nazwą na końcu.

W aplikacji **nie ma dziś żadnego sortable DnD** — jedyne `onDrop` to dropzone'y plików
(`src/components/ui/file-input.tsx`, `line-items-field.tsx:238`). Reorder pozycji i sekcji
w kosztorysie (`onReorderItem`, `onReorderSection`) jest menu-based. `framer-motion` 12 jest już
w `package.json`, więc `Reorder.Group` / `Reorder.Item` nie dokłada zależności.

## Desired End State

W menu „Kolumny" (`KosztorysViewMenu`) jest pozycja „Ustaw kolejność kolumn…", która otwiera okno
z pionową listą grup kolumn. Przeciągnięcie pozycji zmienia kolejność kolumn w gridzie natychmiast
po puszczeniu. Kolejność przeżywa reload i przenosi się między kosztorysami. Przycisk „Przywróć
domyślną" kasuje zapis i wraca do kolejności arkusza. Widok klienta (preview) kolejności nie
honoruje. Współdzielony `ColumnToggleMenu` (5 tabel TanStack) pozostaje bajt w bajt taki sam.

Weryfikacja: przeciągnięcie „Cena j.m." przed „Przedmiar" przestawia kolumny w gridzie; po `F5`
kolejność zostaje; link do widoku klienta pokazuje kolejność arkuszową.

### Key Discoveries

- Kolejność = kolejność tablicy `columns`; dsg nie ma API reorderu — cały mechanizm nasz.
- `columnToggleItems` (`kosztorys-v2-columns.tsx:685`) to już gotowa lista do przeciągania:
  zdeduplikowana przez `toggleKey`, z labelami z `columnLabelForView`, w kolejności gridu, z flagą
  `visible`.
- Kolumny etapów mają dynamiczne id (`stage_<id>`, `stageValueNet_<id>`, …) — jednostką reorderu
  musi być **grupa z `toggleKey()`**, nie surowe id. Cztery grupy: ilości + kwota netto + brutto + %.
- `createJsonMapStore` + `useJsonMap` (`src/hooks/create-json-map-store.ts`) to gotowy prymityw
  na trzeci taki hook; `update()` jest updaterowy i pomija zapis przy zwrocie tej samej referencji.
- Kolumny są wirtualizowane poziomo (`useVirtualizer` `horizontal: true`, dsg `Grid.js:61`) —
  powód, dla którego drag nagłówków w gridzie odpada.
- `DEFAULT_COLUMN_MIN_WIDTH`/`withResize` (`:168`) i `appendTrailingGap` (`:676`) działają na
  gotowej liście — sort musi wejść **przed** nimi, żeby `layerGap` został na końcu.

## What We're NOT Doing

- **Nie ruszamy `src/components/ui/column-toggle-menu.tsx`** ani jego adaptera `column-toggle.tsx` —
  to prymityw pięciu tabel TanStack (transfers, leads, users, cash-registers, investments).
- Nie ruszamy listy widoczności w `KosztorysViewMenu` — dokładamy tylko jedną pozycję-komendę.
- Modal **nie** przełącza widoczności kolumn (to zostaje w pickerze).
- Żadnego dragu nagłówków w gridzie.
- Żadnego zapisu kolejności do DB — to preferencja czytelnika, nie właściwość kosztorysu.
- Osobnej kolejności per widok (klient / z narzędziami / bez narzędzi) nie robimy — jedna mapa
  rang obsługuje wszystkie, bo rangi są per-id i rzadkie.

## Implementation Approach

Trzy warstwy, każda testowalna osobno:

1. **Czysta funkcja porządkująca** w `src/lib/kosztorys/column-order.ts` + **hook stanu**
   `useColumnOrder` nad `createJsonMapStore`. Zero UI.
2. **Wpięcie w budowę kolumn** — jeden krok `orderAssembled()` zaraz po `assembleV2Columns`,
   wewnątrz `buildV2Grid` / `buildV2Columns`. Ponieważ filtr zachowuje kolejność względną,
   posortowanie **przed** filtrem daje ten sam grid, a przy okazji utrzymuje kontrakt
   `selectV2ToggleItems` („w kolejności gridu") za darmo — jeden sort zamiast dwóch.
3. **Modal** z `framer-motion` `Reorder` + pozycja-komenda w `KosztorysViewMenu`.

### Model rang — rzadka mapa, rangi ułamkowe

Bazową rangą kolumny jest jej **indeks w liście assemble**. Mapa `id → rank` w localStorage jest
rzadka: trzyma wpis tylko dla grup, które właściciel faktycznie przesunął. Po dropie zapisujemy
jeden klucz — przesuniętej grupie nadajemy rangę **pomiędzy** efektywnymi rangami jej nowych
sąsiadów (średnia; na krańcach `pierwszy − 1` / `ostatni + 1`). Remisy rozstrzyga indeks assemble.

Dlaczego nie gęste rangi 0..n dla wszystkich: zapisanie całej listy zamroziłoby dzisiejszą kolejność
domyślną w localStorage każdego użytkownika — kolumna dodana później wylądowałaby na końcu zamiast
w miejscu, które deklaruje kod. To ten sam argument, którym `useHiddenColumns` uzasadnia rzadkość
swojej mapy, i ten sam powód, dla którego kolejność domyślna zostaje zmienialna w kodzie.

Kolumny etapów nie wymagają czyszczenia kluczy à la `dropWidth`: klucze rang to statyczne nazwy grup
(`STAGES_COLUMN_GROUP`, `STAGE_VALUE_NET_COLUMN_GROUP`, …), nie id z bazy, więc skasowany etap nie
zostawia po sobie martwego wpisu.

### Kotwice — stały slot, nie „na czoło"

`actions` i `description` są **nieprzesuwalne**: zachowują swój indeks z assemble i działają jak
punkty stałe, wokół których układa się reszta. Semantyka „stały slot", a nie „wypchnij na pozycję 0",
jest tu istotna — `description` siedzi dziś **za** „Rozjazdem" (`dataColumns`: `divergence` →
`identity`), więc wypchnięcie go na czoło po cichu zmieniłoby dzisiejszy układ. Indeksy kotwic są
wyliczane z bieżącej listy przy każdym renderze, nigdy zapisywane — dodanie etapu przesuwa indeksy
i nic się nie psuje.

Efekt uboczny, który jest tu celem: `description` zostaje blisko lewej krawędzi, więc etykieta pasa
sekcji, „Razem" i stopka sekcji zawsze mają swoje miejsce.

## Phase 1: Prymityw kolejności — czysta funkcja + hook

### Overview

Cała logika rang bez UI i bez wpięcia w grid. Po tej fazie nic się nie zmienia dla użytkownika,
ale porządkowanie jest w pełni pokryte testami.

### Changes Required

#### 1. Czysta funkcja porządkująca

**File**: `src/lib/kosztorys/column-order.ts` (nowy)

**Intent**: Uporządkować listę kolumn według rzadkiej mapy rang, respektując kotwice i zwijając
kolumny etapów do grup — bez dotykania Reacta i localStorage, żeby całość dała się przetestować
jednostkowo.

**Contract**:

- `ANCHORED_COLUMN_KEYS: ReadonlySet<string>` — `'actions'`, `IDENTITY_COLUMN_ID`.
- `orderColumnKeys(keys: readonly string[], ranks: Record<string, number>): string[]` — wejściem
  jest lista **kluczy grup** w kolejności assemble (wynik `toggleKey` po dedupie). Zwraca tę samą
  listę przestawioną: kotwice zostają na swoich indeksach, reszta wypełnia pozostałe sloty
  posortowana po `ranks[key] ?? indeksAssemble`, remisy po indeksie assemble.
- `rankForMove(orderedMovableKeys: readonly string[], key: string, toIndex: number, ranks, baseRanks): number`
  — ranga, jaką trzeba zapisać, żeby `key` wylądował na `toIndex` w liście przesuwalnych: średnia
  efektywnych rang sąsiadów, a na krańcach `sąsiad ∓ 1`.
- `orderColumns<T extends { id?: string }>(columns: readonly T[], ranks, toKey: (id: string) => string): T[]`
  — wersja nad pełną listą kolumn: sortuje po kluczu grupy, zachowując wewnętrzną kolejność kolumn
  w obrębie jednej grupy (etapy zostają w swojej kolejności).

#### 2. Hook stanu

**File**: `src/components/kosztorys/editor/hooks/use-column-order.ts` (nowy)

**Intent**: Trzeci hook nad `createJsonMapStore`, obok `useColumnWidths` i `useHiddenColumns` —
rzadka mapa `klucz grupy → ranga` pod kluczem `kosztorys-v2-col-order`, globalna dla wszystkich
kosztorysów.

**Contract**: `useColumnOrder(): { ranks: Record<string, number>; setRank: (key: string, rank: number) => void; resetOrder: () => void }`.
`resetOrder` zapisuje pustą mapę (nie usuwa klucza — pusty obiekt to również stan domyślny, a zapis
przez `update` notyfikuje subskrybentów). Zwraca surową mapę, w przeciwieństwie do
`useHiddenColumns` — tu brak klucza znaczy „ranga = indeks assemble", co rozstrzyga wyłącznie
`orderColumnKeys`, a nie odczyt pojedynczego klucza, więc surowa mapa nie kłamie.

#### 3. Testy jednostkowe

**File**: `src/__tests__/lib/kosztorys/column-order.test.ts` (nowy)

**Intent**: Przypiąć zachowanie porządkowania, zanim wejdzie w grid.

**Contract**: pokrywa — pusta mapa daje kolejność assemble bez zmian; kotwice zostają na swoich
indeksach mimo rang, które chciałyby je przesunąć; przesunięcie grupy na czoło i na koniec;
`rankForMove` produkuje rangę, która po `orderColumnKeys` daje żądany indeks (round-trip); klucz
rangi dla grupy nieobecnej w liście jest ignorowany; kolumny w obrębie jednej grupy etapowej
zachowują wzajemną kolejność.

### Success Criteria

#### Automated Verification:

- Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/column-order.test.ts`

#### Manual Verification:

- (brak — faza bez UI)

---

## Phase 2: Wpięcie kolejności w budowę kolumn

### Overview

Grid i picker zaczynają honorować mapę rang. Bez UI do zmiany kolejności — weryfikowalne przez
testy i ręcznie przez wpis w localStorage.

### Changes Required

#### 1. Krok porządkujący w budowie kolumn

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Posortować listę raz, zaraz po assemble, tak żeby grid i picker widziały tę samą
kolejność bez dwóch przebiegów sortowania.

**Contract**: `BuildV2ColumnsOptsT` (`kosztorys-v2-column-opts.ts`) dostaje opcjonalne
`columnRanks?: Record<string, number>`. `buildV2Grid` i `buildV2Columns` wołają nowy, lokalny
`orderAssembled(assembled, opts)` między `assembleV2Columns` a `selectV2Columns` /
`selectV2ToggleItems`. `orderAssembled` zwraca listę bez zmian, gdy `opts.previewVisible` jest
ustawione albo `columnRanks` jest puste — widok klienta nie honoruje preferencji właściciela
(ruling 2026-07-28), tak samo jak nie honoruje osi, warstwy i ukrytych. Sort używa `toggleKey` jako
funkcji klucza, więc kolumny etapów przenoszą się blokiem.

#### 2. Wpięcie hooka w edytor

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Podać rangi do budowy kolumn i wystawić sterowanie kolejnością na kontekst edytora,
żeby menu i modal miały do niego dostęp bez prop-drillingu.

**Contract**: `useColumnOrder()` wołany obok `useColumnWidths()` / `useHiddenColumns()`;
`columnRanks: ranks` dokładane do `columnOpts` (obok `isHidden` i `widths`); zwracany obiekt
edytora niesie `columnRanks`, `setColumnRank`, `resetColumnOrder`. Kolejność kolumn nie unieważnia
sortu wierszy — istniejąca logika czyszczenia sortu (`renderedFieldIds`) patrzy na zbiór id, nie na
ich kolejność, więc zostaje bez zmian.

#### 3. Test zestawu kolumn

**File**: `src/__tests__/components/kosztorys/editor/grid/v2-columns-order.test.ts` (nowy)

**Intent**: Przypiąć trzy rzeczy, których czysta funkcja sama nie broni: że preview ignoruje rangi,
że kotwice trzymają swoje sloty w prawdziwym zestawie kolumn i że `layerGap` zostaje ostatni.

**Contract**: buduje kolumny przez `buildV2Grid` z `columnRanks` przestawiającymi `price` przed
`plannedQty`; asserty na kolejności `columns.map(c => c.id)` oraz `columnToggleItems.map(i => i.id)`;
osobny przypadek z `previewVisible: true` (+ `view: 'client'`, którego wymaga `assertDisclosurePair`)
sprawdza, że kolejność jest arkuszowa mimo rang.

### Success Criteria

#### Automated Verification:

- Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/v2-columns-order.test.ts`
- Istniejące specy kolumn nadal przechodzą: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/`

#### Manual Verification:

- Ręczny wpis `{"price": -1}` w localStorage pod `kosztorys-v2-col-order` przestawia „Cena j.m."
  na początek ruchomej części gridu po odświeżeniu.
- Link do widoku klienta z tym samym wpisem pokazuje kolejność arkuszową.

---

## Phase 3: Okno „Ustaw kolejność kolumn"

### Overview

Wejście z menu „Kolumny" i lista przeciągana. Po tej fazie funkcja jest kompletna.

### Changes Required

#### 1. Okno kolejności

**File**: `src/components/kosztorys/editor/dialogs/column-order-dialog.tsx` (nowy)

**Intent**: Pionowa lista grup kolumn do przeciągania, plus powrót do kolejności domyślnej.

**Contract**: props `{ open, onOpenChange, items: ColumnToggleItemT[], ranks, onSetRank, onReset }`.
Lista dzieli `items` na kotwice (`ANCHORED_COLUMN_KEYS`) i resztę: kotwice renderują się jako
statyczny blok na górze, z podpisem że zostają na początku i bez uchwytu; reszta jedzie w jednej
`Reorder.Group axis="y"` z `framer-motion`. `onReorder` wylicza nową rangę przez `rankForMove`
i zapisuje **jeden** klucz. Kolumny ukryte w pickerze są na liście, wyszarzone, z ikoną
przekreślonego oka — nadal przeciągalne, żeby dało się ustawić miejsce kolumny zanim się ją pokaże.
Stopka: „Przywróć domyślną kolejność" (disabled, gdy mapa rang jest pusta) i „Zamknij".

#### 2. Wejście w menu „Kolumny"

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx`

**Intent**: Dołożyć jedną pozycję-komendę otwierającą okno, nie ruszając listy widoczności.

**Contract**: `CommandItem` z `forceMount`, tuż obok istniejącego „Pokaż/Ukryj wszystkie" —
`forceMount` z tego samego powodu co tam: to komenda, nie kolumna, więc nie może znikać pod
wyszukiwarką. Stan `open` trzymany w `KosztorysViewMenu`; `<ColumnOrderDialog>` renderowany jako
**rodzeństwo** `<DropdownMenu>`, poza `DropdownMenuContent` — dialog wewnątrz treści menu zniknąłby
razem z menu przy zamknięciu i przegrałby walkę o focus (ta sama klasa problemu, którą
`header-menu.tsx:65` gasi przez `onCloseAutoFocus`).

### Success Criteria

#### Automated Verification:

- Ta faza nie ma własnej weryfikacji automatycznej — cały jej ciężar to zachowanie DnD w przeglądarce.
  Pokrycie idzie do E2E (patrz Testing Strategy), nie do dodatkowego specu jednostkowego pod modal.

#### Manual Verification:

- Menu „Kolumny" → „Ustaw kolejność kolumn…" otwiera okno; menu zamyka się, okno zostaje i ma focus.
- Przeciągnięcie „Cena j.m." nad „Przedmiar" przestawia kolumny w gridzie po zamknięciu okna.
- Przeciągnięcie grupy etapów przenosi wszystkie kolumny etapów blokiem.
- „Opis prac" i kolumna akcji nie mają uchwytu i nie dają się przeciągnąć.
- Kolumna ukryta w pickerze jest na liście wyszarzona; po przeciągnięciu i pokazaniu jej w pickerze
  ląduje na ustawionym miejscu.
- Kolejność przeżywa `F5` i jest ta sama na innym kosztorysie.
- „Przywróć domyślną kolejność" wraca do układu arkusza.
- Widok klienta (link udostępniony) pokazuje kolejność arkuszową niezależnie od ustawień właściciela.
- Zmiana kolejności nie psuje przeciągania krawędzi kolumny (szerokości) ani sortowania z nagłówka.

---

## Testing Strategy

### Unit Tests

- `src/__tests__/lib/kosztorys/column-order.test.ts` — rangi, kotwice, round-trip `rankForMove`,
  spójność grup etapowych (Faza 1).
- `src/__tests__/components/kosztorys/editor/grid/v2-columns-order.test.ts` — preview ignoruje
  rangi, kotwice trzymają sloty w prawdziwym zestawie, `layerGap` zostaje ostatni (Faza 2).

### E2E

Zmiana jest browser-level (DnD + localStorage + rerender gridu), więc zgodnie z `AGENTS.md` należy
jej się spec E2E. Autorstwo albo odłożenie zapada na bramce przeglądowej: spec w `e2e/` przeciągający
pozycję w oknie i sprawdzający kolejność nagłówków gridu po reloadzie, **albo** issue w Linearze
z labelem `e2e-backlog` w projekcie „Wykonczymy". Nie uruchamiamy `pnpm test:e2e` bez wyraźnej prośby.

### Manual Testing Steps

Zebrane w blokach „Manual Verification" faz 2 i 3; `/10x-implement` przenosi je do
`context/foundation/manual-checks.md` przy ostatniej fazie.

## Performance Considerations

Sort działa na ~25 grupach raz na render budowy kolumn, w tym samym miejscu co istniejący filtr —
pomijalne. Zapis po dropie to jeden klucz w localStorage, nie cała mapa. Świadomie **nie**
przestawiamy kolumn w trakcie przeciągania w gridzie — okno jest osobną powierzchnią, więc grid
przelicza się raz, po zmianie rangi.

## Migration Notes

Brak. Mapa rang startuje pusta, a pusta mapa to dokładnie dzisiejsza kolejność arkuszowa. Nowa
kolumna dodana w kodzie ląduje na swoim zadeklarowanym miejscu, bo nieprzesunięte klucze nie mają
wpisu (to jest cel rzadkiej mapy).

## Whole-tree Gate

Uruchamiane **raz**, po ostatniej fazie:

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy jednostkowe: `pnpm test`
- Build: `pnpm build`

## References

- Identyfikacja zmiany i ustalenia z rozmowy: `context/changes/2026-08-15-kosztorys-column-order/change.md`
- Linear: EX-692
- Bliźniacze hooki stanu kolumn: `src/components/kosztorys/editor/hooks/use-column-widths.ts`,
  `use-hidden-columns.ts`, prymityw `src/hooks/create-json-map-store.ts`
- Budowa kolumn: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:625` (`selectV2Columns`),
  `:685` (`selectV2ToggleItems`), `:713` (`buildV2Grid`)
- Kotwice etykiet: `src/lib/kosztorys/constants.ts:55`, `grid/cells/section-header-cell.tsx:25`,
  `grid/kosztorys-synthetic-rows.tsx:95`, `grid/cells/section-footer-cell.tsx:21`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Prymityw kolejności — czysta funkcja + hook

#### Automated

- [x] 1.1 Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/column-order.test.ts`

### Phase 2: Wpięcie kolejności w budowę kolumn

#### Automated

- [ ] 2.1 Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/v2-columns-order.test.ts`
- [ ] 2.2 Istniejące specy kolumn nadal przechodzą: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/`

### Phase 3: Okno „Ustaw kolejność kolumn"

#### Automated

- [ ] 3.1 (brak weryfikacji automatycznej w tej fazie — pokrycie idzie do E2E)
