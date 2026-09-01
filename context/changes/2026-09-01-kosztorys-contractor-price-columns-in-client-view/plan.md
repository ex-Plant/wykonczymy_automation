# Kolumny ceny wykonawcy (oba plany) w widoku Inwestora — plan wdrożenia

## Overview

Sześć kolumn stawki wykonawcy — „Źródło ceny wykonawcy", „Mnożnik", „Cena j.m. netto", każda w planie
„z narzędziami" i „bez narzędzi" — składa się w **każdym** widoku cen, jest edytowalna, domyślnie
ukryta, dostępna z pickera kolumn i **nigdy** nie trafia do podglądu inwestora ani do dialogu „co widzi
klient". Owner ma dzięki temu porównanie obu planów obok siebie bez przełączania zakładek.

Warunek postawiony przez ownera — „to muszą być idealnie te same dane zawsze" — jest spełniony
strukturalnie, nie przez pilnowanie: to te same trzy fabryki kolumn, wywołane z drugim planem.
Cała zmiana sprowadza się do jednego brakującego kawałka parametryzacji — **id kolumny**.

## Current State Analysis

- `assembleV2Columns` (`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:277-292`) ma
  jedno rozgałęzienie: widok Inwestora składa jedną edytowalną „Cena j.m. netto" (pole `clientPrice`),
  widoki wykonawcy składają trójkę `priceMode` / `priceCoeff` / `price`.
- Trzy fabryki wykonawcy (`grid/cells/subcontractor-columns.tsx:237,256,273`) biorą plan **argumentem**
  i przekazują go w `columnData`; żadna komórka nie czyta aktywnego widoku. Wywołane z widoku Inwestora
  policzą i zapiszą dokładnie to, co dziś w widoku wykonawcy.
- Wszystkie cztery pola override (`wToolsOverrideType|Value`, `ownToolsOverrideType|Value`) i oba
  domyślne mnożniki siedzą na każdym wierszu niezależnie od widoku
  (`src/lib/kosztorys/types.ts:49-53`, `v2-rows.ts:42`) — nie trzeba dowozić danych.
- Id kolumn są dziś **niesparametryzowane planem**, więc trójka wykonawcy w obu planach ma te same
  trzy id. To jedyny powód, dla którego nie da się złożyć obu planów naraz.
- Gwarancja „klient nie widzi stawek wykonawcy" stoi na **dwóch** połowach
  (`context/foundation/lessons.md:497-513`): przypięciu planu do Inwestora pod podglądem
  (`hooks/use-kosztorys-view-state.ts:54`) i allowliście `PREVIEW_VISIBLE_COLUMNS`
  (`lib/kosztorys/column-config.ts:196-198`). Ta zmiana **zabiera pierwszą połowę** dla tych sześciu id.
- Podgląd inwestora nie ma pickera w ogóle (`kosztorys-v2-columns.tsx:675-679` zwraca pustkę pod
  `previewVisible`), a dialog „co widzi klient" renderuje wyłącznie `CLIENT_VIEW_GROUPS`.
- `columnSortValue` (`lib/kosztorys/sort-value.ts:118-121`) czyta plan z **aktywnego widoku**
  i zwraca `null` w widoku Inwestora — założenie, które ta zmiana unieważnia.

### Key Discoveries

- `columnLabelForView` (`lib/kosztorys/column-config.ts:52-61`) już dziś dokleja nazwę planu do dwóch
  kolumn i jest **jedynym** źródłem etykiety dla nagłówka **i** pickera — sufiks planu ma tam gotowy dom
  i nie da się rozjechać obu list.
- `stage-keys.ts:20-66` to gotowy wzorzec namespace'u id: builder + odwrotność + rozpoznanie grupy,
  z jawnym zakazem naiwnego parsowania. Kopiujemy kształt, nie wymyślamy drugiego.
