# Sortowanie pozycji wewnątrz sekcji — plan wdrożenia

## Overview

Sortowanie kolumny w edytorze kosztorysu ma działać **wewnątrz każdej sekcji** zamiast po całym
płaskim zbiorze wierszy (EX-682), a użytkownik ma móc **utrwalić** tak uzyskaną kolejność w
`display_order` jednej sekcji, z cofaniem (EX-683).

## Current State Analysis

- Kolejność trwała to `display_order`: pozycja wewnątrz sekcji, sekcja wewnątrz inwestycji. Czyta ją
  `selectKosztorysTreeData` (`src/lib/db/kosztorys-tree.ts:62`, `:69` — `ORDER BY display_order, id`),
  zapisują `shiftDisplayOrderFrom` / `swapDisplayOrder` (`src/lib/kosztorys/display-order.ts`).
- Sortowanie widoku istnieje i jest globalne: `use-kosztorys-editor.ts` → `viewRows` woła
  `sortRows(filtered, …)` po całej liście (`src/lib/kosztorys/row-view.ts:33`).
- Ponieważ posortowane wiersze przestają być ciągłe w obrębie sekcji, pasy sekcji są wyłączane na
  czas sortowania: `kosztorys-editor-body.tsx` przekazuje `enabled: sort == null` do
  `buildSectionBandRows`. Znika nagłówek, podsumowanie sekcji i zwijanie — a zbiór `collapsed` jest
  wtedy celowo ignorowany (`src/lib/kosztorys/section-band-rows.ts:9-13`).
- ▲▼ oraz „Wstaw powyżej/poniżej" są przy aktywnym sortowaniu wyłączone z podpowiedzią
  (`kosztorys-v2-columns.tsx:200`, `menus/kosztorys-row-actions-menu.tsx:83`), a handlery dodatkowo
  robią `if (sort) return` (`use-kosztorys-editor.ts:745`, `:775`).
- Klucz sortowania dla kolumn liczonych daje `columnSortValue` (`src/lib/kosztorys/sort-value.ts`);
  `reconcileSort` kasuje sortowanie, gdy jego kolumna znika z gridu.
- Undo ma gotowe API `pushCommand({ label, undo, redo, touchedIds })` — wzorzec strukturalnej komendy
  widać w `handleReorderItem` (`use-kosztorys-editor.ts:702-722`).
- Menu wiersza ma już grupę „Sekcja" (`menus/kosztorys-row-actions-menu.tsx:139-150`) — to naturalne
  miejsce nowej akcji.

## Desired End State

Sortowanie kolumny przestawia pozycje **w obrębie sekcji**; kolejność sekcji i ich pasy (nagłówek,
podsumowanie, zwijanie) zostają nietknięte. W menu „Sekcja" jest „Utrwal kolejność", która zapisuje
bieżący porządek sortowania do `display_order` tej sekcji — przeżywa reload i cofa się przez Cmd+Z.

### Key Discoveries:

- `buildSectionBandRows` nie potrzebuje żadnej zmiany — wystarczy, że wiersze docierają do niego
  ciągłe w obrębie sekcji; ma nawet zabezpieczenie (`headered`/`footered`) na wypadek, gdyby nie były.
- `sortRows` już poprawnie obsługuje `null` (spada na dół w obu kierunkach) i locale `pl` —
  sortowanie w sekcji musi go **wołać per grupa**, a nie kopiować komparator.
- `Array.prototype.sort` jest stabilny, więc remisy zostają w kolejności `display_order`, w jakiej
  wiersze przyszły z drzewa.
- Zapis kolejności nie może iść po `viewRows`: przy aktywnej wyszukiwarce sekcja ma tam tylko część
  pozycji. Utrwalanie liczy porządek z **pełnego** `rows` przefiltrowanego po `sectionId`.

## What We're NOT Doing

- Nie sortujemy samych sekcji (np. po wartości) — kolejność sekcji zostaje ręczna.
- Nie odblokowujemy ▲▼ ani „Wstaw powyżej/poniżej" przy aktywnym sortowaniu (decyzja: sąsiad na
  ekranie nadal nie jest sąsiadem w `display_order`; drogą wyjścia jest „Utrwal kolejność").
