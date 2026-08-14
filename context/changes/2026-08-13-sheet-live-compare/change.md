---
change_id: sheet-live-compare
title: Porównanie z arkuszem na żywo zamiast raportu z importu
status: implemented
created: 2026-08-13
updated: 2026-08-14
archived_at: null
branch: pomiar-bez-etapu
worktree: null
---

## Notes

Ta zmiana jest domknięciem EX-686 (kasuje akcję, którą tamta dodała), więc jej commity leżą na
gałęzi `pomiar-bez-etapu` — jedna gałąź na obie. Osobna `sheet-live-compare` była pomyłką i została
usunięta.

akcja „Porównaj z arkuszem": czytanie arkusza na żywo, rachunek obu stron, wykrywanie podejrzanych
formuł (Pomiar przepisany z Przedmiaru, Przedmiar liczony z etapu) i osobna akcja „zaciągnij pomiary
z arkusza" odświeżająca liczby odniesienia bez pełnego importu

Faza 6 zlała tę osobną akcję z porównaniem — odświeżenie dzieje się przy otwarciu okna, przycisku
już nie ma.

Skąd to wyszło (dogfooding inwestycji 31, 2026-08-13): arkusz pokazuje „wartość netto 508 196 zł",
aplikacja 491 519,25 zł. Różnica 16 677,70 zł siedzi w 26 pozycjach, na których arkusz ma Pomiar
z natury jako formułę `=N` — czyli przepisany Przedmiar, nie pomiar. Import celowo takich nie
zaciąga (`sheet-import/parse-robocizna.ts`, `readMeasuredQty`), więc kolumna „Rozjazd" jest na nich
strukturalnie ślepa i zero rozjazdów nie dowodzi zgodności.

Pełny skan anomalii formuł tego arkusza: `context/reference/kosztorys-sheet/formula-anomalies.md`.

Odrzucone po drodze: zapisywanie raportu z importu do bazy + przycisk do jego otwierania. Migawka
sprzed importu i tak dezaktualizuje się razem z arkuszem, więc lepszy jest odczyt na żądanie.

Podział ról, który ma z tego wyjść:

- „Rozjazd" w siatce — lista robocza per pozycja, stoi na zapisanej liczbie, działa bez arkusza
- „Porównaj z arkuszem" — szerszy rachunek obu stron + zdrowie formuł, wymaga żywego połączenia
- zapisana liczba odniesienia przestaje być zdjęciem z dnia importu i staje się odświeżalnym cache'em

Świadomie przyjęte ryzyko: bez dostępu do arkusza (cofnięte udostępnienie, usunięta zakładka, brak
sieci) widok nie zadziała w ogóle.

## Decyzja właściciela (2026-08-13): akcja „Etapy są prawdą" znika

Akcja w menu wiersza kasowała zapisaną liczbę odniesienia, żeby wyciszyć rozjazd. Powody usunięcia:
gasiła objaw kasując dane zamiast pokazać niezgodność, działała per wiersz przeciwko problemowi,
który jest zbiorowy (26 pozycji naraz), i była jedynym powodem, dla którego odświeżanie pomiarów
musiałoby cokolwiek rozstrzygać. Rozjazd zamyka się teraz poprawieniem arkusza albo wypełnieniem
etapów — innego wyjścia nie ma.

## Decyzje właściciela (2026-08-14, po przeklikaniu inwestycji 31) — faza 6

- **Zaciąganie pomiarów nie jest wyborem.** Zapisana liczba odniesienia to kopia Pomiaru z arkusza;
  skoro okno i tak czyta arkusz na żywo, „zostaw starą kopię" nie jest odpowiedzią, którą ktokolwiek
  wybierze. Przycisk znika, zaciąganie dzieje się przy otwarciu, okno melduje co zmieniło.
