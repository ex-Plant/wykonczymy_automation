---
change_id: sheet-column-mapping
title: Ręczne przypisanie kolumn arkusza i czytelne komunikaty, gdy import odmówi
status: implemented
created: 2026-08-14
updated: 2026-08-14
archived_at: null
branch: ex-690-sheet-column-mapping
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

Kolizja z `footer-totals.ts` / `build-sheet-comparison.ts` / `resolve-rates.ts` jest już nieaktualna —
tamta sesja skończyła i wszystko jest na staging.

Druga część zmiany (dopisana 2026-08-14, po rozszerzeniu EX-690): **komunikaty o dostępie do
arkusza**. Dziś każda porażka odczytu — brak udostępnienia kontu serwisowemu, martwy identyfikator,
realna awaria Google — wychodzi jako „Nie udało się odczytać arkusza Google. Spróbuj ponownie za
chwilę." (`sheetFailureMessage` w `src/lib/actions/kosztorys-import.ts`). Przy braku dostępu to rada,
która nigdy nie zadziała: arkusz trzeba udostępnić. Do tego brak zakładki `kosztorys_robocizny`
podpowiada „Popraw nagłówki w arkuszu", choć nagłówki nie mają z tym nic wspólnego.

Ta część idzie razem z pierwszą, bo wychodzi w tym samym dialogu i dotyka tej samej ścieżki odczytu —
oba przypadki to „import odmówił i właściciel nie wie, co zrobić dalej".
