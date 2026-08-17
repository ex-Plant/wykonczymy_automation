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
- **„Pozostało do rozliczenia" bez zmian** — kolumna nadal wchodzi wyłącznie razem ze swoim filtrem,
  tyle że filtr jest teraz w menu. Żadnego drugiego przełącznika w wyborze kolumn.