- Nie robimy akcji „utrwal we wszystkich sekcjach naraz" ani osobnej „Posortuj alfabetycznie"
  (alfabetycznie = posortuj po kolumnie „Opis" i utrwal).
- Nie dotykamy synchronizacji z arkuszem ani eksportu — czytają `display_order` i dostaną nową
  kolejność same z siebie.

## Implementation Approach

Trzy fazy, w kolejności ryzyka: najpierw czysto widokowa zmiana (P1), potem zapis po stronie serwera
(P2), na końcu UI + undo (P3). P1 jest samodzielnie wartościowe i może wylądować niezależnie.

---

## Phase 1: Sortowanie w obrębie sekcji (widok)

### Overview

Sortowanie przestaje rozbijać grupowanie; pasy sekcji i zwijanie działają także przy aktywnym
sortowaniu.

### Changes Required:

#### 1. Komparator per sekcja

**File**: `src/lib/kosztorys/row-view.ts`

**Intent**: dodać sortowanie zachowujące grupy — wiersze grupowane po `sectionId` w kolejności
pierwszego wystąpienia (czyli w kolejności sekcji z drzewa), każda grupa sortowana osobno, wynik
sklejony.

**Contract**: `sortRowsWithinSections(rows, getValue, dir): KosztorysV2RowT[]` — ta sama sygnatura co
`sortRows`, ta sama obsługa `null`/locale, bo w środku deleguje do `sortRows` per grupa. Nie zmienia
`sortRows` (używa go też ewentualny inny caller).

#### 2. Podpięcie w edytorze

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: `viewRows` woła nowy komparator zamiast `sortRows`.

**Contract**: bez zmiany zależności `useMemo` (`rows, search, sort, view, stages`).

#### 3. Pasy sekcji przeżywają sortowanie

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: `enabled` przestaje zależeć od `sort` — wiersze są znów ciągłe w obrębie sekcji, więc
nagłówki, podsumowania i zwijanie mają sens także przy sortowaniu.

**Contract**: `enabled` odzwierciedla tylko tryb pasów (dotąd `sort == null`); komentarz w
`section-band-rows.ts:9-13` opisujący wyłączanie pasów pod sortowaniem trzeba przepisać, bo przestaje
być prawdą.

### Success Criteria:

#### Automated Verification:

- Nowy spec `src/__tests__/lib/kosztorys/row-view-sort-within-sections.test.ts` przechodzi:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view-sort-within-sections.test.ts`
- Istniejące specy widoku gridu przechodzą:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`

#### Manual Verification:

- Sortowanie po „Opis" układa pozycje alfabetycznie wewnątrz każdej sekcji, kolejność sekcji bez zmian.
- Pas nagłówka i pas podsumowania sekcji są widoczne przy aktywnym sortowaniu.
- Zwijanie sekcji działa przy aktywnym sortowaniu; wyszukiwarka nadal chwilowo rozwija sekcje.
- Sortowanie po kolumnie z „—" (np. „Pozostało") spycha te wiersze na koniec **swojej** sekcji.

**Implementation Note**: gdy automatyczna weryfikacja tej fazy przechodzi — commit i dalej; ręczne
sprawdzenia zbieramy raz, na końcu zmiany.

---

## Phase 2: Przenumerowanie `display_order` (serwer)

### Overview

Zapis nowej kolejności całej sekcji jedną instrukcją, z tą samą dyscypliną blokad co reszta modułu.

### Changes Required:

#### 1. Masowe przenumerowanie

**File**: `src/lib/kosztorys/display-order.ts`

**Intent**: dołożyć operację nadającą wskazanym wierszom nowe `display_order` w jednym `UPDATE`, obok
istniejących `shiftDisplayOrderFrom` / `swapDisplayOrder`, w tym samym `ORDER_SCOPES`.

**Contract**: `renumberDisplayOrder(payload, scope, refs: DisplayOrderRefT[])` + schemat
`renumberDisplayOrderSchema` (`z.array(displayOrderRefSchema).min(1)`, unikalne `id`, unikalne
`displayOrder`). Blokady jak w `swapDisplayOrder`: podzapytanie `SELECT … ORDER BY id FOR UPDATE`,
inaczej ta operacja i `shiftDisplayOrderFrom` mogą się zakleszczyć (EX-632). Aktualizuje `updated_at`.

