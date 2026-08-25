---
change_id: marza-prognoza-rzeczywista
title: Zakładka „Marża" — prognoza z przedmiaru obok marży rzeczywistej, obie z kosztorysu
status: archived
created: 2026-08-18
updated: 2026-08-18
archived_at: 2026-08-18T12:18:40Z
branch: marza-prognoza-rzeczywista
worktree: null
---

## Notes

EX-649. Dwie marże: prognoza (z przedmiaru / oferty) obok rzeczywistej (z wykonanych prac).
Prognoza jest scenariuszem — przełącznik „z narzędziami / bez narzędzi", nie widełkami zawężającymi
się w czasie. Materiały wychodzą z rozliczenia poza „materiałami wliczonymi w robociznę"; pozycja
„obniżka materiałów" znika z formuły. Wypłaty zastąpione kwotą należną podwykonawcom, liczoną
z kosztorysu. Rabat i strata dalej obniżają marżę rzeczywistą; prognoza jest bez straty i bez
rozliczonego materiału. Pełne uzasadnienie w EX-649.

## Rozstrzygnięcia (2026-08-18)

1. **Rabat nie wchodzi do prognozy.** Rabatu nie daje się z góry — prognoza liczy się z przedmiaru po
   pełnej cenie. Rabat obniża wyłącznie marżę rzeczywistą, tak jak dziś. (Właściciel.)
2. **Prognoza nie sygnalizuje sposobu ustalenia stawki wykonawcy.** Ręcznie wpisana kwota jest osobna
   dla każdego widoku, więc scenariusz i tak je rozróżnia; a stawka ze współczynnika jest równie
   dobrą odpowiedzią na „ile byśmy zapłacili" jak stawka wynegocjowana. Pomiar (lokalna baza, 1751
   pozycji): 567 pozycji ma obie kwoty wpisane, 1181 żadnej, **3 mają tylko jedną**. Nie ma czego
   sygnalizować.
3. **Lista inwestycji dostaje nową marżę jako DRUGĄ kolumnę — stara zostaje nietknięta.** Nowa
   kolumna pokazuje dokładnie tę samą figurę co podsumowanie kosztorysu. **Prognoza na listę nie
   idzie**: ogląda się ją przy konkretnej inwestycji, nie porównuje w tabeli. Koszt: fold w bazie
   liczący należne podwykonawcom po etapach i ich sposobach rozliczenia, plus test parytetu
   baza↔edytor. (Właściciel.)
4. **Etap z wykonaną pracą i bez wybranego sposobu rozliczenia wstrzymuje marżę rzeczywistą.** Zamiast
   kwoty — wezwanie „ustaw sposób rozliczenia etapów", i tak samo na liście inwestycji (ten sam fold
   zwraca tę informację obok kwoty). Zero byłoby twierdzeniem, że praca nic nie kosztowała; domyślna
   wycena zgadywałaby za właściciela to, co i tak musi kliknąć. Stan wyjściowy: poza jedną inwestycją
   wszędzie takie etapy są, więc kolumna zapala się dopiero po uzupełnieniu danych — to jest cel, nie
   skutek uboczny. Lista „Problemy" prowadzi prosto do brakujących etapów. (Właściciel.)
5. **„Obniżka materiałów" wypada z nowej marży, zostaje w bilansie inwestora.** Marża jest o
   robociźnie; materiał wchodzi do niej wyłącznie wtedy, gdy jest w nią wliczony. Kafelek po stronie
   bilansu bez zmian (kafelki muszą sumować się do bilansu, pod którym stoją). **Uwaga na opis:** to
   jest usunięcie składnika, nie zaksięgowanie odzyskanego VAT jako zysku — ruling z 2026-07-26
   (materiał to przelotka, żadnego `+VAT` w marży) obowiązuje dalej i nie wolno go tą zmianą pozornie
   odwrócić. (Właściciel.)
