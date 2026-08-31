# Wysokość wiersza kosztorysu — skrót planu

> Pełny plan: `context/changes/2026-08-31-kosztorys-row-height/plan.md`
> Ustalenia: `context/changes/2026-08-31-kosztorys-row-height/change.md`
> Zgłoszenie: EX-699

## Co i po co

Długi „Opis prac" jest ucięty do jednej linii. Właściciel i pracownicy poprosili o to jako o pierwszą
rzecz po uruchomieniu aplikacji, a klient oglądający ofertę musi widzieć całe nazwy prac bez klikania.
Dwie powierzchnie, dwie odpowiedzi: właściciel ustawia wysokość wiersza ręcznie, klient dostaje
wysokość policzoną z treści.

## Punkt wyjścia

Wysokość wiersza jest już funkcją per wiersz, ale zwraca stałą 32 px. Biblioteka siatki liczy pozycję
każdego wiersza raz i trzyma ją w pamięci, której nigdy nie czyści — funkcja czyszcząca istnieje, ale
siatka nawet po nią nie sięga. Dlatego dziś zmiana wysokości „w locie" wymagałaby przemontowania
siatki, co kosztuje pozycję przewijania i aktywną celę. Wersja 4.11.6 jest najnowsza, poprawki z góry
nie będzie.

## Stan docelowy

Właściciel łapie dolną krawędź wiersza i ustawia jego wysokość; dwuklik dopasowuje wiersz do treści.
Ustawienie przeżywa odświeżenie i dotyczy tylko wierszy faktycznie przeciągniętych. Klient otwiera
podgląd oferty i widzi każdą nazwę pracy w całości, bez klikania i bez ustawiania czegokolwiek, także
po zmianie szerokości kolumny.

## Podjęte decyzje

| Decyzja                       | Wybór                                              | Dlaczego                                                                                                                |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Sposób naprawy biblioteki     | Łatka lokalna wystawiająca czyszczenie na uchwycie | Czyszczenie „od środka" kasowałoby pamięć co render i przeliczało 1000 wierszy po każdym klawiszu                       |
| Wysokość w edytorze           | Ręcznie, przeciąganiem krawędzi                    | Właściciel nie zawsze chce widzieć rozwinięte opisy; siatka z przeciąganiem kolumn, ale nie wierszy, jest nieintuicyjna |
| Wysokość w podglądzie klienta | Liczona z treści                                   | Klient nie ma czym sterować, a nadpisania właściciela są lokalne dla jego przeglądarki                                  |
| Zapis nadpisań                | W przeglądarce, rzadko                             | Wzorzec szerokości kolumn; brak wpisu = dzisiejsze zachowanie                                                           |
| Górny limit wysokości         | Brak                                               | Decyzja właściciela — odpowiada ten, kto wpisał długi opis                                                              |
| Zakres zawijania              | Wszystkie kolumny tekstowe                         | Krótkie wartości i tak się nie zawiną, więc nic to nie kosztuje                                                         |

## Zakres

**W zakresie:** łatka na bibliotekę, pomiar zawijania tekstu, zawijanie w komórkach, przeciąganie
wysokości w edytorze z zapisem w przeglądarce, dwuklik „dopasuj do treści", wysokość z treści
w podglądzie klienta.

**Poza zakresem:** wybór jednej wysokości dla wszystkich wierszy, górny limit wysokości, zapis
wysokości przy kosztorysie w bazie, przeciąganie wysokości w podglądzie klienta, aktualizacja
lub fork biblioteki.

## Podejście

Łatka udostępnia czyszczenie pamięci podręcznej wysokości na uchwycie siatki, a nasz kod woła je
dokładnie wtedy, gdy trzeba: przy zmianie zbioru wierszy, przy zmianie nadpisania i przy zmianie
szerokości kolumny tekstowej. Liczenie linii jest czystą funkcją z wstrzykiwanym pomiarem szerokości
(testy chodzą bez przeglądarki), a w aplikacji pomiar idzie przez canvas i jest zapamiętywany.

## Fazy

| Faza                           | Co daje                                                    | Główne ryzyko                                                     |
| ------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Łatka na pamięć podręczną   | Zmiana wysokości widoczna bez przemontowania siatki        | Zły moment wywołania czyszczenia → migotanie albo stare wysokości |
| 2. Pomiar zawijania            | Liczba linii dla treści i szerokości, testowalna bez DOM-u | Rozjazd między pomiarem a rzeczywistym łamaniem w przeglądarce    |
| 3. Zawijanie w komórkach       | Tekst zawija się i nie wylewa na sąsiednie wiersze         | Hurtowe obcinanie przelewu zepsułoby etykiety belek sekcji        |
| 4. Ręczna wysokość w edytorze  | Przeciąganie krawędzi + dwuklik, zapis w przeglądarce      | Osierocone wpisy po skasowanych wierszach                         |
| 5. Wysokość z treści u klienta | Pełne nazwy prac w ofercie, także po zmianie szerokości    | Wydajność przy ~1000 pozycji                                      |

**Wymagania wstępne:** brak — nic nie dotyka bazy ani produkcji.
**Szacowany rozmiar:** ~2 sesje; faza 1 jest najbardziej ryzykowna, reszta jest odtwórcza.

**Prawdziwe dane (4000 pozycji lokalnie):** najdłuższy opis 274 znaki (~4–5 linii), średnia ~44,
zero twardych znaków nowej linii, największy kosztorys 379 pozycji.

## Otwarte ryzyka i założenia

- ~~Wada belki sekcji podejrzewana~~ — **potwierdzona w przeglądarce 2026-08-31**: po wstawieniu
  sekcji na początek listy belka rysuje się na 32 px zamiast 52, a sąsiednia pozycja na 52 zamiast 32.
  Wysokości są przesunięte o liczbę wstawionych wierszy. Wada jest na produkcji dziś.
- ~~Rozjazd pomiaru canvasem nieznany~~ — **zmierzony na 120 prawdziwych komórkach: 118 zgodnych**,
  oba rozjazdy na granicy szerokości kolumny (zaokrąglenie podpikselowe). Rozwiązanie: liczyć
  z zapasem 1 px, czyli mylić się w stronę wyższego wiersza.
- Etykiety belek sekcji muszą być wyłączone z pomiaru — siedzą w wąskiej komórce i celowo rozlewają
  się na sąsiednie.
- Zmiana jest przeglądarkowa, więc winna jest test E2E: napisany przy bramce przeglądowej albo
  odłożony jako zgłoszenie z etykietą `e2e-backlog`.

## Kryteria sukcesu

- Klient otwiera ofertę i czyta wszystkie nazwy prac bez jednego kliknięcia.
- Właściciel rozwija wybrany wiersz przeciągnięciem lub dwuklikiem, a ustawienie zostaje po odświeżeniu.
- Przy 1000 pozycjach siatka przewija się tak samo płynnie jak dziś.