```sql
UPDATE kosztorys_items AS t SET display_order = v.ord, updated_at = now()
FROM (VALUES (…, …)) AS v(id, ord)
WHERE t.id = v.id AND t.id IN (SELECT id FROM kosztorys_items WHERE id IN (…) ORDER BY id FOR UPDATE)
```

#### 2. Akcja serwerowa

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: akcja utrwalająca kolejność pozycji jednej sekcji; obok `swapItemOrderAction`.

**Contract**: `renumberItemOrderAction(sectionId: number, refs)` przez `protectedAction(...,
['kosztorysItems'])`. Waliduje `renumberDisplayOrderSchema` i **sprawdza po stronie serwera**, że
wszystkie `id` należą do `sectionId` (klient przysyła identyfikatory — bez tego można przenumerować
cudzą sekcję). Rozbieżność → `success: false` z komunikatem, bez zapisu.

### Success Criteria:

#### Automated Verification:

- Nowy spec DB `src/__tests__/lib/actions/kosztorys-renumber-order.test.ts` przechodzi:
  `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-renumber-order.test.ts`
  (zapisana kolejność po ponownym odczycie drzewa; odrzucenie `id` spoza sekcji — sprawdzane na
  stanie w bazie, nie na zwrotce akcji)
- Istniejący spec kolejności przechodzi:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/display-order.test.ts`

#### Manual Verification:

- Brak (faza bez UI) — weryfikacja przez specy.

---

## Phase 3: „Utrwal kolejność" w menu sekcji + cofanie

### Overview

Pozycja menu, optymistyczna zmiana kolejności w gridzie, zapis i wpis w historii cofania.

### Changes Required:

#### 1. Plan przenumerowania (czysta funkcja)

**File**: `src/lib/kosztorys/display-order-plan.ts` (nowy)

**Intent**: wyliczyć z pełnego zbioru wierszy nową kolejność jednej sekcji według aktywnego klucza
sortowania — testowalny rdzeń akcji, bez Reacta i bez zapisu.

**Contract**: `planSectionRenumber(rows, sectionId, getValue, dir): { before: DisplayOrderRefT[];
after: DisplayOrderRefT[] }`. Liczy z **pełnego** `rows` (nie z `viewRows` — przy aktywnej
wyszukiwarce sekcja miałaby tam tylko część pozycji), używa `sortRows`, przydziela `0…n-1`. Zwraca
`before` w takiej postaci, żeby cofnięcie było ponownym wywołaniem tej samej akcji zapisu.

#### 2. Handler w edytorze

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: `handlePersistSectionOrder(sectionId)` — optymistycznie ustawia nowe `displayOrder` i
przestawia wiersze sekcji w `rows`, woła akcję z P2 i wrzuca komendę cofania.

**Contract**: no-op gdy `sort == null` (akcja utrwala _aktywne_ sortowanie). Wzorzec jak
`handleReorderItem` (`:702`): akcja wołana z handlera zdarzenia, nie z updatera `setRows`; brak
odświeżania sum (kolejność nie zmienia żadnej kwoty); `pushCommand({ label: 'Utrwalenie kolejności',
undo/redo → ten sam zapis z `before`/`after`, touchedIds: id pozycji sekcji })`. Sortowanie widoku
zostaje włączone — użytkownik sam je czyści, gdy chce znów ▲▼.

#### 3. Pozycja w menu

**Files**: `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx`,
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`,
`src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`

**Intent**: w grupie „Sekcja" dodać „Utrwal kolejność", aktywną tylko przy włączonym sortowaniu;
przy wyłączonym — wyszarzona z podpowiedzią, że najpierw trzeba posortować kolumnę.

**Contract**: nowe pole w `SectionActionsT` (`onPersistOrder`) — grupa „Sekcja" jest all-present /
all-absent, więc dochodzi do tego samego pęku pod `editorOnly()`. Podpowiedź przy zablokowanych ▲▼
(`sortHint`, `:83`) zyskuje drugie zdanie: utrwalenie kolejności jest drogą wyjścia.

### Success Criteria:

#### Automated Verification:

