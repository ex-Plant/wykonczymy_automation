# Wybór sekcji przed dodaniem pracy — plan implementacji

## Overview

„Dodaj → Praca" przestaje zgadywać sekcję docelową. Pozycja staje się podmenu z listą wszystkich
sekcji rozpiski; użytkownik wskazuje sekcję jawnie, a heurystyka „jedyna rozwinięta, w przeciwnym
razie ostatnia" znika.

## Current State Analysis

- `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx:32-34` wylicza
  `addItemSectionId`: jedyna rozwinięta sekcja (`collapsedSectionIds`) albo `subtotals.at(-1)`.
  To jedyne miejsce, gdzie ta heurystyka żyje — `handleAddItem` przyjmuje już `sectionId` z zewnątrz.
- `handleAddItem` (`use-kosztorys-editor.ts:717`) jest gotowe na dowolną sekcję: woła `addItemAction`,
  dokleja wiersz przez `applyAddItem` po ostatnim wierszu tej sekcji i rozwija ją (`unfoldSection`).
  Ta część nie wymaga zmian.
- `subtotals` (`use-kosztorys-editor.ts:504`) niesie `sectionId`, `sectionName`, `sectionColor`
  i `itemCount`, w kolejności występowania sekcji w rozpisce — kompletne źródło listy.
- Sekcja bez pozycji nie istnieje: `planItemRemovalFromCounts`
  (`src/lib/kosztorys/delete-policy.ts:28`) kasuje sekcję kaskadowo przy usunięciu ostatniej pozycji,
  a nowa sekcja powstaje od razu z jedną pozycją. Lista z `subtotals` jest więc zawsze kompletna.
- `DropdownMenuSubContent` (`src/components/ui/dropdown-menu.tsx:215`) nie ma ani `max-h`, ani
  `overflow-y-auto` — `DropdownMenuContent` (linia 36) ma oba. `DropdownMenuSubTrigger` nie ma z kolei
  stylów `data-[disabled]`, które niosą `Item` i `CheckboxItem`, więc `disabled` na nim nic nie
  wyszarza (ujawnione w przeglądarce po fazie 2). Przy kilkudziesięciu sekcjach podmenu
  wyjedzie poza viewport bez możliwości przewinięcia.
- Menu jest renderowane wyłącznie w widoku właściciela (klient nie ma paska narzędzi), więc `preview`
  nie wchodzi w grę.

## Desired End State

„Dodaj → Praca ▸" rozwija listę sekcji z licznikiem pozycji; kliknięcie sekcji dokleja do niej pustą
pracę i rozwija ją, dokładnie jak dziś. Żadna sekcja nie jest wyróżniona jako domyślna. Przy braku
sekcji podmenu w ogóle się nie renderuje, a „Praca" zakłada pierwszą sekcję razem z pozycją w środku. Długa lista sekcji przewija się w miejscu.

### Key Discoveries:

- Heurystyka jest lokalna w jednym komponencie — usunięcie jej nie dotyka warstwy stanu ani akcji.
- `subtotals` już niesie wszystko, czego lista potrzebuje; nie trzeba nowego selektora.
- Naprawa scrolla należy do prymitywu `ui/dropdown-menu`, nie do komponentu kosztorysu.

## What We're NOT Doing

- Nie zmieniamy „Sekcja", „Sekcja z szablonu…" ani etapów — tam doklejenie na koniec jest oczywiste.
- Nie dodajemy dialogu z wyszukiwarką sekcji ani kolorowych znaczników w liście.
- Nie ruszamy rozbieżności przy aktywnym sortowaniu kolumny (`handleAddItem` nie ma blokady
  `if (sort) return`, którą ma `handleInsertItem`) — świadomie poza zakresem.
- Nie zapamiętujemy ostatnio wybranej sekcji.

## Implementation Approach

Dwie zmiany w plikach prezentacyjnych: naprawa prymitywu podmenu, potem zamiana pozycji „Praca"
na `DropdownMenuSub` zasilane z `subtotals`.

## Phase 1: Podmenu przewija się jak menu główne

### Overview

Wyrównanie `DropdownMenuSubContent` do `DropdownMenuContent`, żeby długa lista sekcji nie wyjeżdżała
poza ekran.

### Changes Required:

#### 1. Prymityw podmenu

**File**: `src/components/ui/dropdown-menu.tsx`

**Intent**: `DropdownMenuSubContent` dostaje ograniczenie wysokości i pionowy scroll, którymi
`DropdownMenuContent` już dysponuje — dziś rozjazd między dwoma wariantami tego samego popovera.

**Contract**: klasy bazowe `SubContent` przejmują `max-h-(--radix-dropdown-menu-content-available-height)`
oraz `overflow-x-hidden overflow-y-auto` w miejsce dotychczasowego `overflow-hidden`; reszta klas
i sygnatura komponentu bez zmian.

