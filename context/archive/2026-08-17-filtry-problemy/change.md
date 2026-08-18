---
change_id: filtry-problemy
title: Grupa „Problemy" w menu Filtry — diagnostyki pozycji i etapów pod jednym trójkątem
status: archived
created: 2026-08-17
updated: 2026-08-18
archived_at: 2026-08-18T16:37:36Z
branch: filtry-problemy
worktree: null
---

## Notes

przenieś diagnostyki „bez ceny j.m." i „z pomiarem do rozpisania na etapy" do menu Filtry pod nagłówek „Problemy", dodaj filtry etapów bez wykonawcy i bez sposobu rozliczenia, warning triangle na przycisku Filtry gdy problem występuje

Uzgodnione w rozmowie 2026-08-17:

- Wiersze w grupie czytają się rozkazem („Pokaż pozycje bez ceny j.m. (9)"), bo ptaszek znaczy tam
  co innego niż w filtrach powyżej — filtr odznaczony chowa, diagnostyka włączona zostawia wyłącznie
  swoje trafienia.
- Grupa i każdy jej wiersz pokazują się **warunkowo** — tylko gdy licznik > 0.
- Trójkąt ostrzegawczy na przycisku „Filtry" zapala się, gdy **problem występuje w danych**, nie gdy
  filtr jest włączony.
- Dwa nowe filtry dotyczą **etapów**, nie pozycji (brak wykonawcy / brak sposobu rozliczenia) — to
  inny podmiot niż wszystko, co dziś jest w rejestrze warunków, i główna niewiadoma do rozstrzygnięcia
  w planie.
- Trzeci nowy filtr: pozycje, na których cena wykonawcy jest odrzucana przez tę samą regułę, która
  dziś czerwieni komórkę (`checkSubcontractorPrice`). Uwaga na sformułowanie — reguła mówi
  „cena wykonawcy nie może **przekroczyć** 80% ceny klienta" (plus zakaz ceny ujemnej), czyli od
  strony firmy: marża spada poniżej 20%. Do rozstrzygnięcia: reguła jest **per plan**
  (z narzędziami / bez narzędzi), więc czy licznik patrzy na aktywny widok, czy na oba naraz, i co
  z tym wierszem w widoku klienta, gdzie ceny wykonawcy w ogóle nie ma.
  Rozstrzygnięte w rundzie pytań 2026-08-17 — grupa „Problemy" liczy **sześć** wierszy:

1. bez ceny j.m.
2. z pomiarem do rozpisania na etapy
3. z zawyżoną ceną wykonawcy — z narzędziami
4. z zawyżoną ceną wykonawcy — bez narzędzi
5. etapy bez wybranego sposobu rozliczenia
6. etapy bez przypisanego wykonawcy

- **Filtry etapowe realnie chowają kolumny etapów** (zostają wyłącznie wadliwe), nie tylko liczą.
  Zakaz z `stage-keys.ts` dotyczy **zapamiętywanej** widoczności (recykling id przez Postgresa);
  filtr jest stanem ulotnym, więc go nie narusza. Precedens: kolumna „Pozostało do rozliczenia"
  wchodzi wyłącznie przy włączonej swojej diagnostyce.
- **Cena wykonawcy: dwa osobne wiersze, po jednym na plan**, liczone niezależnie od aktywnego
  widoku cen — problem ma być widoczny także wtedy, gdy patrzysz na drugi plan lub na widok klienta.
  Warunek to ten sam, który czerwieni komórkę: cena wykonawcy **przekracza** 80% ceny klienta
  (przed rabatem) albo jest ujemna.
- **Trójkąt zapala każdy z sześciu problemów**, praca do rozpisania włącznie (owner, wprost).
- **Licznik przy „Filtry" obejmuje od teraz włączone problemy** — po schowaniu przycisków do menu
  nic innego nie sygnalizuje, że filtr problemu jest włączony.
- **Liczymy niezależnie, bez odejmowania nakładek**: etap bez sposobu rozliczenia z definicji nie ma
  też wykonawcy, więc trafia do obu wierszy. Świadoma decyzja — każdy wiersz mówi dosłownie to, co
  jest w nim napisane.
- **„Pozostało do rozliczenia" bez zmian (faza 1–3)** — kolumna nadal wchodzi wyłącznie razem ze swoim filtrem,
  tyle że filtr jest teraz w menu. Żadnego drugiego przełącznika w wyborze kolumn.

## Faza 4 — problem odsłania swoją kolumnę (uzgodnione 2026-08-17, po fazach 1–3)

- **Włączony problem wpuszcza kolumnę, której dotyczy, mimo odznaczonego ptaszka w wyborze kolumn**;
  wyłączony oddaje ją tam, gdzie ją zostawił użytkownik. Stan ulotny — nic nie trafia do
  zapamiętywanej widoczności, ten sam argument co przy zawężaniu kolumn etapów.
- Mapa problem → odsłaniane kolumny:
  1. bez ceny j.m. → Cena j.m. + Źródło ceny wykonawcy + Mnożnik
  2. nieprawidłowa cena wykonawcy (oba plany) → Cena j.m. + Źródło ceny wykonawcy + Mnożnik
  3. etapy bez sposobu rozliczenia / bez wykonawcy → nic; już zawężają kolumny etapów
  4. z pomiarem do rozpisania na etapy → bez zmian, patrz niżej
- **Źródło ceny wykonawcy i Mnożnik wchodzą razem z ceną** (owner, wprost): bez nich widać objaw,
  ale nie ma czym go poprawić — to one wyliczają stawkę. **Dotyczy tak samo „bez ceny j.m."**
  (owner, 2026-08-17): stawki wykonawcy wyliczają się z ceny j.m., więc pozycja bez niej nie ma też
  stawek — komplet trzech kolumn jest ten sam, niezależnie od tego, co czytający zauważył pierwsze.
- **„Cena j.m." i „cena wykonawcy" to jeden i ten sam wpis w wyborze kolumn** — w widoku inwestora
  trzyma cenę dla inwestora, w widoku wykonawcy stawkę wykonawcy. Trzy problemy cenowe celują więc
  w to samo; nie ma trzech reguł.
- Odsłanianie bije **wyłącznie ptaszek z wyboru kolumn** — nigdy osi kwot, warstwy ani widoku
  klienta. Kolumna ceny i tak jest spod osi Netto/Brutto wyjęta, więc pytanie „a co z brutto" nie
  powstaje.
- **„Pozostało do rozliczenia" zostaje po staremu** — jest bramkowana przy składaniu kolumn, nie
  przy ptaszku, bo z wyłączonym filtrem świeciłaby „—" przez prawie każdy wiersz. To mocniejsza
  reguła, nie ta sama.
- **Widok nazwany w etykiecie, bez samoprzełączania**: „w widoku z narzędziami" zamiast „—
  z narzędziami". Glif planu przy wierszu był próbowany i **wycofany** (owner, 2026-08-17): mają go
  tylko wiersze cenowe, więc lista wyglądała jak dwa różne rodzaje rzeczy zamiast jednej; widok
  nazywają same słowa.
- **Świadomie przyjęta konsekwencja**: włączony spod widoku inwestora problem cenowy zawęzi pozycje,
  ale w odsłoniętej kolumnie będzie cena dla inwestora, nie zepsuta stawka wykonawcy. To cena za
  brak przełączania widoku spod kliknięcia — decyzja, nie przeoczenie.
- **Martwy klik przyjęty świadomie**: przy włączonym problemie odznaczenie odsłoniętej kolumny nic
  nie zrobi i zadziała dopiero po wyłączeniu problemu. Ptaszek pokazuje to, co zapamiętane —
  pokazywanie go zaznaczonym byłoby kłamstwem o stanie, a wygaszenie wymagałoby trzeciego stanu,
  o który nikt nie prosił.

## Faza 5 — poprawianie problemu z wnętrza filtra, który go znalazł (2026-08-17)

Trzy usterki zgłoszone przez ownera po fazie 4; wszystkie z tego samego szwu — zawężona lista i jej
komórki były traktowane jak powierzchnia do czytania, nie do pracy.

- **Wiersz nie może zniknąć spod ręki, która go poprawia.** Warunek przestaje pasować w momencie
  poprawki, więc pierwsza cyfra ceny wyrzucała pozycję z „bez ceny j.m." — razem z Mnożnikiem, który
  ten sam filtr przed chwilą odsłonił. Zatrzask jest **tylko dodający** i kluczowany włączonym
  zestawem: dopóki trzyma, pokazana pozycja zostaje, a nowo zepsute nadal dochodzą; zmiana tego, co
  włączone, czyści go. Odrzucone: odłożenie przefiltrowania do utraty ogniska — pozycja i tak znika
  przy przejściu Tabem do sąsiedniej kolumny.
- **„Odśwież — ukryj poprawione" na górze rozwijanego menu** (owner, 2026-08-17): zatrzask musi mieć
  jawny gest zwolnienia. Wyłączanie i włączanie problemu dawało ten sam skutek bokiem i było karą za
  poprawienie czegoś; pozycja w menu jest widoczna tylko wtedy, gdy któryś problem jest włączony —
  bez zawężenia nie ma czego zwalniać.
- **Zatrzask omija wyłącznie warunki, nie wyszukiwarkę** — wyszukiwanie to pytanie zadawane teraz.
- **Cena j.m. i Mnożnik wchodzą do klawiaturowego modelu siatki.** Renderowały wiecznie żywy input,
  który ignorował flagę edycji, więc siatka nigdy nie stawiała kursora: jedno kliknięcie zaznaczało,
  drugie dopiero wchodziło, Enter nie robił nic. Ta sama cena zachowywała się inaczej w widoku
  inwestora — bo tam kolumna jest standardowa.
- **Źródło ceny wykonawcy otwiera się z klawiatury.** Lista, którą otwiera tylko klik, to komórka,
  do której klawiatura nie dociera. Lokalna flaga „otwarte kliknięciem" zostaje, bo trigger Radiksa
  odpala się tam, gdzie siatka go nie widzi — bez niej pojedynczy klik przestałby działać.

## Faza 6 — „Problemy" wychodzą z „Filtrów" (owner, 2026-08-17)

- **Własny przycisk z trójkątem, nie grupa w „Filtrach".** To nie jest to samo pytanie: filtr mówi,
  co czytający chce widzieć, problem mówi, na co kosztorys czeka. Schowany w „Filtrach" był
  ostrzeżeniem za zamkniętym menu, jeden nagłówek w głąb listy o czymś innym.
- **Przycisk istnieje tylko wtedy, gdy jest co pokazać.** Stałe „Problemy (0)" byłoby chromem do
  pominięcia; przycisk, który się pojawia, **jest** alarmem — stąd trójkąt i destrukcyjny ton zamiast
  neutralnej ikony z licznikiem. Kropka mówi, że jeden jest włączony, a nie ile ich jest.
- **Pojedynczy wybór** (owner: „inaczej on nie ma sensu"): odkąd problem zawęża wiersze i odsłania
  swoje kolumny, dwa naraz pokazywały sumę dwóch niepowiązanych zbiorów i nic na ekranie nie mówiło,
  który wiersz należy do którego. Kliknięcie włączonego gasi go; nie ma wiersza „wszystkie problemy",
  bo suma to dokładnie to, co tu nie ma sensu.
- **Ostateczne brzmienie dwóch wierszy cenowych: „ze zbyt wysoką stawką wykonawcy w widoku …"**
  (owner, 2026-08-17). Wcześniejsze „z nieprawidłową" było zbierackie i nie mówiło nic o kierunku;
  reguła zapala się na stawce **powyżej** 80% ceny dla inwestora. Druga gałąź reguły — stawka ujemna —
  zostaje bez nazwy: to literówka, a nie stan kosztorysu, i nie warta odbierania etykiecie
  jednoznaczności.
- **Trigger to wspólny `FilterTriggerButton`, nie własny przycisk** — ta sama składnia „(n)" co
  „Filtry" i filtry po stronie transferów, plus wariant `destructive` dodany do wspólnego komponentu
  (obrys czerwony wyłączony / wypełnienie włączony). Kropka „coś jest włączone" wypadła: przy
  czerwonym przycisku z trójkątem czytała się jak drugie ostrzeżenie, a nie jak stan filtra.
- **Wyłączność jest nazwana grupą, nie globalna** — jeden magazyn trzyma oba rodzaje, a wyłączność
  omiatająca wszystko odznaczyłaby też „Prace".
- „Filtry" tracą trójkąt, grupę problemów i problemy z licznika — liczą tylko to, co same chowają.

## Faza 7 — wybrany problem przenosi do swojego widoku (owner, 2026-08-17)

- **Możliwe dopiero przy pojedynczym wyborze**: przy dwóch włączonych nie istniało „ten" widok.
  Zdejmuje to świadomie przyjętą wadę fazy 4 — zawężenie spod „Inwestora" pokazywało właściwe pozycje
  z ceną dla inwestora w kolumnie, którą problem przed chwilą odsłonił.
- **Nakładka ulotna, nigdy zapis** — dokładnie ta sama reguła co przy odsłanianiu kolumn: wyłączenie
  problemu przywraca widok, w którym pracowałeś, a po odświeżeniu strony wraca widok zapamiętany.
- **Przenoszą cztery wiersze**: zbyt wysoka stawka ×2 i brak stawki wykonawcy ×2. Plan jest już zapisany
  przy warunku, więc nie ma drugiej mapki, która mogłaby się rozjechać.
- **„Bez ceny j.m." nie rusza widoku** (owner): cenę wpisuje się u inwestora, ale naprawia się ją
  w kolumnach, które składają się tylko u wykonawcy — nie ma jednego właściwego widoku. Tak samo
  „z pomiarem do rozpisania" i oba etapowe.
- **Ręczne przełączenie widoku wygrywa** (owner): zdejmuje nakładkę, problem zostaje włączony.
  Blokada albo odbijanie z powrotem robiłyby z najbardziej widocznego przełącznika martwy klik.
- **Liczniki obu planów zostają niezależne od widoku** — menu odpowiada „gdzie jest zepsute", a dopiero
  kliknięcie tam zabiera. Liczenie „w aktywnym widoku" ukrywałoby problem na drugim planie.
