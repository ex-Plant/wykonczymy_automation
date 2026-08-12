# Plan Brief: Pobieranie kosztorysu z arkusza Google

**Change:** `kosztorys-importer` · slice S-15 · EX-417
**Full plan:** `plan.md`

## Co budujemy

Przycisk **„Pobierz z arkusza Google…"** w menu „Opcje" edytora kosztorysu. Wciskasz go na
konkretnej inwestycji — aplikacja czyta arkusz podpięty do tej inwestycji, pokazuje podgląd
tego, co wejdzie, i po potwierdzeniu podmienia kosztorys. Tuż przed podmianą sama robi wersję,
więc „Wczytaj" zawsze cofa import.

To zamyka pytanie, które trzymało S-15 od miesięcy: **czym to jest uruchamiane**. Odpowiedź —
przyciskiem, na żądanie, per inwestycja. Nie jednorazową migracją. Dzięki temu narzędzie jest
przydatne również po pierwszym przejściu: arkusz się zmienia, klikasz jeszcze raz.

## Skąd bierze dane

- **Zakładka `kosztorys_robocizny`** to autorytet dla drzewa: sekcje, prace, przedmiar, j.m.,
  cena j.m., rabat i wykonanie w etapach.
- **Obie zakładki `zakres pracy`** dostarczają stawek. Dla każdej pracy wybierana jest jedna
  zakładka i obie stawki brane są z niej — nie po jednej z każdej.
- **„Pomiar z natury" jest świadomie pomijany.** W arkuszu to formuła sumująca etapy, a aplikacja
  liczy pomiar tak samo (EX-489). Wczytanie go wprowadziłoby drugą, sprzeczną prawdę.

Kolumny wyszukiwane są **po nagłówku, nigdy po pozycji**. Sprawdzone na wszystkich 45 arkuszach
z bazy: „Przedmiar" stoi w sześciu różnych kolumnach, etapów bywa od 3 do 10, a nagłówki etapów
bywają przemianowane na imiona ekip — dlatego etapy rozpoznawane są po słowie „wykonano"
w drugim wierszu nagłówka. 43 z 45 arkuszy rozpoznają się same. Dwa (Dąbrowskiego 86,
Ryżowa 66/127) są naprawdę dwuznaczne i wymagają poprawienia jednej komórki w arkuszu.

## Czego import nie dotyka

Tryb rozliczenia, stawka netto materiałów, rabat globalny, VAT, współczynniki globalne,
przypisanie etapu do ekipy i planu narzędziowego, kolory sekcji, notatki. Żadnej z tych rzeczy
nie ma w arkuszu — zostają tak, jak je wpisano w aplikacji. **Nic nie jest kasowane**: praca,
której w arkuszu już nie ma, zostaje i jest wypisana w podglądzie.

## Sprawdzian poprawności

Każdy arkusz ma na dole własne sumy („wartość netto", „R netto - suma prac wykonannych").
Podgląd stawia obok siebie sumę arkusza i sumę policzoną przez aplikację. Ta liczba zależy od
każdej ceny, każdego rabatu i każdej ilości z osobna — jeśli się zgadza, odczyt jest poprawny.
Rozjazd to ostrzeżenie, nie blokada: zdarzają się arkusze z zepsutymi formułami w stopce.

## Ile to pracy

Mniej, niż wyglądało. **Ścieżka zapisu już istnieje** — przywracanie wersji robi dokładnie to samo
(transakcja → wersja → podmiana drzewa), więc import ją wykorzystuje zamiast budować drugą.
**Wzorzec podgląd→zatwierdź też istnieje** — synchronizacja materiałów z arkuszem działa tak samo,
z jednym wspólnym budowniczym planu, żeby podgląd i zapis nie mogły się rozjechać. Naprawdę nowe
jest wyłącznie **czytanie arkusza**: istniejący rozpoznawacz nagłówków wymaga wszystkich pól
w jednym wierszu i wywraca się na duplikatach, a nagłówek kosztorysu to trzy wiersze z celowymi
duplikatami.

Pięć faz: rozpoznawanie kolumn → parsowanie i stawki → plan importu → akcje serwerowe → interfejs.
Trzy pierwsze to czyste funkcje, pisane testami z wyciętych fragmentów prawdziwych arkuszy —
bez bazy i bez sieci.

## Ryzyka

- **Stawki sprzeczne między zakładkami.** Rozstrzygane automatycznie, ale każde rozstrzygnięcie
  jest wypisane po nazwie pracy — nigdy zwinięte do liczby. Doszedł twardy warunek: stawka „bez
  narzędzi" nie może być wyższa niż „z narzędziami". Bez niego heurystyka wybrała na Białostockiej
  wariant arytmetycznie niemożliwy.
- **Dwa arkusze się nie rozpoznają.** Import mówi, której kolumny brakuje w której zakładce, i nie
  pozwala potwierdzić. Naprawa to jedna komórka w arkuszu, nie kod.
- **Dane klientów.** Wiersz 1 arkusza to „Imię i nazwisko oraz adres inwestycji". Parser go nie
  czyta, fragmenty do testów nazywane są numerem inwestycji, a osobny test pilnuje, żeby do
  katalogu z fragmentami nie wjechało nazwisko.

## Czego tu nie ma

Masowego przejścia po wszystkich 45 arkuszach — nie ma teraz do nich dostępu. Najpierw przycisk
działający na jednej inwestycji (Białostocka jako wzorzec), skan jako osobny krok później. Jego
wynikiem i tak nie są dane do przeniesienia na produkcję, tylko **lista poprawek**: na produkcji
ten sam przycisk czyta te same arkusze.

## Jak sprawdzić, że działa

Import Białostockiej lokalnie: 13 sekcji, 324 prace, 10 etapów, suma zgodna ze stopką arkusza,
lista rozstrzygnięć pokazuje 8 automatycznych i 1 sporne. Potem „Wczytaj" → wersja sprzed importu
wraca.
