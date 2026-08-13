---
change_id: sheet-live-compare
title: Porównanie z arkuszem na żywo zamiast raportu z importu
status: implemented
created: 2026-08-13
updated: 2026-08-13
archived_at: null
branch: sheet-live-compare
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/sheet-live-compare
---

## Notes

akcja „Porównaj z arkuszem": czytanie arkusza na żywo, rachunek obu stron, wykrywanie podejrzanych
formuł (Pomiar przepisany z Przedmiaru, Przedmiar liczony z etapu) i osobna akcja „zaciągnij pomiary
z arkusza" odświeżająca liczby odniesienia bez pełnego importu

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

## Odroczone

E2E dla obu akcji: **EX-687** (`e2e-backlog`) — najpierw trzeba mieć podstawiony klient Sheets,
inaczej spec przeglądarkowy nie ma czego asertować. Ten sam brak dotyczy EX-686 i jest odnotowany
w tym samym zgłoszeniu, żeby nie tworzyć drugiego za tą samą zaporą.
