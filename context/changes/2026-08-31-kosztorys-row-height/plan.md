# Wysokość wiersza kosztorysu — plan wdrożenia

## Overview

Długi „Opis prac" jest dziś ucięty do jednej linii i nie da się go przeczytać bez klikania w komórkę.
Właściciel i pracownicy poprosili o to jako o pierwszą rzecz po uruchomieniu aplikacji, a klient
oglądający ofertę musi widzieć całe nazwy prac bez żadnego klikania.

Dwie różne odpowiedzi dla dwóch powierzchni: w edytorze właściciel **ustawia wysokość wiersza ręcznie**,
przeciągając jego krawędź — poziomy odpowiednik istniejącego przeciągania kolumny. W podglądzie klienta
wysokość jest **liczona z treści**, bo klient nie ma czym sterować i musi zobaczyć wszystko od razu.
Obie drogi blokuje ta sama wada biblioteki, więc pierwszym krokiem jest łatka.

## Current State Analysis

- `rowHeight` jest już funkcją per wiersz (`kosztorys-editor-body.tsx:273`), zwraca stałe
  `ITEM_ROW_HEIGHT = 32` / `SECTION_BAND_ROW_HEIGHT = 52`.
- **Pamięć podręczna wysokości w bibliotece nigdy się nie unieważnia.**
  `node_modules/react-datasheet-grid/dist/hooks/useRowHeights.js` trzyma policzone `height`/`top`
  w `useRef` i dopisuje je raz na indeks. Hook eksportuje `resetAfter()`, ale `DataSheetGrid.js`
  destrukturyzuje wyłącznie `getRowSize`, `totalSize`, `getRowIndex` (linia 75) — `resetAfter`
  nie jest nigdzie wołane w całym `dist`.
- **Czyszczenie „od środka" jest wykluczone.** `useRowHeights` opakowuje wszystko w `useMemo`
  z zależnościami `[rowHeight, value]`, a `rowHeight` jest w naszym kodzie funkcją tworzoną w locie
  przy każdym renderze — memo przelicza się więc co render. Łatka czyszcząca pamięć w tym miejscu
  kasowałaby ją co render i przy tysiącu pozycji przeliczała wysokości od góry po każdym naciśnięciu
  klawisza. Czyszczenie musi być **sterowane z zewnątrz**.
- `DataSheetGrid` ma już `useImperativeHandle` (linia 1251) z czterema polami
  (`activeCell`, `selection`, `setActiveCell`, `setSelection`), typ `DataSheetGridRef`
  w `dist/types.d.ts:191`. To jest gotowe miejsce na piąte pole.
- `DynamicDataSheetGrid` to alias na `DataSheetGrid` (`dist/index.js:6`), więc łatka obsługuje oba.
- **Wada przesunięcia wysokości potwierdzona w przeglądarce (2026-08-31).** Wstawienie sekcji na
  początek listy, bez przeładowania: belka narysowała się na 32 px zamiast 52, zwykła pozycja na
  52 px zamiast 32, kolejna belka też na 32 px. Wysokości są oddawane spod numerów sprzed wstawienia,
  przesunięte o liczbę wstawionych wierszy. Wada jest na produkcji dziś, niezależnie od tej zmiany.
- Wersja `4.11.6` jest najnowsza (opublikowana 2026-03-03) — poprawki z góry nie będzie.
  W repo nie ma jeszcze katalogu `patches/` ani `patchedDependencies`; pnpm 10.27 ma wbudowane
  `pnpm patch`.
- Komórki nie obcinają przelewu (`.dsg-cell` nie ma `overflow: hidden`), więc zawinięty tekst
  w niskim wierszu wyleje się na sąsiednie. **Ale obcinania nie wolno założyć hurtem:**
  `globals.css:376` celowo daje `overflow: visible` komórce z etykietą belki sekcji, żeby etykieta
  rozlewała się na sąsiednie puste komórki (biblioteka nie ma scalania komórek).
- Kolumny długiego tekstu to `description` i `note` (`kosztorys-v2-columns.tsx:300` i `:534`),
  obie na `longTextColumn`. Tekst w spoczynku renderuje `ReadOnlyCellText`
  (`block w-full truncate px-2 …`) — jedno miejsce dla wszystkich kolumn tekstowych.