### Success Criteria:

#### Automated Verification:

- Brak checku wąsko zakresowego dla tej fazy — to zmiana klas w prymitywie bez testu jednostkowego;
  pokrywa ją bramka całodrzewowa na końcu planu.

#### Manual Verification:

- Rozpiska z kilkudziesięcioma sekcjami: podmenu „Praca" mieści się w oknie i przewija się kółkiem
  oraz strzałkami, ostatnia sekcja jest osiągalna.
- Pozostałe podmenu w aplikacji wyglądają bez zmian przy krótkiej liście.

---

## Phase 2: „Praca ▸ wybór sekcji"

### Overview

Zamiana zgadywanki na jawny wybór sekcji w istniejącym `DropdownMenu`.

### Changes Required:

#### 1. Menu „Dodaj"

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx`

**Intent**: pozycja „Praca" staje się `DropdownMenuSub`; podmenu wypisuje sekcje z `subtotals`
(kolejność rozpiski), a wybór woła `handleAddItem(sectionId)`. Heurystyka `addItemSectionId` —
`onlyExpanded` plus `subtotals.at(-1)` — i konsumpcja `collapsedSectionIds` znikają z komponentu.
Etykieta sekcji niesie licznik pozycji, bo nazwy sekcji nie są unikalne i sama nazwa nie rozstrzyga,
o którą chodzi.

**Contract**: `DropdownMenuSubTrigger` „Praca" z ikoną `Hammer`, renderowany tylko gdy `subtotals.length > 0`;
przy pustej rozpisce w jego miejsce idzie zwykły `DropdownMenuItem` wołający `handleAddSection`; `DropdownMenuSubContent` z jednym
`DropdownMenuItem` na sekcję, `key={sectionId}`, etykieta `„<sectionName> (<itemCount> poz.)"`,
`onSelect={() => handleAddItem(s.sectionId)}`. Import `DropdownMenuSub` / `SubTrigger` / `SubContent`
z `@/components/ui/dropdown-menu`; `collapsedSectionIds` wypada z destrukturyzacji kontekstu.
Pozostałe pozycje menu (etapy, sekcja, sekcja z szablonu) bez zmian.

### Success Criteria:

#### Automated Verification:

- Brak checku wąsko zakresowego: komponent jest cienką warstwą nad `subtotals` i `handleAddItem`,
  w repo nie ma harnessu renderującego menu (sąsiednie testy to modele, np.
  `src/__tests__/components/kosztorys/editor/toolbar/menus/problems-menu-model.test.ts`), a wydzielanie
  modelu z `subtotals.map` dałoby test na własne parametry. Ryzyko pokrywa weryfikacja manualna.

#### Manual Verification:

- „Dodaj → Praca" pokazuje wszystkie sekcje rozpiski, w kolejności rozpiski, z licznikiem pozycji.
- Wybór sekcji dokleja pustą pracę na jej końcu i rozwija tę sekcję — także wtedy, gdy była zwinięta.
- Wybór sekcji innej niż ostatnia i innej niż jedyna rozwinięta trafia dokładnie tam, gdzie wskazano
  (regresja na heurystykę), i utrzymuje się po odświeżeniu strony.
- Przy rozpisce bez sekcji „Praca" nie ma strzałki podmenu i jednym kliknięciem zakłada pierwszą
  sekcję z pozycją w środku.
- Nawigacja klawiaturą: strzałka w prawo otwiera podmenu, Enter dodaje pracę do podświetlonej sekcji.

---

## Testing Strategy

Zmiana jest w całości prezentacyjna: obie warstwy pod spodem (`handleAddItem`, `addItemAction`,
`applyAddItem`) zostają nietknięte i mają już swoje testy. Nowego testu jednostkowego nie ma —
patrz uzasadnienie w kryteriach faz. Ryzyko browserowe („trafia do wskazanej sekcji") jest
kandydatem do E2E; decyzja zapada na bramce recenzji slice'a (autor albo zgłoszenie z etykietą
`e2e-backlog`).

## Whole-tree Gate

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy: `pnpm test`

## References

- Identity: `context/changes/2026-08-31-add-item-section-picker/change.md`
- Wzorzec listy sekcji w menu: `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx:40`
- Inwariant „sekcja ma ≥1 pozycję": `src/lib/kosztorys/delete-policy.ts:28`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Podmenu przewija się jak menu główne

#### Automated

- [x] 1.1 Brak checku wąsko zakresowego (pokrywa bramka całodrzewowa) — 815a3097

### Phase 2: „Praca ▸ wybór sekcji"

#### Automated

- [x] 2.1 Brak checku wąsko zakresowego (pokrywa bramka całodrzewowa) — d33de2ed
