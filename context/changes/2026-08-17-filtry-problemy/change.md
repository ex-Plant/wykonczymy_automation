---
change_id: filtry-problemy
title: Grupa „Problemy" w menu Filtry — diagnostyki pozycji i etapów pod jednym trójkątem
status: implementing
created: 2026-08-17
updated: 2026-08-17
archived_at: null
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
  1. bez ceny j.m. → Cena j.m.
  2. nieprawidłowa cena wykonawcy (oba plany) → Cena j.m. + Źródło ceny wykonawcy + Mnożnik
  3. etapy bez sposobu rozliczenia / bez wykonawcy → nic; już zawężają kolumny etapów
  4. z pomiarem do rozpisania na etapy → bez zmian, patrz niżej
- **Źródło ceny wykonawcy i Mnożnik wchodzą razem z ceną** (owner, wprost): bez nich widać objaw,
  ale nie ma czym go poprawić — to one wyliczają stawkę.
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
  z narzędziami", plus glif planu przy wierszu — ten sam, którego używa przełącznik widoków
  i nagłówek etapu.
- **Świadomie przyjęta konsekwencja**: włączony spod widoku inwestora problem cenowy zawęzi pozycje,
  ale w odsłoniętej kolumnie będzie cena dla inwestora, nie zepsuta stawka wykonawcy. To cena za
  brak przełączania widoku spod kliknięcia — decyzja, nie przeoczenie.
- **Martwy klik przyjęty świadomie**: przy włączonym problemie odznaczenie odsłoniętej kolumny nic
  nie zrobi i zadziała dopiero po wyłączeniu problemu. Ptaszek pokazuje to, co zapamiętane —
  pokazywanie go zaznaczonym byłoby kłamstwem o stanie, a wygaszenie wymagałoby trzeciego stanu,
  o który nikt nie prosił.