- `ReadOnlyLongText` wykrywa obcięcie poziomo (`scrollWidth > clientWidth`).
- Przeciąganie szerokości kolumny **działa też w podglądzie klienta** — celowo
  (`use-kosztorys-editor.ts:351`, `onGuide` / `onCommitColumn` nie są zawężone do edytora).
- Wzorzec rzadkiego zapisu w przeglądarce jest gotowy: `use-column-widths.ts` na
  `createJsonMapStore`, z wariadycznym `dropWidth` sprzątającym wpisy po skasowanych obiektach.
- **Testy chodzą bez DOM-u** — w `package.json` nie ma ani `jsdom`, ani `happy-dom`, ani
  `@testing-library/react`. Wszystko, co ma być pokryte testem jednostkowym, musi być czystą
  funkcją bez przeglądarki.

## Desired End State

- Właściciel łapie dolną krawędź wiersza w kolumnie porządkowej i ustawia jego wysokość; opis zawija
  się na tyle linii, ile się mieści. Dwuklik na tej krawędzi dopasowuje wiersz do treści.
  Ustawienie przeżywa odświeżenie strony. Wiersze nietknięte zostają na dzisiejszej wysokości.
- Klient otwierający podgląd oferty widzi każdą nazwę pracy w całości, bez klikania i bez ustawiania
  czegokolwiek. Po przeciągnięciu szerokości kolumny wysokości przeliczają się same.
- Zmiana wysokości nie przemontowuje siatki: pozycja przewijania i aktywna cela zostają na miejscu.
- Sekcja wstawiona w środek listy rysuje się na właściwej wysokości belki (dziś **potwierdzona wada**).

### Key Discoveries

- `DataSheetGrid.js:75` / `:1251` — miejsce łatki: destrukturyzacja `resetAfter` i dopisanie go
  do uchwytu.
- `globals.css:376` — belka sekcji potrzebuje `overflow: visible`; obcinanie przelewu musi ją omijać.
- `read-only-cell-text.tsx` — jedno miejsce, w którym `truncate` zmienia się w zawijanie.
- `use-column-widths.ts` — wzorzec do skopiowania jeden do jednego dla mapy wysokości.
- `column-resize-handle.tsx` (`ResizableHeader`, `onGuide`/`onCommit`) — wzorzec prowadnicy
  przeciągania do obrócenia o 90°.

## What We're NOT Doing

- **Nie ma wyboru „niska / średnia / wysoka" z paska** — jedna wysokość dla wszystkich wierszy
  oznaczałaby, że najdłuższy opis dyktuje wysokość także wierszom jednowyrazowym.
- **Nie ma górnego limitu wysokości** (decyzja właściciela) — bardzo długi opis daje bardzo wysoki
  wiersz i tak ma być.
- **Nie ma dopasowania do treści w edytorze jako trybu domyślnego** — właściciel nie zawsze chce
  widzieć rozwinięte opisy. Dopasowanie jest tam dostępne tylko na żądanie, dwuklikiem.
- **Nie ma przeciągania wysokości w podglądzie klienta** — wszystko już widać, nie ma czego nadpisywać.
- **Nie zapisujemy wysokości przy kosztorysie w bazie** — nadpisania są prywatne dla przeglądarki,
  jak szerokości kolumn. Klient zawsze dostaje czyste dopasowanie do treści.
- Nie ruszamy dymka z pełną treścią — zostaje, bo wiersz spłaszczony ręcznie znów nie mieści treści.
- Nie aktualizujemy biblioteki (4.11.6 jest najnowsza) ani nie forkujemy jej w całości.

## Implementation Approach

Pięć kroków, każdy sprawdzalny osobno:

1. Łatka na bibliotekę udostępniająca czyszczenie pamięci podręcznej wysokości na uchwycie siatki,
   plus wołanie go z naszego kodu, gdy zmienia się zbiór wierszy. To samo w sobie naprawia
   potwierdzoną wadę przesuniętych wysokości.