- Nowy spec `src/__tests__/lib/kosztorys/display-order-plan.test.ts` przechodzi:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/display-order-plan.test.ts`
  (kolejność `0…n-1`, tylko wskazana sekcja, pełny zbiór mimo aktywnego filtra, `before` odwraca `after`)

#### Manual Verification:

- Sortowanie po „Opis" → „Utrwal kolejność" w menu sekcji → wyczyszczenie sortowania → kolejność
  została; po odświeżeniu strony nadal ta sama.
- Cmd+Z przywraca poprzednią kolejność; Cmd+Shift+Z ponownie ją utrwala.
- „Utrwal kolejność" jest wyszarzona bez aktywnego sortowania i tłumaczy dlaczego.
- Utrwalenie przy wpisanej frazie w wyszukiwarce porządkuje **całą** sekcję, nie tylko widoczne wiersze.
- Po utrwaleniu ▲▼ działają normalnie (po wyczyszczeniu sortowania).

---

## Testing Strategy

### Unit Tests:

- `sortRowsWithinSections`: kolejność sekcji zachowana, sort tylko w grupie, stabilność remisów,
  `null` na końcu swojej grupy w obu kierunkach, pusta lista.
- `planSectionRenumber`: `0…n-1`, izolacja sekcji, niezależność od filtra, `before` jako odwrotność.

### Integration Tests:

- Spec DB akcji przenumerowania: zapis widoczny po ponownym odczycie drzewa; odrzucenie `id` spoza
  sekcji (asercja na stanie w bazie, nie na zwrotce akcji).

### Manual Testing Steps:

1. Włącz sortowanie po „Opis" — sprawdź pasy sekcji i kolejność sekcji.
2. Zwiń sekcję przy aktywnym sortowaniu, rozwiń, wpisz frazę w wyszukiwarkę.
3. „Utrwal kolejność" → wyczyść sortowanie → odśwież stronę.
4. Cmd+Z / Cmd+Shift+Z.
5. Po utrwaleniu ▲▼ na pozycji sekcji.

E2E (poziom przeglądarki) nie wchodzi w tę zmianę — do autorstwa albo odłożenia z etykietą
`e2e-backlog` na bramce przeglądu, zgodnie z `AGENTS.md`.

## Performance Considerations

Sortowanie w grupach jest tym samym rzędem kosztu co dzisiejsze globalne (jedno przejście grupujące
plus `sort` per grupa). Zapis dotyczy jednej sekcji, jedną instrukcją — świadomie nie robimy wariantu
„wszystkie sekcje naraz", bo przy 1000+ pozycjach to zupełnie inny rozmiar zapisu.

## Migration Notes

Brak — żadnej zmiany schematu. `display_order` już istnieje i jest zapisywalne.

## Whole-tree Gate

Uruchomić **raz**, po ostatniej fazie:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build` (w worktree: `next build --webpack`, patrz `context/foundation/lessons.md`)

## References

- Linear: **EX-682** (faza 1), **EX-683** (fazy 2-3)
- Kolejność i blokady: `src/lib/kosztorys/display-order.ts`
- Wzorzec komendy strukturalnej: `src/components/kosztorys/editor/use-kosztorys-editor.ts:702-722`
- Pasy sekcji: `src/lib/kosztorys/section-band-rows.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Sortowanie w obrębie sekcji (widok)

#### Automated

- [x] 1.1 Spec `row-view-sort-within-sections.test.ts` przechodzi — f5acb87e
- [x] 1.2 Specy `kosztorys-v2-rows.test.ts` + `kosztorys-sort-value.test.ts` przechodzą — f5acb87e

### Phase 2: Przenumerowanie `display_order` (serwer)

#### Automated

- [x] 2.1 Spec `kosztorys-renumber-order.test.ts` przechodzi — fc0eb390
- [x] 2.2 Spec `display-order.test.ts` przechodzi — fc0eb390

### Phase 3: „Utrwal kolejność" w menu sekcji + cofanie

#### Automated

- [x] 3.1 Spec `display-order-plan.test.ts` przechodzi — 26c91a68

### Whole-tree Gate

- [x] G.1 `pnpm typecheck` — 26c91a68
- [x] G.2 `pnpm lint` (0 błędów, 80 wcześniejszych ostrzeżeń) — 26c91a68
- [x] G.3 `pnpm test` (142 pliki, 2162 testy) — 26c91a68
- [x] G.4 `next build --webpack` — 26c91a68
