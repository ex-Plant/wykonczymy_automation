# Plan brief: sheet-column-mapping (EX-690)

Import kosztorysu ma dwa ślepe zaułki, oba kończące się komunikatem, po którym nie da się nic zrobić:
**nierozpoznana kolumna** (Żupnicza 18/73 rozbija wartość netto na „Wartość netto przedmiar" S
i „Wartość netto pomiar z natury" T — żadna nie pasuje do dokładnego dopasowania) i **nieudany
odczyt** (brak udostępnienia arkusza, martwy identyfikator i awaria Google dają jedno „spróbuj
ponownie za chwilę").

**Rozwiązanie:** przy porażce rozpoznawania okno pokazuje **kolumny nieprzypisane** z bloku
nagłówkowego (litera + tekst z wiersza 1 i 3) i pozwala wskazać właściwą. Osobno rozdzielamy trzy
przyczyny nieudanego odczytu, a przy braku dostępu podajemy adres konta serwisowego do skopiowania.

**Fazy:** 1 komunikaty o dostępie → 2 kandydaci z rozpoznawania → 3 zapis przy kosztorysie →
4 wskazywanie w obu oknach.

**Trzy decyzje, na których stoi całość:**

1. **Zapis jest wyłącznie awaryjny.** Dopasowanie po nazwie idzie pierwsze, do zapisu sięgamy tylko
   dla pól, których nie rozwiązało. Poprawiony nagłówek w arkuszu zawsze wygrywa ze starym
   wskazaniem, więc zapis nie może zapiąć złej kolumny na siłę i nie dotyka arkuszy, które działają.
2. **Wskazanie żyje przy kosztorysie**, nie przy kliknięciu — bo „Porównaj z arkuszem" jedzie na tym
   samym rozpoznawaniu i dziś nie ma nawet okna, w którym dałoby się cokolwiek wskazać. Nowa kolumna
   `kosztoryses.sheet_column_mapping jsonb`, migracja pisana ręcznie.
3. **Komunikaty idą pierwsze**, choć wyglądają na poboczne — to one przenoszą nieudany odczyt
   z czerwonego toasta do **danych okna**, a bez tej struktury porównanie nie ma gdzie pokazać wyboru
   kolumn (ani przycisku kopiującego adres).

**Dlaczego wybór S vs T jest niegroźny:** `netValue` nie wchodzi do żadnej pracy — czytają ją tylko
`footer-totals.ts` (współrzędna liczby w wierszu podsumowania) i skan błędów formuł. Wartość każdej
pracy liczy `calc.ts` z ilości, ceny i rabatu. Do tego porównanie sum sprawdza odczytaną liczbę po
kolei ze wszystkimi trzema sumami, które umiemy policzyć, i samo raportuje, z którą się zgadza.
Import odmawia więc przez kolumnę, która nie wnosi do kosztorysu ani złotówki.

**Czego nie robimy:** nie luzujemy dopasowań po nazwie (prefiks złapałby na Żupniczej S i T naraz —
odmowa „nie znaleziono" zamieniłaby się w odmowę „pasuje do 2 kolumn"); nie blokujemy pobrania na
kolumnach opcjonalnych (Ryżowa bez rabatu ma się wczytywać jak dziś); żadnego globalnego słownika
nagłówków; nie da się wskazać kolumny zajętej przez inne pole.

**Dowód z natury:** inwestycja 84 (Żupnicza 18/73) — bez niej cała zmiana opiera się na próbce.

Pełny plan: `plan.md`. Kontekst: `change.md`.