2. Czysta funkcja licząca, na ile linii rozpada się tekst przy danej szerokości — z wstrzykiwanym
   pomiarem szerokości, żeby dała się przetestować bez przeglądarki. W przeglądarce pomiar idzie
   przez canvas, czyli bez dotykania układu strony.
3. Zawijanie w komórkach + obcinanie przelewu zawężone tak, żeby nie ruszyć belek sekcji;
   dymek przełączony na wykrywanie pionowe.
4. Edytor: uchwyt przeciągania w kolumnie porządkowej, rzadka mapa w przeglądarce, dwuklik
   „dopasuj do treści".
5. Podgląd klienta: wysokość z pomiaru, przeliczana po zmianie szerokości kolumny.

## Critical Implementation Details

**Kolejność unieważniania.** `resetAfter(index)` woła `setState` w bibliotece, więc nie wolno go
wywołać w trakcie renderu — musi iść z efektu układu (przed malowaniem), inaczej klatka pokaże
wiersze na starych wysokościach. Unieważniać trzeba od **najmniejszego** dotkniętego indeksu:
przesunięcie jednego wiersza przesuwa pozycje wszystkich pod nim.

**Zapas jednego piksela przy liczeniu linii.** Zmierzone na 120 prawdziwych komórkach: canvas
zgadza się z przeglądarką w 118 przypadkach, a oba rozjazdy dotyczą tekstu stojącego dokładnie na
granicy szerokości kolumny (zaokrąglenie podpikselowe). Liczyć więc przy szerokości pomniejszonej
o 1 px: pomyłka w stronę wyższego wiersza kosztuje pasek pustego miejsca, pomyłka w drugą stronę
ucina tekst, czyli psuje to, co naprawiamy.

**Etykieta belki sekcji nie podlega pomiarowi.** Siedzi w wąskiej komórce i celowo rozlewa się na
sąsiednie — liczenie jej wysokości z szerokości własnej komórki zrobiłoby z belki kilkulinijkowy
klocek. Belka zachowuje swoją stałą wysokość.

**Wydajność pomiaru.** Największy prawdziwy kosztorys ma 379 pozycji; próg 1000 pozostaje tylko
w zbiorze syntetycznym (`perf-seed-kosztorys.ts`, `INV=7`). Najdłuższy prawdziwy opis to 274 znaki,
czyli ~4–5 linii przy dzisiejszej szerokości kolumny. Pomiar musi być zapamiętywany po kluczu treść + szerokość kolumny, inaczej
każda zmiana szerokości przelicza wszystko od zera. Canvas `measureText` nie wymusza przeliczenia
układu strony — pomiar przez `scrollHeight` ukrytego elementu wymusza i przy tej skali będzie widoczny.

**Pierwszeństwo.** Wiersz z ręcznym nadpisaniem bierze jego wysokość, wiersz bez nadpisania —
dzisiejszą stałą (edytor) albo wysokość z pomiaru (podgląd klienta). Belka sekcji zachowuje
swoją własną wysokość niezależnie od jednego i drugiego.

---

## Phase 1: Łatka na pamięć podręczną wysokości

### Overview

Udostępnić czyszczenie pamięci podręcznej na uchwycie siatki i zacząć je wołać, gdy zmienia się
zbiór wierszy. Bez tego żadna zmiana wysokości nie jest widoczna bez przemontowania siatki.

### Changes Required

#### 1. Łatka biblioteki

**File**: `patches/react-datasheet-grid@4.11.6.patch` (nowy, przez `pnpm patch`)

**Intent**: `DataSheetGrid` ma zacząć destrukturyzować `resetAfter` z `useRowHeights` i wystawić je
na uchwycie, żeby nasz kod decydował, kiedy pamięć podręczna jest nieaktualna. Sama biblioteka nie
zmienia zachowania, dopóki nikt tego nie zawoła — łatka jest addytywna.

**Contract**: `DataSheetGridRef` zyskuje `resetRowHeights: (fromIndex?: number) => void`
(domyślnie `0`). Zmiana obejmuje `dist/components/DataSheetGrid.js` (destrukturyzacja przy linii 75,
dopisanie pola w `useImperativeHandle` przy linii 1251) oraz `dist/types.d.ts:191`.
`pnpm.patchedDependencies` w `@package.json` wskazuje na plik łatki.

