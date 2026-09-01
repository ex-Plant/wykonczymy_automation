---
change_id: legacy-sheet-work-import
title: Import brakujących prac ze starych arkuszy do katalogu prac
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T14:45:36Z
branch: legacy-sheet-work-import
worktree: null
---

## Notes

Jednorazowa akcja: katalog prac powstaje z kosztorysu wzór (~400 prac), ale część prac
występuje tylko w starych arkuszach inwestycji. Trzeba je stamtąd wyciągnąć i dołożyć do
katalogu jako dodatkowe pozycje.

**Blokada kolejnościowa:** rusza dopiero, gdy katalog istnieje i jest wypełniony wzorem
(`context/changes/2026-08-31-work-item-catalog/`). Wcześniej „brakujące" znaczy „wszystkie".

### Ustalenia z właścicielem (2026-08-31) — wejście do planu, nie hipotezy

1. **Zakres: wszystkie 56 arkuszy**, nie tylko zakończone inwestycje — trwające niosą
   najświeższe ceny, a przy regule „najnowszy arkusz" to one wygrywają.
2. **Cena: z najnowszego arkusza**, w którym praca występuje. Rozrzut cen i liczba wystąpień
   idą do raportu jako informacja przy weryfikacji (po nich widać, czy pozycja jest realną
   pracą, czy dopiskiem z jednej budowy).
3. **Stawki podwykonawców wchodzą razem z ceną**, z tego samego arkusza co ona — jako
   zamrożone kwoty, zgodnie z modelem katalogu.
4. **Bez progu wystąpień.** Wchodzi wszystko, czego nie ma w katalogu. Odrzucona wcześniejsza
   propozycja filtrowania jednorazowych dopisków — właściciel: „nie będzie ich parę tysięcy".
5. **Znacznik = wyraźny dopisek do nazwy pozycji**, kasowany ręcznie przy przeglądzie
   katalogu. Świadomie ŻADNEGO pola w bazie — plan katalogu nic z tego powodu nie dokłada.
6. **Ostrożne sklejanie wariantów nazw** (szyk słów, skróty, liczba mnoga), bez rozmytego
   progu podobieństwa. Uzasadnienie: cena wchodzi z najnowszego arkusza, więc złe sklejenie
   dwóch różnych prac = zła cena, której przy przeglądzie NIE widać (widać jedną, wiarygodnie
   wyglądającą pozycję). Duplikat widać i się go kasuje — jest tańszy.
7. **Forma: skrypt offline, trzy przebiegi** — (a) zassanie wszystkich arkuszy na dysk raz
   (API Google jest limitowane, przy 56 arkuszach łatwo o 429), (b) analiza na kopii bez
   ruchu sieciowego, (c) raport do przejrzenia. Import nie zapisuje nic sam.
8. **Akcja jednorazowa.** Nie wraca. Stąd: bez idempotencji, bez odporności na drugie
   uruchomienie, bez testów, bez miejsca w aplikacji — skrypt do skasowania po akcji.

### Świadomie przyjęte skutki punktu 5 (dopisek w nazwie)

- Dopisek pojedzie do kosztorysu i dalej do oferty, jeśli ktoś go nie skasuje. Uznane za
  zaletę (wymusza reakcję).
- Dopisek psuje dopasowanie po nazwie, więc taka pozycja wyjdzie w „Porównaj z cennikiem"
  jako „brak w cenniku" do czasu przeglądu. Przy akcji jednorazowej to stan przejściowy,
  więc nic tego nie musi odcinać programowo.

### Co ma nowy kod, a co jest przeróbką

Nowe: normalizacja j.m. (m2 / m² / mkw, szt / szt. — a ta sama nazwa z m² i z mb to DWIE
różne prace, nie wolno ich scalić), ostrożne grupowanie wariantów nazw, wybór ceny
z najnowszego arkusza.

Do przerobienia (istnieje): czytanie arkuszy i rozpoznawanie kolumn, klucz tożsamości pracy
po znormalizowanej nazwie (dziś zawężony do sekcji + numeru wystąpienia — katalog musi zdjąć
oba zawężenia), parser cennika „zakres pracy z/bez narzędzi" wraz z rozstrzyganiem
sprzeczności między dwiema zakładkami. Nowa oś sprzeczności, której dziś nie ma: ten sam
spór MIĘDZY arkuszami.