6. **Stara marża zostaje żywa w widoku v1, nietknięta — z „obniżką materiałów" włącznie.** Właściciel
   chce widzieć obok siebie, jak liczyło się do tej pory i jak będzie się liczyć. Skutek dla
   implementacji: **nie modyfikujemy istniejącej formuły, dopisujemy drugą**. Stare testy dalej
   pilnują starej definicji, nowe dostają własne — ryzyko „zmiana definicji ucisza stare testy"
   znika. Podział jak dotąd: v1 = płaszczyzna transakcji, v2 + lista = płaszczyzna kosztorysu.
   (Właściciel.)

## Do rozstrzygnięcia w planie

- Spec parytetu (`investment-render-parity-db.test.ts:147`) **zostaje nietknięty** — stara kolumna
  dalej porównuje się ze starą formułą. Dokładamy drugi wiersz dla nowej kolumny, i ten wiersz nie
  może wołać tej samej funkcji po obu stronach (byłby tautologią). Lewa strona idzie przez prawdziwy
  budowniczy wiersza listy, czyli przez fold SQL — prawa ma liczyć należne podwykonawcom **drugą
  drogą**, z drzewa, tak jak liczy je edytor. Wtedy spec pilnuje dryfu baza↔edytor, którego dziś nikt
  nie pilnuje, a który przy tej zmianie jest najbardziej prawdopodobny.
- Odcisk wejść w golden masterze nie obejmuje płaszczyzny etapu ani stawek podwykonawcy — po zmianie
  edycja stawki ruszy marżę bez ruszenia odcisku. Oś podwykonawcy musi wejść do tego SQL w tej samej
  zmianie.

## Doprecyzowania z EX-649 (odczytane 2026-08-18, przy implementacji)

- **Prognoza to „marża przed materiałem" i tak musi być opisana.** Na pozycjach, gdzie materiał jest
  wliczony w cenę inwestora, przedmiar niesie przychód z materiału i żadnego jego kosztu — więc
  prognoza siedzi strukturalnie powyżej marży rzeczywistej i te dwie figury nie zbiegną się nawet
  przy pełnym wykonaniu. Kosztorys nie wie, które to pozycje; „naprawa" przez odjęcie wydatków
  odrzucona (przestałaby być prognozą). Opis pod prognozą (faza 2) musi to mówić wprost.
- **Dwa miejsca, w których EX-649 (2026-08-17) mówi coś innego niż rozstrzygnięcia z 2026-08-18** —
  obowiązują te nowsze: (a) issue każe usunąć „obniżkę materiałów" z `calculateMargin`, my starej
  formuły nie ruszamy i dopisujemy drugą; (b) issue liczy prognozę „less rabat", właściciel
  rozstrzygnął, że prognoza idzie po pełnej cenie.

## Odstępstwa od planu (zapisane przy review gate, 2026-08-18)

- **Cofnięcie EX-555: `LABOR_COST` i `RABAT` wracają do okna transferu — tymczasowo.** Plan tego nie
  przewidywał. Powód: `readingFromKosztorys` nie ma żadnego fallbacku, więc inwestycja, której
  kosztorys nadal żyje w arkuszu, czyta 0 zł robocizny i 0 zł rabatu — i po zdjęciu obu typów nie da
  się jej rozliczyć żadną drogą. Podwójnego liczenia nie blokujemy, tylko **pokazujemy** (ikona rozjazdu
  przy „Robocizna v2" na listingu). v2 jest na to strukturalnie odporne, bo odczyt z kosztorysu **zastępuje**
  figurę, a nie dodaje do niej. Warunek wyjścia: **EX-712** — gdy każda żywa inwestycja ma kosztorys
  w aplikacji, oba typy znikają z okna na stałe i ten akapit się usuwa.
- **Blok „Rozliczenie z ekipą" pod marżą rzeczywistą — wbrew decyzji 5 planu.** Plan mówił, że
  wypłaty do marży nie wchodzą i nie mają się przy niej pokazywać. Przy dogfoodingu okazało się, że
  sama marża bez tej pary czyta się jak sprzeczność („kosztorys mówi tyle, ekipa dostała tyle"), więc
  blok wchodzi **obok** marży, z opisem mówiącym wprost, że jest poza nią. Decyzja 5 zostaje w mocy
  co do **formuły** — wypłaty dalej nie są kosztem marży; zmienia się tylko to, co widać na ekranie.