- **Klasa masowa dostaje liczbę, klasy punktowe dostają wiersze.** „Pomiar przepisany z Przedmiaru"
  (241 z 336) jest zbiorowy i zamyka się poprawieniem arkusza albo wypełnieniem etapów. „Przedmiar
  liczony z etapu" (7) i wartości błędu poprawia się po jednej komórce — te wypisujemy.
- **Numer wiersza jest linkiem** prosto do komórki w arkuszu.

Powód, dla którego lista była bezużyteczna: jeden wspólny 25-elementowy koszyk próbek dla wszystkich
trzech klas, zapełniany w kolejności wierszy — klasa masowa wyczerpywała go, zanim padł pierwszy
wiersz klasy punktowej. Efekt: okno wypisywało po prostu górę arkusza, bez podpisu co komu dolega.

## Faza 7 — dopisana wstecz przy bramce review (2026-08-14)

Pięć commitów weszło już po domknięciu planu na fazie 6. Nie były to poprawki fazy 6, tylko druga
tura decyzji — spisane tutaj, bo dwie z nich są rozstrzygnięciami domenowymi, a nie zmianami kodu.

- **„Rozjazd" → „Pozostało do rozliczenia"** (`0bdea8c9`). Odejmowanie zostaje to samo; zmienia się
  to, czym ta liczba **jest**. „Rozjazd" nazywał usterką coś, co jest zwykłą linią bilansową:
  jedyny sposób na wyzerowanie tej kolumny to wpisać ilości w etapy, czyli zadeklarować pracę jako
  wykonaną. Dlatego kolumna pokazuje się teraz przy każdym zaimportowanym kosztorysie, a nie tylko
  tam, gdzie coś się rozjeżdża. Trafiło do `kosztorys-editor-domain-notes.md`.
- **„Wartość netto" w podsumowaniu arkusza liczy się z Pomiaru, nie z Przedmiaru** (`d8c2fdbc`).
  Zestawialiśmy ją z wartością przedmiaru — czyli z liczbą, której arkusz nigdzie nie sumuje. To była
  usterka fazy 2. U części klientów ten sam wiersz sumuje jednak ofertę, więc porównanie najpierw
  sprawdza, którą z naszych sum wiersz faktycznie trafia. Też w notatkach domenowych.
- **Przepisanie okna porównania** (`0345d520`) — inny model kwot (wykonanie plus „pozostało" po obu
  stronach) i pełne, nieprzycięte listy różnic per praca. Świadome cofnięcie limitu z fazy 3: suma
  tej listy **jest** liczbą z tabeli, więc skrócenie listy byłoby kłamstwem o sumie. Limit został
  natomiast na próbkach formuł, gdzie liczba i tak stoi obok.
- **Stawki podwykonawców w obu oknach** (`405cdc7a`, `488a3bc9`). Plan zakładał, że porównanie nie
  woła cennika w ogóle — teraz woła. Właściwość, która za tym stała, żyje: brak cennika nie wywraca
  porównania (`readRateTabs` oddaje pustą listę zamiast rzucić, `ok: false` nadal wychodzi wyłącznie
  z `resolveRobocizna`), i jest przypięta specem.

Pożyczony zakres, spoza tej zmiany — odnotowany, żeby równoległa sesja się nie zdziwiła:
`fe6ccc8c` (przycinanie etykiety w pasku sekcji, usterka CSS bez związku z arkuszem) oraz
`ff3dc0e6` (`unresolvedOptional` w miejsce listy rozpoznanych kolumn), który wchodzi w
`columns.ts` / `resolve-columns.ts` — terytorium `context/changes/2026-08-14-sheet-column-mapping/`.

## Odroczone

E2E dla obu akcji: **EX-687** (`e2e-backlog`) — najpierw trzeba mieć podstawiony klient Sheets,
inaczej spec przeglądarkowy nie ma czego asertować. Ten sam brak dotyczy EX-686 i jest odnotowany
w tym samym zgłoszeniu, żeby nie tworzyć drugiego za tą samą zaporą.
