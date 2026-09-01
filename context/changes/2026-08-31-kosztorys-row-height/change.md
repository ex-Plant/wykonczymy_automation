---
change_id: kosztorys-row-height
title: Wysokość wiersza kosztorysu — łatka na cache biblioteki, przeciąganie u właściciela, dopasowanie do treści u klienta
status: implemented
created: 2026-08-31
updated: 2026-08-31
archived_at: null
branch: null
worktree: null
---

## Notes

EX-699. Pierwsza rzecz, o którą poprosili właściciel i pracownicy po uruchomieniu aplikacji:
„Opis prac" jest ucięty do jednej linii i nie da się go przeczytać w całości. Klient w podglądzie
oferty też musi widzieć całe nazwy prac — dziś dociera do nich tylko klikając komórka po komórce.

Trzy kroki, w tej kolejności:

1. Łatka na `react-datasheet-grid@4.11.6` (najnowsza, marzec 2026 — poprawki z góry nie będzie).
   `useRowHeights` trzyma policzone wysokości i pozycje w `useRef` i nigdy ich nie czyści;
   `DataSheetGrid` nawet nie sięga po eksportowaną funkcję czyszczącą. Bez tego każda zmiana
   wysokości wymaga przemontowania siatki (koszt: pozycja przewijania i aktywna cela).
   Przy okazji do potwierdzenia utajona wada: sekcja wstawiona w środek listy może się rysować
   na wysokości zwykłego wiersza.
2. Edytor: przeciąganie krawędzi wiersza, poziomy odpowiednik istniejącego przeciągania kolumny.
3. Podgląd klienta: wysokość dopasowana do treści, przeliczana także po zmianie szerokości kolumny
   (klient może kolumny przeciągać — celowo).

Zawijanie tekstu i wysokość wiersza to jedna zmiana, nie dwie: komórki nie obcinają przelewu,
więc zawinięty tekst w niskim wierszu wyleje się na sąsiednie.

## Ustalenia z rozmowy (2026-08-31)

- **Jedna wysokość dla wszystkich wierszy odpada** — najdłuższy opis dyktowałby wysokość także
  wierszom jednowyrazowym. Wypada też wybór „niska/średnia/wysoka" z paska; nie ma czego wybierać.
- **Dopasowanie wysokości do treści per wiersz, w edytorze i w podglądzie klienta.** Domyślnie nikt
  nic nie ustawia, a każdy opis jest widoczny w całości.
- **Bez górnego limitu wysokości** (decyzja właściciela). Bardzo długi opis daje bardzo wysoki wiersz
  i to jest w porządku — odpowiada za to ten, kto go wpisał.
- **Przeciąganie krawędzi wiersza zostaje, ale jako nadpisanie wyjątku**, nie jako główny mechanizm.
  Zapis rzadki, jak przy szerokościach kolumn: wpis dostaje tylko wiersz faktycznie przeciągnięty,
  reszta jedzie na dopasowaniu.
- **Dymek z pełną treścią zostaje** — bez limitu nic się nie ucina samo, ale wiersz ręcznie
  spłaszczony przeciągnięciem znów nie mieści treści. Wykrywanie obcięcia zmienia się z poziomego
  na pionowe.

## Rozstrzygnięcia końcowe (2026-08-31)

- **Edytor: wysokość ustawiana ręcznie, przeciąganiem krawędzi wiersza.** Odrzucone zostało samo
  dopasowanie do treści w edytorze — właściciel nie zawsze chce widzieć rozwinięte opisy, a siatka,
  w której kolumnę da się przeciągnąć, a wiersza nie, jest nieintuicyjna.
- **Zapis nadpisań w przeglądarce**, rzadki, wzorem szerokości kolumn.
- **Podgląd klienta: wysokość liczona z treści**, bez przeciągania — klient nie ma czym sterować,
  a nadpisania właściciela i tak do niego nie docierają (zapis jest lokalny).
- **Zawijanie we wszystkich kolumnach tekstowych.** Krótkie wartości i tak się nie zawiną, więc
  włączenie tego wszędzie nic nie kosztuje; wysokość wiersza bierze najwyższą ze swoich komórek.
