---
change_id: sheet-column-mapping
title: Ręczne przypisanie kolumn arkusza, gdy import ich nie rozpozna
status: new
created: 2026-08-14
updated: 2026-08-14
archived_at: null
branch: null
worktree: null
---

## Notes

Linear: **EX-690**

Import odmawia, gdy nie znajdzie kolumny wymaganej po nazwie — Żupnicza 18/73 rozbija wartość netto
na dwie kolumny („Wartość netto przedmiar" S / „Wartość netto pomiar z natury" T) i żadna nie pasuje
do dokładnego dopasowania `wartość netto`. Dostęp do arkusza działa, blok nagłówkowy odczytany, jedna
kolumna nierozpoznana — i to jest ślepy zaułek, mimo że kolumna jest fizycznie na miejscu.

Zamiast dokładać kolejne warianty nazw do matcherów: dialog ma pokazać **kolumny nieprzypisane** z
bloku nagłówkowego (litera + tekst z wiersza 1 i 3) i pozwolić wskazać właściwą dla brakującego pola.
Ten sam mechanizm obsługuje kolumny opcjonalne, które dziś po cichu wypadają (rabat, Pomiar z natury,
komentarz).

Wybór zapisujemy **per kosztorys** (wiersz `kosztoryses` = jeden arkusz klienta), bo:

- „Porównaj z arkuszem" jedzie na tym samym rezolwerze i nie ma własnego dialogu — bez zapisu ta
  funkcja zostaje zepsuta dla takiego arkusza;
- to cecha arkusza klienta, nie kliknięcia;
- `applyKosztorysImport` celowo nie przyjmuje planu od przeglądarki — mapowanie z bazy trzyma się tej
  zasady, mapowanie z klienta trzeba by walidować osobno.

Zasada domykająca (ustalona z właścicielem 2026-08-14): **zapis jest tylko awaryjny** — rezolwer
najpierw dopasowuje po nazwach jak dziś i sięga do zapisu wyłącznie dla pól, których nie rozwiązał.
Poprawiony nagłówek w arkuszu zawsze wygrywa ze starym wyborem, więc zapis nie może zapiąć złej
kolumny na siłę i nie dotyka arkuszy, które i tak działają.

Uwaga na kolizję: `footer-totals.ts` / `build-sheet-comparison.ts` / `resolve-rates.ts` przerabia
równolegle inna sesja — to one konsumują `columns.netValue`.