Napięcie do pilnowania (roadmap.md:420): ta sama praca kosztuje różnie w różnych
inwestycjach (inna ekipa → inna cena). Katalog tego nie łamie, bo cena jest kopiowana przy
wstawieniu i nigdy żywa — ale raport ma mówić „różni się od cennika", nigdy „jest błędna".

### Ustalenie: prod dostaje wynik, nie powtórkę akcji (2026-09-01)

Prod nie ma jeszcze tabeli `work_catalogue_items` (katalog żyje na gałęziach, nie na `main`),
więc akcja nie jest „zrób lokalnie, powtórz na produkcji". Cała praca dzieje się na lokalnej
bazie, a produkcja dostaje jej **wynik jako dane**:

1. lokalnie: wsad wzoru (`seed-work-catalogue.ts`, szablon 373 pozycje → 194 unikalne klucze)
   - trzy przebiegi importu ze starych arkuszy,
2. lokalnie: przegląd w aplikacji — kasowanie śmieci, poprawki cen, zdejmowanie dopisków.
   To jest praca, której nie wolno powtarzać,
3. produkcja: **eksport całego lokalnego `work_catalogue_items`** jako jednorazowy wsad, po
   merge'u katalogu na `main` i migracji. Bez zasysania arkuszy, bez analizy, bez przeglądu.

Skutki dla planu:

- Skrypt importu pisze wyłącznie do lokalnej bazy — nie potrzebuje ścieżki „nazwij bazę jawnie
  przy wywołaniu", którą ma `seed-work-catalogue.ts`, bo nigdy nie celuje w produkcję.
- Dochodzi drobny krok: eksport katalogu do pliku + wsad tego pliku (insert-only po
  `match_key`). Kształtem to `seed-work-catalogue.ts`, więc przeróbka, nie nowy kod.
- Produkcja dostaje **wyłącznie** ten eksport — wzór też jedzie z lokalnego, przejrzanego
  stanu. Żadnego osobnego uruchomienia `seed-work-catalogue.ts` na produkcji; inaczej wzór na
  produkcji różniłby się od tego, co było oglądane na ekranie.
- Warunek: między przeglądem a wsadem nikt nie zanieczyszcza lokalnego katalogu danymi
  testowymi — to on jest źródłem.

### Jak to wyszło — odstępstwa od ustaleń (2026-09-01)

1. **Dopisek to SUFIKS, nie prefiks** (decyzja właściciela w trakcie). Listing sortuje po nazwie,
   więc sufiks stawia pracę z arkusza obok jej bliźniaczki ze wzoru — a to jest dokładnie to
   porównanie, które robi przegląd; prefiks zsypałby wszystkie dołożone pozycje w jeden blok pod
   „[". Sam dopisek i zdejmowanie go mieszkają w `lib/kosztorys/work-catalogue/legacy-marker.ts`,
   bo `match_key` liczy nie tylko skrypt, ale i formularz katalogu — patrz wpis w `lessons.md`.
2. **Skrypty jednorazowe skasowane od razu po akcji**, nie „kiedyś": zassanie, analiza, raport
   i wsad kandydatów (dziesięć plików). Zostały tylko eksport katalogu, wsad z pliku i sam JSON —
   te mają pracę do wykonania jeszcze po tej zmianie, na produkcji (EX-763). Punkt 8 ustaleń
   przewidywał kasację całości; ta trójka znika dopiero po wgraniu katalogu na produkcję.
3. **Literówki w OPISACH poprawione** przez `cleanDescription`. Zakaz z ustaleń dotyczył j.m.
   (gdzie słownik literówek to decyzja na ślepo), nie opisów; sprawdzone empirycznie, że
   na 946 wierszach nie ruszyło to ani jednego klucza.

Przegląd katalogu przez właściciela trwa (liczba pozycji spadła 946 → 940 w trakcie bramki);
wgranie na produkcję opisuje EX-763 — robi to człowiek.