- Trzy testy-inwarianty (`kosztorys-money-axis.test.ts:96-104`, `kosztorys-layer.test.ts:92-99`,
  `client-view-groups.test.ts:14-20`) wymagają, żeby każdy otagowany klucz miał etykietę — rozwiązywanie
  map konfiguracyjnych po **kluczu bazowym** utrzymuje je bez sześciu nowych wpisów w każdej mapie.
- `AXIS_EXEMPT_COLUMNS` zawiera dziś `price` i nic dla kolumn wykonawcy nie robiło, bo oś była przypięta
  do netto na całym ich planie (`money-axis.ts:26-29`). Po zmianie zaczyna działać — i to wystarczy,
  żeby stawki przeżyły tryb „Brutto", bez dopisywania czegokolwiek.
- Klasa błędu przy sortowaniu jest **cicha**: id tych kolumn nie są polami wiersza, więc pominięcie
  `sort-value.ts` nie wyrzuci wyjątku — sort po prostu nic nie zrobi (EX-487).

## Desired End State

W każdym widoku cen picker kolumn wystawia sześć nowych pozycji („Źródło ceny wykonawcy —
z narzędziami", „Mnożnik — z narzędziami", „Cena j.m. netto — z narzędziami" i to samo dla „bez
narzędzi"), wszystkie domyślnie odznaczone. Po odznaczeniu kolumny działają identycznie jak dziś
w widoku wykonawcy: edycja zapisuje ten sam override, menu „Źródło ceny" ma te same opcje, ostrzeżenia
o stawce wyższej niż cena klienta pojawiają się tak samo. Sortowanie po nich działa w każdym widoku
i czyta plan z nazwy kolumny. Tryb „Brutto" ich nie chowa. Filtr „Problemy" odsłania kolumnę tego
planu, którego dotyczy problem. W podglądzie inwestora żadna z nich nie renderuje się nigdy, nie
istnieje w dialogu „co widzi klient" i nie da się jej tam wprowadzić żadnym zapisanym ustawieniem.

## What We're NOT Doing

- **Nie zmieniamy id klientowskiej „Cena j.m. netto"** (`price`). To inne pojęcie — cena z oferty, nie
  stawka wykonawcy — a jej klucz siedzi w allowliście podglądu i w zapisanych ustawieniach klienta
  w bazie, gdzie zgubienie go **odsłoniłoby** cenę klientowi, który ją schował
  (`client-view-settings.ts:78-81`).
- **Nie składamy klientowskiej „Cena j.m. netto" w widokach wykonawcy.** Dziś jej tam nie ma i to się
  nie zmienia — zakres to stawki wykonawcy, nie odwrotny kierunek.
- Nie ruszamy payloadu podglądu inwestora (nadal niesie komplet pól override — stan sprzed tej zmiany
  i decyzja ownera; barierą jest allowlista).
- Nie dodajemy bramek roli — owner rozstrzygnął (P10), że MANAGER widzi wszystko.
- Nie dopisujemy niczego do `CLIENT_VIEW_GROUPS` ani do żadnego wariantu ustawień klienta.
- Nie ruszamy wiersza „Razem" — kolumny cenowe nie mają totalu i nowe też nie mają.
- Nie piszemy E2E; ryzyko jest w czystej logice kolumn i pokrywają je unity.

## Implementation Approach

Jeden nowy moduł namespace'u id (na wzór `stage-keys.ts`) i jedno odgałęzienie mniej w składaniu:
gałąź cenowa przestaje pytać „który widok" i zawsze dokłada sześć kolumn planów, a widok decyduje już
tylko o klientowskiej cenie. Mapy konfiguracji (etykieta, tooltip, oś, warstwa) czytają **klucz bazowy**,
więc jedno pojęcie ma dalej jeden wpis. Allowlista podglądu i dialog klienta czytają **pełne id**, więc
nowe kolumny są dla nich po prostu nieznane — czyli odrzucone, fail-closed.

## Critical Implementation Details

**Bramka disclosure musi stać na audytorium, nie na widoku.** Po tej zmianie stawki wykonawcy renderują
się także na planie Inwestora, więc przypięcie planu przestaje je chronić i zostaje sama allowlista.
Każdy warunek dotyczący podglądu pisze się przeciw `opts.previewVisible`, nigdy przeciw `opts.view` —
ten dokładnie błąd został już raz popełniony (`lessons.md:468-481`).

**Rozwiązywanie po kluczu bazowym ma jeden wyjątek i jest on load-bearing.** `COLUMN_LABELS`,
`HEADER_TIPS`, `COLUMN_MONEY_AXIS`, `AXIS_EXEMPT_COLUMNS`, `COLUMN_LAYER` czytają bazę.
`PREVIEW_VISIBLE_COLUMNS`, `CLIENT_VIEW_GROUPS` i `sanitizeClientViewVariant` czytają **pełne id** —
rozwiązanie `price__own_tools` do `price` odziedziczyłoby przepustkę do podglądu i wypuściło stawkę
wykonawcy do klienta.

**Odwrotność namespace'u nie może parsować naiwnie.** `stage-keys.ts:38-45` zapisuje dlaczego:
`Number('')` to `0`, więc klucz z cudzego namespace'u musi zwrócić `null`, nie fałszywą wartość.
Tu ten sam wymóg dotyczy planu — nieznany sufiks to `null`, nie „domyślnie z narzędziami".

---

## Phase 1: Namespace planu w id i składanie sześciu kolumn

### Overview

Powstaje moduł kluczy plan↔id, trzy fabryki wykonawcy zaczynają nadawać id z sufiksem planu, a gałąź
cenowa składa oba plany w każdym widoku. Etykiety i mapy konfiguracji rozwiązują się po kluczu bazowym.

### Changes Required

#### 1. Moduł namespace'u

**File**: `src/lib/kosztorys/plane-price-keys.ts` (nowy)

**Intent**: Jedno miejsce, które decyduje jak wygląda id kolumny stawki wykonawcy w danym planie i jak
odzyskać z niego plan oraz nazwę bazową — żeby budowanie i parsowanie nie mogły się rozejść.

**Contract**: Builder z bazy (`priceMode` / `priceCoeff` / `price`) i planu na pełne id; odwrotność
zwracająca plan albo `null` dla klucza spoza namespace'u; funkcja zwracająca klucz bazowy (dla id spoza
namespace'u — samo id). Separator musi być rozłączny z `STAGE_QTY_PREFIX` i z istniejącymi id. Trzy
bazy nazwane jako jedna stała, żeby konsumenci nie wypisywali ich ręcznie.

#### 2. Fabryki kolumn wykonawcy

**File**: `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx`

**Intent**: Id kolumny przestaje być stałą, a staje się funkcją planu — jedyny kawałek tych fabryk,
którego plan dotąd nie parametryzował. Reszta (komórki, `columnData`, polityki edycji) bez zmian.

**Contract**: `id` w każdej z trzech fabryk pochodzi z buildera z modułu wyżej, dla planu, który
fabryka już dostaje argumentem. Komórki pozostają referencjami modułowymi (EX-422).

#### 3. Gałąź cenowa w składaniu

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Sześć kolumn stawki wykonawcy składa się w każdym widoku; widok decyduje już tylko o tym,
czy dołożyć klientowską „Cena j.m. netto". Kolumny planów stoją zaraz za blokiem cenowym.

**Contract**: Gałąź buduje trójkę dla każdego planu z `TOOL_PLANES` (kolejność tablicy = kolejność
wyświetlania) i dokłada klientowską cenę tylko w widoku Inwestora. `toggleKey` **nie** kolapsuje tych
id do wspólnej pozycji — każda z sześciu tyka się osobno, inaczej porównanie planów jest niemożliwe.

#### 4. Etykiety i mapy konfiguracji

**File**: `src/lib/kosztorys/column-config.ts`, `src/lib/kosztorys/header-tips.ts`

**Intent**: Jedno pojęcie ma dalej jeden wpis w każdej mapie — nazwa planu doklejana jest przy
odczycie, a nie sześcioma nowymi wpisami, które mogłyby się rozjechać.

**Contract**: `columnLabelForView` dla id z namespace'u planu zwraca etykietę bazową z myślnikiem
i `PLANE_LABELS[plan]` („Mnożnik — z narzędziami"), tym samym wzorcem, co dzisiejsze „Razem netto —
po rabacie". Tooltip, oś pieniądza i warstwa rozwiązują się po kluczu bazowym. Allowlista podglądu
i grupy dialogu klienta pozostają **niezmienione** — brak wpisu jest tu mechanizmem, nie przeoczeniem,
i zasługuje na komentarz.

### Success Criteria

#### Automated Verification:

- Nowy spec kolumn planów przechodzi: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/plane-price-columns.test.ts`
- Inwarianty map konfiguracji dalej trzymają: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/kosztorys-money-axis.test.ts src/__tests__/components/kosztorys/editor/grid/kosztorys-layer.test.ts src/__tests__/lib/kosztorys/client-view-groups.test.ts`
- Kolejność i tryb tylko-do-odczytu kolumn bez regresji: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/v2-columns-order.test.ts src/__tests__/components/kosztorys/editor/grid/v2-columns-readonly.test.ts`

#### Manual Verification:

- W widoku Inwestora po odznaczeniu w pikerze widać sześć kolumn obu planów obok ceny klienta.
- Wpisanie stawki w kolumnie „Cena j.m. netto — bez narzędzi" z widoku Inwestora daje po przełączeniu
  na widok „Bez narzędzi" tę samą wartość w tej samej pozycji.
- Menu „Źródło ceny wykonawcy" w widoku Inwestora ma te same opcje i to samo zachowanie co w widoku
  wykonawcy, łącznie z ostrzeżeniem o stawce wyższej niż cena klienta.

**Implementation Note**: Gdy automaty tej fazy przechodzą — commit i dalej; ręczne sprawdzenia zbierają
się raz, na końcu zmiany, do rejestru manual-checks.

---

## Phase 2: Sortowanie czyta plan z id

### Overview

`columnSortValue` przestaje wnioskować plan z aktywnego widoku i odczytuje go z nazwy kolumny — inaczej
sortowanie po nowych kolumnach nie działa, bez żadnego wyjątku.

### Changes Required

#### 1. Klucz sortowania

**File**: `src/lib/kosztorys/sort-value.ts`

**Intent**: Trzy kolumny stawki wykonawcy sortują się po planie zapisanym w id, w każdym widoku;
klientowska cena zostaje przy dotychczasowym zachowaniu.

**Contract**: Rozpoznanie namespace'u planu następuje **przed** `switch`, tak jak dziś dla dwóch
namespace'ów etapowych, i kieruje do istniejących funkcji (`viewPrice` / `viewCoeffSortValue` /
ranking źródła ceny) z planem z id zamiast z `view`. Gałęzie `case 'priceCoeff'` / `case 'priceMode'`
znikają — po zmianie te bazowe id nie są już id żadnej składanej kolumny. `case 'price'` zostaje
i obsługuje wyłącznie kolumnę klienta.

### Success Criteria

#### Automated Verification:

- Sortowanie obu planów: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`
- Zakres i porządek sortowania bez regresji: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view-sort-scope.test.ts src/__tests__/lib/kosztorys/row-view-sort-within-sections.test.ts`

#### Manual Verification:

- Kliknięcie nagłówka „Mnożnik — z narzędziami" w widoku Inwestora faktycznie przestawia kolejność
  wierszy, a drugie kliknięcie ją odwraca.
- Sortowanie po kolumnie jednego planu daje inną kolejność niż po kolumnie drugiego planu na tych
  samych danych.

---

## Phase 3: Widoczność, oś, reveal problemów i zamek podglądu

### Overview

Kolumny startują ukryte, przeżywają tryb „Brutto", filtr „Problemy" odsłania kolumnę właściwego planu,
a testy przypinają, że do podglądu inwestora ani do dialogu klienta nie mają wstępu.

### Changes Required

#### 1. Domyślna widoczność

**File**: `src/lib/kosztorys/column-config.ts`

**Intent**: Nikt nie zobaczy zmiany, dopóki sam nie odznaczy kolumny w pikerze — także w widokach
wykonawcy, gdzie dotąd trójka jednego planu była widoczna od razu.

**Contract**: Wszystkie sześć id trafia do `DEFAULT_HIDDEN_COLUMNS`. Zbiór jest domyślną odpowiedzią
sparsowanej mapy `use-hidden-columns.ts:28-30`, więc zapisane ticki ownera dalej wygrywają.

#### 2. Oś pieniądza

**File**: `src/lib/kosztorys/column-config.ts`

**Intent**: Stawka wykonawcy jest netto z definicji i nie ma brutto-bliźniaka, więc tryb „Brutto"
nie może jej chować.

**Contract**: Zwolnienie osiowe obejmuje kolumnę ceny obu planów — wynika to samo z rozwiązywania po
kluczu bazowym (`price` jest już zwolnione), więc zmianą jest **weryfikacja i komentarz**, nie nowy
wpis. Mnożnik i źródło ceny nie mają tagu osi, więc oś ich nie dotyczy.

#### 3. Reveal problemów per plan

**File**: `src/lib/kosztorys/row-conditions.ts`

**Intent**: Problem stawkowy odsłania kolumny tego planu, którego dotyczy, a nie obu naraz — warunek
już niesie swój plan, więc nie potrzeba nowej konfiguracji.

**Contract**: Lista kolumn odsłanianych przez warunek stawkowy buduje id przez builder namespace'u
z planu warunku; warunek bez planu (np. „bez ceny j.m.") odsłania cenę klienta i oba plany, bo braku
ceny nie da się przypisać do jednego z nich. Komentarz o „harmless no-op" znika — przestaje być prawdą.

#### 4. Zamek podglądu — testy i komentarz

**File**: `src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`,
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Przypiąć, że jedyną barierą została allowlista, i że ona wystarcza — łącznie z drogą przez
zapisane ustawienia klienta, którą da się ręcznie edytować w `/admin`.

**Contract**: Spec sprawdza trzy rzeczy: żadne z sześciu id nie renderuje się pod `previewVisible`
w żadnym widoku; picker pod `previewVisible` jest pusty; klucz stawki wykonawcy wstawiony ręcznie do
zapisanych ustawień klienta zostaje odrzucony przez `sanitizeClientViewVariant`. Asercja
`preview-columns.test.ts:159` („widok z narzędziami zawiera `priceMode`") aktualizuje się do nowych id.
Komentarz przy `assertDisclosurePair` odnotowuje, że przypięcie planu nie chroni już tych kolumn.

#### 5. Dokumentacja, która przestaje być prawdą

**File**: `context/reference/kosztorys-editor-domain-notes.md`, `src/lib/table/column-order.ts`

**Intent**: Zdanie „w widoku klienta żadna stawka wykonawcy się nie renderuje" i komentarz o skosie
indeksów składania między widokami opisują stan sprzed tej zmiany.

**Contract**: Oba miejsca opisują nowy stan: stawki obu planów składają się w każdym widoku, domyślnie
ukryte, a do podglądu inwestora nie mają wstępu. Decyzja o liczeniu problemów per plan zostaje.

### Success Criteria

#### Automated Verification:

- Zamek podglądu i picker: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts src/__tests__/lib/kosztorys/client-view-settings.test.ts`
- Reveal problemów: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts src/__tests__/components/kosztorys/editor/grid/stage-column-filter.test.ts`
- Oś pieniądza po zmianie: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/kosztorys-money-axis.test.ts src/__tests__/lib/kosztorys/money-axis.test.ts`

#### Manual Verification:

- Świeża przeglądarka (wyczyszczony localStorage): w żadnym widoku nie widać kolumn stawek, dopóki nie
  odznaczy się ich w pikerze.
- Podgląd inwestora dla inwestycji, w której owner odznaczył wszystkie sześć kolumn — żadna się nie
  pokazuje, a slim header nie ma pickera.
- Tryb „Brutto" w widoku Inwestora: „Cena j.m. netto — z narzędziami" zostaje na ekranie.
- Filtr „Problemy" ze stawką wyższą niż cena klienta w planie „bez narzędzi" odsłania kolumny tego
  planu, a nie planu „z narzędziami".

---

## Testing Strategy

### Unit Tests

- **Sortowanie czyta plan z id** — oba plany na tych samych danych dają **odwrotne** kolejności; to
  kształt, który już raz złapał czytanie złego planu (`plan-brief.md:77-78` archiwum sortowania).
  Test jednego planu przeszedłby przy błędnym odczycie.
- **Disclosure** — żadne z sześciu id nie renderuje się pod `previewVisible` w żadnym widoku; picker
  pod `previewVisible` pusty; klucz stawki wstawiony ręcznie w zapisane ustawienia klienta odrzucony.
- **Picker** — sześć pozycji w każdym widoku, z etykietami niosącymi nazwę planu, wszystkie domyślnie
  odznaczone; żadna nie kolapsuje z inną.

### Manual Testing Steps

1. Widok Inwestora → picker → odznacz sześć kolumn → wpisz stawkę w planie „bez narzędzi".
2. Przełącz na widok „Bez narzędzi" → ta sama pozycja pokazuje tę samą stawkę i to samo źródło ceny.
3. Wróć do Inwestora, przełącz tryb na „Brutto" → kolumny stawek zostają.
4. Otwórz podgląd inwestora → żadnej kolumny stawki, brak pickera.
5. Włącz filtr „Problemy" na pozycji ze zawyżoną stawką w jednym planie → odsłania się kolumna tego planu.

## Whole-tree Gate

Raz, po ostatniej fazie:

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Pełny zestaw unitów: `pnpm test`

## References

- Research: `context/changes/2026-09-01-kosztorys-contractor-price-columns-in-client-view/research.md`
- Wzorzec namespace'u id: `src/lib/kosztorys/stage-keys.ts:20-66`
- Zamek disclosure: `context/foundation/lessons.md:497-513`, `468-481`, `1240-1250`
- Kształt testu „oba plany odwrotnie": `context/archive/2026-08-17-sortowanie-kolumn-spojne/`

## Progress

> Konwencja: `- [ ]` do zrobienia, `- [x]` zrobione. Dopisz ` — <commit sha>`, gdy krok wyląduje. Nie zmieniaj tytułów kroków.

### Phase 1: Namespace planu w id i składanie sześciu kolumn

#### Automated

- [x] 1.1 Nowy spec kolumn planów przechodzi — 847b02c2
- [x] 1.2 Inwarianty map konfiguracji dalej trzymają — 847b02c2
- [x] 1.3 Kolejność i tryb tylko-do-odczytu kolumn bez regresji — 847b02c2

### Phase 2: Sortowanie czyta plan z id

#### Automated

- [x] 2.1 Sortowanie obu planów — c2404c4c
- [x] 2.2 Zakres i porządek sortowania bez regresji — c2404c4c

### Phase 3: Widoczność, oś, reveal problemów i zamek podglądu

#### Automated

- [x] 3.1 Zamek podglądu i picker
- [x] 3.2 Reveal problemów
- [x] 3.3 Oś pieniądza po zmianie
