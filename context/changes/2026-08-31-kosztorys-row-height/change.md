---
change_id: kosztorys-row-height
title: Wysokość wiersza kosztorysu — łatka na cache biblioteki, przeciąganie u właściciela, dopasowanie do treści u klienta
status: planned
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
