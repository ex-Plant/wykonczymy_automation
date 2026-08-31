# Katalog prac — skrót planu

> Pełny plan: `context/changes/2026-08-31-work-item-catalog/plan.md`
> Research: `context/changes/2026-08-31-work-item-catalog/research.md`

## Co i po co

Globalny katalog prac („cennik") — jeden wiersz na pracę: opis, kategoria, j.m., „Cena j.m."
i dwie zamrożone kwotowo stawki podwykonawców. Dziś najmniejsza rzecz, jaką da się wziąć
z szablonu, to cała sekcja; brakuje mechanizmu dołożenia POJEDYNCZEJ zapisanej pracy razem
z jej cenami. Szablon jest migawką sprzed miesięcy — katalog jest stanem dzisiejszym.

## Punkt wyjścia

Szablony (`kosztorys_presets`) niosą opis, j.m., cenę i nadpisania stawek, ale wyłącznie
w granulacji sekcji. „Dodaj → Praca" tworzy pusty wiersz. Nie istnieje ścieżka wstawiania
N pozycji do istniejącej sekcji, ani żaden globalny byt „praca" — była raz zaprojektowana
i wycięta w lipcu jako zbyt kosztowna w UI, z furtką „revivable if section-append proves too coarse".

## Stan docelowy

`/katalog-prac` listuje cennik z wyszukiwarką i pozwala dodawać, edytować i usuwać pozycje.
W edytorze „Dodaj → Praca z katalogu…" dokłada wybrane prace na koniec wskazanej sekcji z ceną
i obiema stawkami; trzy kropki na pracy mają „Zapisz do katalogu…". Katalog startuje napełniony
191 pozycjami z szablonu-wzoru. „Opcje → Porównaj z katalogiem" pokazuje rozjazdy i nic nie zapisuje.

## Podjęte decyzje

| Decyzja                 | Wybór                                                    | Dlaczego                                                                                                        | Źródło   |
| ----------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Model danych            | Osobny byt katalogu, nie widok nad szablonami            | Cennik ma być redagowalny i bez duplikatów; wariant „widok nad szablonami" nie daje własności danych            | Rozmowa  |
| Stawka podwykonawcy     | Zamrożona kwota                                          | Dziedziczenie współczynnika inwestycji docelowej zmieniałoby stawkę po cichu                                    | Rozmowa  |
| Cena po wstawieniu      | Kopiowana i zamrożona, brak referencji wstecz            | Zasada migawki obowiązująca w całym kosztorysie                                                                 | Research |
| Byt techniczny          | Kolekcja Payload, nie surowa tabela                      | Ekran CRUD i trzej pisarze; `/admin` jako awaryjny edytor + darmowe haki cache                                  | Research |
| Tożsamość pracy         | Jedna kolumna `matchKey` = fold(opis)+fold(j.m.), UNIQUE | Jednokolumnowy klucz zgadza się z Payloadowym `unique`; normalizator już istnieje                               | Research |
| Dopasowanie rozmyte     | Tylko podpowiedź w raporcie, nigdy przy zapisie          | `lessons.md`: nazwa → id wyłącznie dokładnie albo pusto                                                         | Research |
| Konflikt przy zasilaniu | Wygrywa wartość najczęstsza, remis → wyższa              | Na prawdziwych danych w 8 z 9 rozjazdów odstaje sama „Łazienka 1"; „najwyższa" zaciągnęłaby 8 nieaktualnych cen | Plan     |
| Kategoria               | Wolny tekst z nazwy sekcji, ucięty końcowy numer         | „Łazienka 1/2/3" to klony tego samego bloku 57 prac                                                             | Rozmowa  |
| Uprawnienia             | Admin / właściciel / manager, jak przy szablonach        | Właściciel odrzucił węższą bramkę                                                                               | Rozmowa  |
| Raport                  | Trzy liczby, ręczny, ostatnia faza                       | Wycinalny bez dotykania reszty, jeśli okaże się niepotrzebny                                                    | Rozmowa  |

## Zakres

**W zakresie:** kolekcja + migracja, ekran CRUD, zasilenie z szablonu-wzoru, wstawianie do kosztorysu,
zapis pracy z rozpiski, raport porównawczy.

**Poza zakresem:** żywa referencja z kosztorysu do katalogu, „zaktualizuj ceny z cennika",
automatyczne sprawdzanie zgodności, zmiany w szablonach, import z arkuszowych zakładek „zakres pracy",
katalog w widoku inwestora.

## Podejście

Kolekcja Payload z jednokolumnowym kluczem unikalnym. Kolejność faz tak dobrana, by każda następna
miała na czym pracować: byt → ekran → zasilenie 191 realnych pozycji → wstawianie → zapis
z rozpiski → raport. Cała logika (klucz, zasilenie, porównanie) mieszka w czystych modułach pod
`src/lib/kosztorys/work-catalogue/` i tam jest testowana; dialogi tylko wyświetlają.

## Fazy

| Faza                | Co dowozi                                  | Główne ryzyko                                                                                  |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1. Byt              | Tabela, kolekcja, klucz tożsamości, odczyt | Brak kolumny w tabeli blokad Payloada wywala każdy zapis                                       |
| 2. Ekran            | `/katalog-prac` z pełnym CRUD              | Pierwszy w repo globalny ekran z edycją i usuwaniem naraz                                      |
| 3. Zasilenie        | 191 pozycji z szablonu-wzoru               | Reguła zwycięzcy przy 9 rozjazdach; stawki dziedziczone dają 0 zł, jeśli pominąć współczynniki |
| 4. Wstawianie       | „Dodaj → Praca z katalogu…"                | N pozycji musi dostać N różnych `display_order`                                                |
| 5. Zapis z rozpiski | „Zapisz do katalogu…" w menu wiersza       | Menu wiersza istnieje w widoku inwestora — wymaga `editorOnly`                                 |
| 6. Raport           | „Porównaj z katalogiem"                    | Żadne — faza wycinalna                                                                         |

**Warunki wstępne:** świeży zrzut prod w lokalnej bazie (zrobione 2026-08-31), szablon-wzór w bazie.
**Szacowany rozmiar:** ~3–4 sesje; fazy 1–3 to jedna spójna całość, 4–6 dokładają powierzchnie.

## Ryzyka i założenia

- Reguła zwycięzcy przy zasilaniu opiera się na dzisiejszym kształcie wzoru (jeden szablon, cztery
  bliźniacze bloki łazienkowe). Drugi szablon o innym rozkładzie cen może ją podważyć.
- Blokada inwestycji (EX-748) jest w locie i będzie miała punkt dławienia w warstwie akcji —
  wstawianie z katalogu będzie musiało do tej powierzchni dołączyć.
- Migracja addytywna: prod migruje przed wyjściem kodu, ręcznie, przez człowieka.

## Kryteria sukcesu

- Dołożenie pracy, której nie ma w szablonie, zajmuje kilka kliknięć i przynosi aktualną cenę i stawki.
- Cennik da się poprawić w jednym miejscu, bez zakładania kosztorysu-poligonu.
- Wysyłając ofertę z kosztorysu opartego na starym wzorze, widać, które pozycje odstają od cennika.
