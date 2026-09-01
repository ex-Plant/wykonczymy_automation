# Źródło ceny wykonawcy tylko z dwiema opcjami — brief

> Pełny plan: `context/changes/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/plan.md`

## What & Why

Stawka wykonawcy ma dziś trzy źródła: auto, własny mnożnik i kwota stała. Własnego mnożnika nie ma
w bazie ani jeden raz — 5344 pozycje rozkładają się wyłącznie na dwa pozostałe — a katalog prac,
który powstał później, nigdy trzeciego trybu nie miał. Utrzymujemy gałąź, której nic nie produkuje,
i płacimy za nią wspólnym polem wartości o dwóch znaczeniach.

## Starting Point

Nadpisanie stawki to para pól: typ i wartość. Wartość znaczy raz mnożnik, raz kwotę, więc zmiana
źródła musi ją przeliczać (bez tego 200 zł staje się mnożnikiem 200). Siatka ma trzy kolumny na
plan — „Źródło", „Mnożnik", „Cena j.m." — czyli sześć w każdym widoku, bo każdy widok składa oba
plany. Wycena rozstrzyga trzy gałęzie dwa razy: w TypeScripcie i w SQL.

## Desired End State

Lista „Źródło ceny wykonawcy" ma dwie pozycje: auto i kwota stała. Kolumny „Mnożnik" nie ma
nigdzie — po cięciu pokazywałaby jedną powtórzoną stałą, bo mnożnik jest jeden na całą inwestycję.
W widokach wykonawcy zostają cztery kolumny ceny wykonawcy zamiast sześciu, a w widoku inwestora
dwie: „Cena j.m. netto" obu planów, bez źródła. Wartość nadpisania ma jedno znaczenie: auto to po
prostu jej brak.

## Key Decisions Made

| Decyzja                             | Wybór                                                   | Dlaczego                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Trzeci tryb                         | Wycinamy                                                | Zero wierszy w bazie; katalog prac go nigdy nie miał                                                                      |
| Kolumna „Źródło"                    | **Zostaje**, z dwiema opcjami                           | Ona nazywa powrót na auto — bez niej ten ruch istnieje tylko jako skasowanie komórki, czego nikt się nie domyśli          |
| Kolumna „Mnożnik"                   | Znika                                                   | Mnożnik jest jeden na inwestycję (nie ma per sekcja) — kolumna pokazywałaby stałą i kreski                                |
| „Źródło" w widoku inwestora         | Nie składa się tam wcale                                | Źródło to sterownik edycji, nie figura do porównania — w widoku, gdzie czyta się ofertę, nie ma czego nim ustawiać        |
| Kontrolka źródła                    | Lista jak dziś, krótsza                                 | Przełącznik w komórce to nowy typ komórki — klawiatura, wklejanie i kopiowanie od zera                                    |
| Migracja                            | **Brak**                                                | Zero takich wierszy; dane kosztorysu są jednorazowe (produkcja ma zero pozycji)                                           |
| Import z arkusza                    | Iloraz = mnożnik cennika → auto; inny → kwota z arkusza | Kosztorys czytamy jednokierunkowo, więc nic nie nadpisujemy w arkuszu; a 3123 z 5344 wierszy i tak już są kwotami stałymi |
| Rozpoznawanie formuły przy imporcie | **Zostaje**                                             | Bez niego ręcznie wpisana stawka trafiająca w mnożnik cennika poszłaby na auto i zaczęła się ruszać za ceną klienta       |
| Gałąź                               | Na bieżącą, nad sześcioma kolumnami                     | Na staging jedzie od razu kształt docelowy; nie przepisujemy historii                                                     |

## Scope

**W zakresie:** trzecia opcja w liście źródła, kolumna „Mnożnik" wraz z sortowaniem, pickerem
i podpowiedzią nagłówka, kolumny źródła w widoku inwestora, gałąź mnożnika w wycenie i w SQL należności wykonawcy, mapowanie importu,
zawężenie typu i walidacji akcji, notatki domenowe.

**Poza zakresem:** migracja danych, kolumna „Cena j.m." wykonawcy, pułap 80%, mnożniki inwestycji
i ustawienia rozliczenia, zmiana kontrolki na przełącznik, przepisywanie commitów z sześcioma
kolumnami.

## Architecture / Approach

Cięcie od wierzchu w dół, żeby drzewo kompilowało się po każdej fazie. Siatka pierwsza przestaje
produkować i pokazywać własny mnożnik, potem import, na końcu zawęża się typ — dopiero wtedy, gdy
nikt tej wartości już nie podaje. Odwrotna kolejność nie skompiluje się w połowie: dopóki komórka
podaje mnożnik do polityki edycji, unii nie da się zawęzić.

## Phases at a Glance

| Faza                | Co dowozi                                                        | Główne ryzyko                                                                |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Siatka           | Dwie opcje w liście, „Mnożnik" znika, widok inwestora bez źródła | Asercje na sześć kolumn rozjeżdżają się na dwie liczby: cztery i dwie        |
| 2. Import           | Auto albo kwota stała wprost z arkusza                           | Wartość kwoty wzięta z ilorazu zamiast ze stawki arkusza — cicha zmiana ceny |
| 3. Typ, wycena, SQL | Unia zawężona, obie wyceny bez gałęzi mnożnika                   | Rozjazd wyceny TypeScript vs SQL, jeśli poprawi się tylko jedną              |
| 4. Dokumentacja     | Notatki domenowe mówią o dwóch źródłach                          | —                                                                            |

**Warunki wstępne:** brak — cięcie leży na bieżącej gałęzi.
**Szacowany rozmiar:** jedna sesja, 12 plików źródłowych + specy.

## Open Risks & Assumptions

- Import umie wyprodukować własny mnożnik, ale na przejechanych arkuszach nigdy tego nie zrobił.
  Zakładamy, że arkusze z per-wierszowym mnożnikiem innym niż cennikowy są rzadkie; gdy się trafią,
  ich stawka po imporcie przestanie chodzić za „Cena j.m." — jak u 3123 innych pozycji.
- Bez migracji: wiersz na własnym mnożniku w czyjejś lokalnej bazie policzy się z mnożnika
  inwestycji, bez ostrzeżenia. Świadomie przyjęte.

## Success Criteria (Summary)

- W widokach wykonawcy są cztery kolumny ceny, a lista źródła ma dwie pozycje; w widoku inwestora
  są dwie kolumny ceny wykonawcy i żadnej kolumny źródła
- Wyczyszczenie „Cena j.m." wykonawcy wraca na auto; wpisanie kwoty ustawia kwotę stałą
- Należność wykonawcy liczona w SQL zgadza się z siatką na obu planach