#### 2. Podpięcie uchwytu i unieważnianie przy zmianie zbioru wierszy

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Trzymać referencję do siatki i po każdej zmianie listy wierszy czyścić pamięć od
pierwszego indeksu, który mógł się przesunąć. To naprawia belkę sekcji wstawionej w środek listy,
niezależnie od reszty tej zmiany.

**Contract**: `ref` na `DynamicDataSheetGrid`; efekt układu porównujący klucze wierszy
(`rowKey` = `String(rowData.id)`) z poprzednim renderem i wołający `resetRowHeights(firstChanged)`.
Brak zmian — brak wywołania.

### Success Criteria

#### Automated Verification

- Instalacja stosuje łatkę: `pnpm install --frozen-lockfile` kończy się bez ostrzeżenia o niezgodnej łatce
- Łatka jest obecna w drzewie: `node -e "…"` potwierdza `resetRowHeights` w `node_modules/react-datasheet-grid/dist/types.d.ts`
- Test jednostkowy wyliczania pierwszego przesuniętego indeksu z dwóch list kluczy:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/row-key-diff.test.ts`

#### Manual Verification

- Wstawienie sekcji w środek listy: belka rysuje się na wysokości belki, nie zwykłego wiersza
  (potwierdzona wada — dziś belka spada do 32 px, a sąsiednia pozycja rośnie do 52 px)
- Skasowanie wiersza w środku listy nie rozjeżdża wysokości wierszy poniżej
- Pozycja przewijania i aktywna cela zostają na miejscu po wstawieniu wiersza

**Implementation Note**: po przejściu weryfikacji automatycznej commit i dalej — weryfikacja ręczna
zbiera się raz, na końcu zmiany.

---

## Phase 2: Pomiar zawijania tekstu

### Overview

Policzyć, na ile linii rozpada się dana treść przy danej szerokości kolumny — bez przeglądarki
w testach, przez canvas w aplikacji.

### Changes Required

#### 1. Czysta funkcja licząca linie

**File**: `src/lib/kosztorys/text-wrap.ts` (nowy)

**Intent**: Zamiana treści i dostępnej szerokości na liczbę linii, z pomiarem szerokości podanym
z zewnątrz. Dzięki temu logika łamania (podział na słowa, słowo dłuższe niż kolumna, twarde
znaki nowej linii z pola wielolinijkowego) jest testowalna bez DOM-u.

**Contract**: `countWrappedLines(text: string, availableWidth: number, measure: (s: string) => number): number`.
Zwraca minimum 1. Twarde znaki nowej linii łamią zawsze; słowo szersze niż kolumna łamane po znakach.

#### 2. Pomiar przez canvas z zapamiętywaniem

**File**: `src/lib/kosztorys/text-measure.ts` (nowy)

**Intent**: Dostarczyć funkcję pomiaru szerokości opartą o jeden kontekst canvas z czcionką
odczytaną z komórki, z zapamiętywaniem wyników — pomiar nie może wymuszać przeliczenia układu strony
ani powtarzać się przy tej samej treści i szerokości.

**Contract**: fabryka zwracająca `measure(text: string): number` dla zadanej czcionki, plus pamięć
wyników po kluczu treść + szerokość. Moduł dotyka `document`, więc nie jest importowany przez testy.

### Success Criteria

#### Automated Verification

- Testy łamania (jedno słowo, wiele słów, słowo dłuższe niż kolumna, twarde znaki nowej linii,
  pusty tekst, zerowa szerokość): `pnpm exec vitest run src/__tests__/lib/kosztorys/text-wrap.test.ts`

#### Manual Verification

- Brak (faza bez powierzchni użytkownika)

---

## Phase 3: Zawijanie w komórkach

### Overview

Włączyć zawijanie w kolumnach tekstowych i zamknąć przelew w granicach wiersza, nie psując belek sekcji.

### Changes Required

#### 1. Tekst w spoczynku zawija zamiast uciekać w wielokropek

**File**: `src/components/ui/datasheet-grid/read-only-cell-text.tsx`

**Intent**: Zamienić obcinanie w jednej linii na zawijanie z zachowaniem twardych znaków nowej linii,
przy pionowym wyśrodkowaniu tekstu w wierszu. Wpływa na wszystkie kolumny tekstowe naraz — tak jak
ustalono.

**Contract**: klasa `truncate` znika na rzecz zawijania z zachowaniem białych znaków; komentarz
o wyśrodkowaniu przez `.dsg-cell` (flex) zostaje aktualny.

#### 2. Zamknięcie przelewu w granicach komórki

**File**: `src/styles/globals.css`

**Intent**: Komórki siatki mają obcinać to, co nie mieści się w wierszu, żeby zawinięty tekst nie
wylewał się na sąsiednie wiersze — z wyjątkiem komórki etykiety belki sekcji, która celowo rozlewa
się na sąsiadów.

**Contract**: reguła obcinania na `.kosztorys-grid .dsg-cell` z zachowaniem dotychczasowego wyjątku
`.kosztorys-band-label-cell` (dziś `globals.css:376`) — wyjątek musi zostać po nowej regule albo
przebić ją swoistością.

#### 3. Dymek wykrywa obcięcie w pionie

**File**: `src/components/ui/datasheet-grid/read-only-long-text.tsx`

**Intent**: Po włączeniu zawijania tekst nigdy nie jest szerszy niż komórka, tylko wyższy — dotychczasowe
wykrywanie po szerokości przestałoby otwierać dymek na wierszu spłaszczonym ręcznie.

**Contract**: `isTruncated` porównuje wysokość zawartości z wysokością widoczną zamiast szerokości.
Komentarz o pomiarze przy otwarciu (kolumna jest przeciągalna) zostaje w mocy.

### Success Criteria

#### Automated Verification

- Brak testu jednostkowego (zmiana czysto prezentacyjna; ryzyko pokryte weryfikacją ręczną
  i backlogiem E2E z fazy 5)

#### Manual Verification

- Długi „Opis prac" w wierszu na dzisiejszej wysokości nie wylewa się na sąsiednie wiersze
- Belka sekcji nadal pokazuje pełną nazwę rozlaną na sąsiednie kolumny
- Dymek z pełną treścią otwiera się na wierszu niższym niż jego treść i nie otwiera się, gdy treść się mieści

---

## Phase 4: Ręczna wysokość wiersza w edytorze

### Overview

Uchwyt do przeciągania dolnej krawędzi wiersza, rzadki zapis w przeglądarce, dwuklik dopasowujący
wiersz do treści.

### Changes Required

#### 1. Mapa wysokości wierszy

**File**: `src/components/kosztorys/editor/hooks/use-row-heights.ts` (nowy)

**Intent**: Przechowywać wysokości tylko tych wierszy, które faktycznie przeciągnięto, w przeglądarce —
wzorem szerokości kolumn. Wiersz bez wpisu zostaje na dzisiejszej wysokości.

**Contract**: `useRowHeights()` zwracające `{ heights, setHeight, dropHeight }` na
`createJsonMapStore<number>('kosztorys-v2-row-heights')`; `dropHeight` wariadyczne, wołane przy
kasowaniu wierszy tam, gdzie dziś wołane jest `dropWidth`. Identyfikator wiersza taki sam jak
`rowKey` siatki.

#### 2. Uchwyt przeciągania

**File**: `src/components/ui/datasheet-grid/row-resize-handle.tsx` (nowy)

**Intent**: Poziomy odpowiednik istniejącej prowadnicy przeciągania kolumny: pokazać linię
prowadzącą w trakcie przeciągania i zapisać wysokość przy puszczeniu.

**Contract**: kształt zapożyczony z `column-resize-handle.tsx` — `onGuide(y | null)` w trakcie,
`onCommit(rowKey, height)` przy puszczeniu, dolny próg równy dzisiejszej wysokości wiersza.
Uchwyt renderuje się w kolumnie porządkowej (`ordinal-gutter-column.tsx`), która jest przyklejona
do lewej i widoczna zawsze.

#### 3. Dwuklik dopasowuje do treści

**File**: `src/components/kosztorys/editor/grid/ordinal-gutter-column.tsx`

**Intent**: Dwuklik na krawędzi zapisuje wysokość policzoną z treści wiersza — jednym ruchem zamiast
celowania myszą.

**Contract**: dwuklik na uchwycie liczy wysokość przez pomiar z fazy 2 dla wszystkich kolumn
tekstowych wiersza (najwyższa wygrywa) i zapisuje ją jako nadpisanie.

#### 4. Wpięcie w siatkę

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Wysokość wiersza ma czytać nadpisanie, a po jego zmianie pamięć podręczna wysokości musi
zostać wyczyszczona od tego wiersza w dół.

**Contract**: `rowHeight` uwzględnia mapę nadpisań przed dzisiejszymi stałymi; belka sekcji zachowuje
swoją wysokość. Zmiana mapy woła `resetRowHeights(index)` z fazy 1.

### Success Criteria

#### Automated Verification

- Testy rozstrzygania wysokości (nadpisanie / brak nadpisania / belka sekcji / próg dolny):
  `pnpm exec vitest run src/__tests__/components/kosztorys/editor/row-height-resolution.test.ts`

#### Manual Verification

- Przeciągnięcie krawędzi wiersza zmienia jego wysokość, opis zawija się na tyle linii, ile wchodzi
- Wysokość przeżywa odświeżenie strony
- Dwuklik na krawędzi rozwija wiersz dokładnie do pełnej treści, bez ucięcia i bez pustego pasa
- Przewijanie i aktywna cela zostają na miejscu w trakcie i po przeciągnięciu
- Skasowanie wiersza nie zostawia po sobie wpisu, który przykleiłby wysokość do nowego wiersza
- Pozostałe wiersze nie zmieniają wysokości

---

## Phase 5: Wysokość z treści w podglądzie klienta

### Overview

W podglądzie oferty wysokość każdego wiersza wynika z jego treści i przelicza się po zmianie
szerokości kolumny.

### Changes Required

#### 1. Wysokość liczona z treści

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: W trybie podglądu `rowHeight` bierze wysokość z pomiaru zamiast dzisiejszej stałej —
najwyższa z kolumn tekstowych wiersza, bez górnego limitu.

**Contract**: gałąź na istniejącym `preview`; wynik pomiaru zapamiętywany po treści i szerokości
kolumny (faza 2). Belka sekcji zachowuje swoją wysokość.

#### 2. Przeliczanie po zmianie szerokości kolumny

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Klient może przeciągać szerokość kolumny — po takim przeciągnięciu wysokości policzone
przy poprzedniej szerokości są nieaktualne.

**Contract**: zapis szerokości kolumny tekstowej pociąga za sobą `resetRowHeights(0)` z fazy 1.
Kolumny nietekstowe nie zmieniają wysokości, więc nie unieważniają niczego.

#### 3. Zapis ryzyka przeglądarkowego

**File**: `context/foundation/test-plan.md`

**Intent**: Ta zmiana jest przeglądarkowa i winna jest sobie test E2E — albo napisany przy bramce
przeglądowej, albo odłożony jako zgłoszenie z etykietą `e2e-backlog`.

**Contract**: ryzyko nazwane w planie testów: „w podglądzie klienta każda nazwa pracy jest widoczna
w całości, także po zmianie szerokości kolumny".

### Success Criteria

#### Automated Verification

- Testy wysokości z treści (wiersz jednolinijkowy, wielolinijkowy, pusty, belka sekcji):
  `pnpm exec vitest run src/__tests__/components/kosztorys/editor/row-height-resolution.test.ts`

#### Manual Verification

- Podgląd klienta pokazuje każdą nazwę pracy w całości, bez klikania
- Zwężenie kolumny „Opis prac" podwyższa wiersze, poszerzenie obniża — bez przeładowania strony
- Kosztorys z ~1000 pozycji (`INV=7`) przewija się płynnie i otwiera bez wyczuwalnej zwłoki
- Bardzo długi opis daje bardzo wysoki wiersz — tak ma być, bez limitu

---

## Testing Strategy

### Unit Tests

- Łamanie tekstu na linie: wiele słów, jedno słowo szersze niż kolumna, twarde znaki nowej linii
  (w danych ich nie ma, ale pole edycji na nie pozwala), pusty tekst, zerowa/ujemna szerokość,
  tekst stojący dokładnie na granicy szerokości (zapas 1 px)
- Wyliczenie pierwszego przesuniętego indeksu z dwóch list kluczy wierszy (wstawienie, skasowanie,
  przestawienie, brak zmian)
- Rozstrzyganie wysokości wiersza: nadpisanie bije wyliczenie, belka sekcji bije oba, próg dolny

### Integration Tests

Brak — nic tu nie dotyka bazy.

### Browser (E2E)

Ryzyko przeglądarkowe: „w podglądzie klienta każda nazwa pracy jest widoczna w całości, także po
zmianie szerokości kolumny". Do napisania przy bramce przeglądowej albo odłożenia jako zgłoszenie
z etykietą `e2e-backlog` w projekcie „Wykonczymy". **Nie uruchamiać `pnpm test:e2e` bez wyraźnej
prośby** — pełny przebieg to ok. godzina.

### Manual Testing Steps

1. Kosztorys z długimi opisami (`INV=6`): przeciągnąć krawędź wiersza, sprawdzić zawijanie i zapis po odświeżeniu
2. Dwuklik na krawędzi — wiersz dopasowany do treści co do linii
3. Wstawić sekcję w środek listy — belka na właściwej wysokości
4. Podgląd klienta — wszystkie nazwy prac widoczne, zwężenie kolumny podwyższa wiersze
5. Kosztorys perf (`INV=7`, ~1000 pozycji) — płynność przewijania i czas otwarcia

## Performance Considerations

Pomiar idzie przez canvas, więc nie wymusza przeliczenia układu strony, i jest zapamiętywany po
kluczu treść + szerokość kolumny. Najgorszy przypadek to pierwsze otwarcie podglądu kosztorysu
z ~1000 pozycjami: tyle pomiarów razy liczba kolumn tekstowych, wykonywanych leniwie w miarę
przewijania, bo biblioteka pyta o wysokość wiersza dopiero wtedy, gdy go potrzebuje.
Unieważnianie po zmianie szerokości kolumny czyści całość, ale pamięć pomiarów zostaje —
przeliczenie dotyczy tylko wierszy w polu widzenia.

## Migration Notes

Brak. Nic nie idzie do bazy, wszystkie ustawienia są prywatne dla przeglądarki, a brak wpisu
oznacza dzisiejsze zachowanie.

## Whole-tree Gate

Uruchomić **raz**, po ostatniej fazie:

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy jednostkowe: `pnpm test`
- Build: `pnpm build`

## References

- Zgłoszenie: EX-699 — <https://linear.app/ex-plant/issue/EX-699>
- Ustalenia z rozmowy: `context/changes/2026-08-31-kosztorys-row-height/change.md`
- Wzorzec przeciągania: `src/components/ui/datasheet-grid/column-resize-handle.tsx`
- Wzorzec rzadkiego zapisu w przeglądarce: `src/components/kosztorys/editor/hooks/use-column-widths.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Łatka na pamięć podręczną wysokości

#### Automated

- [x] 1.1 Instalacja stosuje łatkę bez ostrzeżeń
- [x] 1.2 `resetRowHeights` obecne w typach biblioteki po instalacji
- [x] 1.3 Testy wyliczania pierwszego przesuniętego indeksu (9 testów, zielone)

### Phase 2: Pomiar zawijania tekstu

#### Automated

- [x] 2.1 Testy łamania tekstu na linie (10 testów; algorytm zweryfikowany też w przeglądarce na 88 prawdziwych komórkach — 0 zaniżeń, 6 zawyżeń o linię)

### Phase 3: Zawijanie w komórkach

#### Automated

- [x] 3.1 Brak testu jednostkowego — faza czysto prezentacyjna (świadomie); zweryfikowana w przeglądarce

### Phase 4: Ręczna wysokość wiersza w edytorze

#### Automated

- [x] 4.1 Testy rozstrzygania wysokości wiersza (13 testów, zielone)

### Phase 5: Wysokość z treści w podglądzie klienta

#### Automated

- [x] 5.1 Testy wysokości z treści w trybie podglądu (5 testów, zielone)
