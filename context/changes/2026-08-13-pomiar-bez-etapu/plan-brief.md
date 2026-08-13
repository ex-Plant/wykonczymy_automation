# Plan brief: pomiar-bez-etapu (EX-686)

Import zapisuje przy każdej pozycji **liczbę odniesienia z arkusza** („Pomiar z natury" wpisany
ręcznie). Liczba **niczego nie liczy** — nie wchodzi do robocizny, marży ani rozliczeń z ekipami.
Jej jedyne zadanie to porównanie z sumą etapów.

**Rozjazd jest wyliczany na żywo** (`odniesienie − Σ etapów`), więc lista kurczy się sama, gdy
właściciel wpisuje brakujące ilości. Model bez zmian: suma etapów zostaje jedyną prawdą o pracy
wykonanej.

**Trzy afordancje:** czerwony ton komórki „Pomiar z natury" z podpowiedzią (arkusz / etapy / kwota),
filtr „tylko rozjechane" z licznikiem, akcja „etapy są prawdą" czyszcząca odniesienie.
Wszystko wyłącznie dla właściciela.

**Fazy:** 1 import zapisuje odniesienie → 2 znacznik + podpowiedź → 3 filtr + licznik →
4 akcja czyszcząca → 5 guardy przecinające warstwy.

**Dwie decyzje, na których stoi całość:**

1. **Formuła = brak odniesienia.** W kanonicznym arkuszu Pomiar to `=SUM(D:M)` (435/435). Zapisanie
   jej wyniku dałoby porównanie sumy etapów z sumą etapów — funkcję robiącą nic. Import czyta więc
   formuły zakładki robocizny (dziś **nie są pobierane**) i zapisuje odniesienie tylko tam, gdzie
   liczba jest wpisana ręcznie. Realne arkusze: inw. 31 — 0/245 formuł, testowy — 0/253.
2. **Pusta komórka → brak odniesienia, nie zero.** Zero zapaliłoby na czerwono każdy wiersz z etapami.

**Czego nie robimy:** żadnego syntetycznego etapu / kubełka (odrzucone przez właściciela); liczba
**nie dostaje kolumny w siatce** — trzy niezależne listy dozwolonych pól czynią zapis niemożliwym,
i to oszczędza ~12 plików; bez podbicia wersji migawki; bez backfillu.

**Hazard:** golden master hashuje `sum(sp.qty)` i przy zmienionych danych **cicho pomija** zamiast
świecić na czerwono. Skopiować fixture przed `test:golden:update`.

**Fixture referencyjny:** inw. 31 → 32 pozycje rozjechane, 41 377 zł, w tym „Posadzki z mikrocementu"
(arkusz 95, etapy 55, 16 000 zł).

Pełny plan: `plan.md`. Kontekst: `research.md`, `change.md`.