- **Dwuklik na krawędzi wiersza = dopasuj do treści** — pomiar i tak powstaje dla podglądu klienta.
- **Dymek z pełną treścią zostaje** dla wiersza niższego niż jego treść; wykrywanie obcięcia
  zmienia się z poziomego na pionowe.

## Weryfikacja na prawdziwych danych (2026-08-31, przeglądarka + lokalna baza)

**Wada belki sekcji POTWIERDZONA — i nie jest to „czasem zła wysokość", tylko przesunięcie.**
Wstawienie sekcji na początek listy w kosztorysie inwestycji 106, bez przeładowania strony:
belka „Prace dodatkowe" narysowała się na 32 px zamiast 52, zwykła pozycja „montaz wieszakow
w przedpokoju" na 52 px zamiast 32, kolejna belka niżej też na 32 px. Wysokości są oddawane
spod numerów sprzed wstawienia, przesunięte o liczbę wstawionych wierszy. Wada jest na produkcji
dziś i nie ma związku z zawijaniem tekstu. Sekcja testowa usunięta, siatka wróciła do normy.

**Liczenie zawijania canvasem zgadza się z przeglądarką w 118 na 120 zmierzonych komórek.**
Oba rozjazdy dotyczą tekstów stojących dokładnie na granicy szerokości kolumny („Razem" przy 46 px,
„Klimatyzacja" przy 107 px) — canvas widzi jedną linię, przeglądarka łamie na dwie. To zaokrąglenie
podpikselowe. **Wniosek: liczyć z zapasem 1 px.** Pomyłka w stronę wyższego wiersza kosztuje pasek
pustego miejsca, pomyłka w drugą stronę ucina tekst — czyli psuje dokładnie to, co naprawiamy.
Instrument sprawdzony przed użyciem (zgodność czcionki próbnika ze źródłem, kontrola pozytywna).

**Etykiety belek sekcji muszą być wyłączone z pomiaru.** Etykieta siedzi w wąskiej komórce
(107 px) i celowo rozlewa się na sąsiednie — liczenie wysokości z szerokości własnej komórki
zrobiłoby z belki trzylinijkowy klocek bez powodu.

**Prawdziwe dane są łagodniejsze, niż zakładał plan** (4000 pozycji w lokalnej bazie):

- najdłuższy opis to 274 znaki (~4–5 linii przy dzisiejszej szerokości kolumny), średnia ~44
- **zero twardych znaków nowej linii** w opisach i komentarzach — algorytm musi je obsłużyć,
  bo pole edycji na to pozwala, ale w danych ich nie ma
- wszystkie komentarze są puste
- największy kosztorys ma 379 pozycji, nie 1000 — próg 1000 pozostaje tylko w zbiorze syntetycznym

## Weryfikacja implementacji (2026-08-31)

Wszystko sprawdzone w przeglądarce na prawdziwych danych (inwestycja 106 — edytor,
`podglad-inwestora/42` — widok klienta), nie tylko testami jednostkowymi.

- **Widok klienta.** Wysokość liczona z treści zgadza się co do piksela z tym, co przeglądarka
  faktycznie zawinęła: 32/32 wiersze przewinięte przez całą listę bez ani jednego ucięcia i bez ani
  jednego wiersza za wysokiego. Zwężenie kolumny „Opis prac" z 434 do 262 px przeliczyło wysokości
  natychmiast i dalej bez ucięć (13/13).
- **Edytor.** Przeciąganie dolnej krawędzi ustawia wysokość (prowadnica idzie za kursorem, zapis
  dopiero na puszczeniu), wartość trafia do localStorage i przeżywa przeładowanie. Dwuklik dopasowuje
  wiersz do treści dokładnie — 4 sprawdzone wiersze, każdy trafił w `linie × 20 + 12`. Bandy sekcji i
  wiersze syntetyczne nie dostają uchwytu.
- **Usunięcie pozycji sprząta wpis** — nowa pozycja, ustawiona wysokość, usunięcie: klucz zniknął z
  mapy, sąsiednim wierszom nic się nie przesunęło.
- **Ostrzeżenie o hydracji** na stronie podglądu istniało przed tą zmianą — sprawdzone przez
  odłożenie zmian na stash i powtórzenie: identyczne.

### Trzy rzeczy, które wyszły dopiero z przeglądarki

1. **Ucięcie musi wypadać między liniami, nie w połowie litery.** Samo zawijanie zamieniło jeden
   czysty, ucięty wiersz na dwie połówki linii — gorzej niż stan wyjściowy. Tekst rozciąga się więc
   teraz na całą komórkę i ucina się sam, z marginesem dobranym tak, by pole treści było zawsze
   wielokrotnością linii. **Margines, nie padding** — `overflow: hidden` ucina na krawędzi paddingu,
   więc padding wpuszczałby następną linię z powrotem. (`overflow: clip` z
   `overflow-clip-margin` też by działało, ale lightningcss zamienia je z powrotem na `hidden`.)
2. **Dwuklik musi mierzyć zasięg (Range), nie samo pudełko tekstu.** Skoro pudełko jest rozciągnięte
   do wiersza, odczytanie jego wysokości odpowiada „tyle, ile już masz" i dopasowanie nigdy by
   wiersza nie zmniejszyło. Liczone są prostokąty linii, nie piksele — prostokąt jest wysoki na
   glify (17 px), a wiersz buduje się z linii (20 px).
3. **Kliknięcie, które nigdzie nie pojechało, nie może nic zapisywać.** Dwa kliknięcia dwukliku
   przechodzą najpierw przez uchwyt; zapis niezmienionej wysokości przerysowywał siatkę pod
   dwuklikiem, który miał dopiero policzyć dopasowanie.

### Uzupełnienie: pasek sekcji i wiersz nagłówka (2026-08-31)

Uchwyt dostawały początkowo wyłącznie zwykłe pozycje — pasek sekcji i wiersz nagłówka tabeli miały
wysokość na sztywno (52 px / 56 px). Właściciel zgłosił to jako brak, więc uchwyt trafił i tam:

- pasek sekcji przeciąga się jak każdy wiersz (przeciągnięcie ma pierwszeństwo przed stałą wysokością
  paska; bez przeciągnięcia pasek dalej odpoczywa na 52 px i nie liczy treści),
- wiersz nagłówka ma uchwyt w lewej rynience nagłówka; jego wysokość siedzi w tej samej mapie
  w localStorage pod kluczem `header`, którego żadne id wiersza nie zajmie (id są liczbowe),
- bez uchwytu zostały tylko przekładka i „Razem" — to wypełniacze, nie treść do czytania.

Przy okazji dwie poprawki, które wyszły dopiero z tego rozszerzenia:

- pomiar dopasowania do treści liczy teraz węzły tekstowe komórka po komórce, a nie `span`y —
  w nagłówku tekst sąsiaduje z uchwytem szerokości kolumny, a ten (rozciągnięty na cały wiersz) był
  liczony jako kolejna linia,
- podłoga 32 px obowiązuje już przy zapisie, nie tylko przy odczycie — przeciągnięcie w górę potrafiło
  zapisać wysokość, którą siatka i tak ignorowała.

### Uzupełnienie: tekst wyśrodkowany w pionie (2026-08-31)

Właściciel: „tekst musi być wyśrodkowany w komórce". Rozciągnięty `span`, który przycina tekst do
pełnych linii, dostał `display:flex; flex-direction:column; justify-content: safe center`.
`safe` jest tu load-bearing: zwykłe wyśrodkowanie wypycha zbyt długi opis poza OBA końce pudełka
i zostawia ścięte pół-linijki u góry i u dołu — czyli dokładnie to, co ta zmiana miała usunąć.
`safe center` centruje, gdy tekst się mieści, i wraca do wyrównania do góry, gdy się nie mieści.
Zweryfikowane w przeglądarce: wiersz 92 px z jednolinijkowym opisem → 38 px odstępu z góry i z dołu;
wiersz 32 px z dwulinijkowym opisem → tekst zaczyna się u góry, pierwsza linijka cała widoczna.
