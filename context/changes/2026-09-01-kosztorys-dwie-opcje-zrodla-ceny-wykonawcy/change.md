---
change_id: kosztorys-dwie-opcje-zrodla-ceny-wykonawcy
title: Źródło ceny wykonawcy tylko z dwiema opcjami — cięcie trybu „własny mnożnik"
status: implementing
created: 2026-09-01
updated: 2026-09-01
archived_at: null
branch: kosztorys-contractor-price-columns-in-client-view
worktree: null
---

## Notes

Cięcie trybu „własny mnożnik": źródło ceny wykonawcy zostaje jako kolumna, ale tylko z dwiema
opcjami (auto / kwota stała); kolumna „Mnożnik" znika.

Ustalenia z rozmowy kształtującej (2026-09-01, właściciel):

- **Zero wierszy z własnym mnożnikiem w bazie** — 5344 pozycje kosztorysu w lokalnej bazie
  (kopia produkcji + zaimportowane rozpiski) rozkładają się na kwotę stałą i auto, ani jednej
  na własnym mnożniku.
- **Katalog prac już zrobił to uproszczenie** — jego tabela trzyma stawkę albo NULL, czyli
  dokładnie „kwota stała albo auto". Trzeciego trybu tam nigdy nie było, a każda praca wstawiona
  z katalogu ląduje w rozpisce jako jedno z tych dwóch.
- **Import z arkusza traci mało i nic nie nadpisuje** — kosztorys czytamy jednokierunkowo (do
  arkusza wracają wyłącznie transfery), więc zamrożenie stawki jako kwoty stałej nie dotyka
  formuły właściciela. Jedyny skutek: taka stawka przestaje chodzić za „Cena j.m." po imporcie —
  a to i tak jest już zachowanie 3123 z 5344 wierszy.
- **Rozpoznawanie formuły przy imporcie MUSI zostać.** Import odróżnia stawkę będącą formułą
  z „Cena j.m." od wklepanej ręcznie, która przypadkiem wychodzi na ten sam mnożnik. Tylko
  formuła może iść na auto. Decydowanie samym ilorazem wysłałoby ręcznie wpisaną stawkę na auto
  i kazało jej się ruszać przy każdej zmianie ceny klienta — powiązanie, którego właściciel
  nigdy nie zrobił. Wykrywanie mnożnika cennika też zostaje: decyduje auto-czy-kwota i ląduje
  w ustawieniach inwestycji.
- **Kolumna „Mnożnik" idzie w dół** — mnożnik jest jeden na całą inwestycję (nie ma mnożnika per
  sekcja), więc po cięciu trybu kolumna pokazywałaby jedną powtórzoną stałą w wierszach na auto
  i „—" w pozostałych.
- **Kolumna „Źródło ceny wykonawcy" ZOSTAJE**, z dwiema opcjami. Rozważane było wycięcie jej też
  (wpis w „Cena j.m." = kwota stała, wyczyszczenie = auto działa bez listy), ale to czyni powrót
  na auto nieodkrywalnym. Nazwana opcja jest lepsza niż podpowiedź nagłówka.
- Sześć kolumn ceny wykonawcy schodzi do czterech w widokach wykonawcy („Źródło" + „Cena j.m." na
  plan) i do dwóch w widoku inwestora. **W widoku inwestora źródło nie składa się wcale**
  (właściciel, 2026-09-01): to sterownik edycji, nie figura do porównania, a tam czyta się ofertę.
  Zostają „Cena j.m. netto" obu planów.
- Efekt uboczny: znika przejście przeliczające wspólne pole wartości (dziś 200 zł po zmianie
  źródła musi być przeliczone, żeby nie stało się mnożnikiem 200). Przy dwóch trybach wartość ma
  jedno znaczenie — auto to jej brak.
- **Cięcie ląduje na niewypchniętej pracy.** Sześć kolumn to cztery commity tej gałęzi, wciąż
  przed staging. Historia zostaje nietknięta — cięcie kładziemy na wierzchu, nie przepisujemy
  tamtych commitów.

Zakres do rozpisania: dwie opcje w edytorze, kolumny „Źródło" (skrócona lista) i „Mnożnik"
(usunięta) wraz z sortowaniem, pickerem kolumn i podpowiedzią nagłówka; gałąź własnego mnożnika
w wycenie i w SQL należności wykonawcy; import mapujący na auto-albo-kwotę; migracja kasująca
martwą wartość enuma.
