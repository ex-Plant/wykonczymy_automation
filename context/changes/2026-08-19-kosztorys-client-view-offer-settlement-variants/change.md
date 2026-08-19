---
change_id: kosztorys-client-view-offer-settlement-variants
title: Warianty „Oferta / Rozliczenie" w ustawieniach podglądu inwestora
status: implementing
created: 2026-08-19
updated: 2026-08-19
archived_at: null
branch: kosztorys-client-view-offer-settlement-variants
worktree: null
---

## Notes

Toggle „Oferta / Rozliczenie" w oknie „Ustawienia podglądu inwestora": osobne zestawy widocznych
kolumn per wariant, osobne domyślne firmowe per wariant, a tryb aktywny zapisywany na inwestycji —
inwestor widzi wariant, w którym inwestycja aktualnie jest.

Ustalenia z rozmowy poprzedzającej (2026-08-19):

- **Wariant to trwały tryb inwestycji, nie preset w oknie.** Inwestycja trzyma oba zestawy kolumn
  naraz plus to, który jest aktywny — przełączasz ją z oferty na rozliczenie, gdy prace ruszają, bez
  ponownego odklikiwania kolumn.
- **Przełącznik w oknie = zmiana tego, co widzi inwestor.** Jedna decyzja, nie dwie: nie ma
  „edytuję ofertę, ale pokazuję rozliczenie". Wybrany wariant jest jednocześnie edytowanym
  i (po zapisie) aktywnym.
- **Wyraźny zapis + ostrzeżenie.** Przycisk nazywa skutek wprost („Zapisz i pokaż rozliczenie"),
  a nad nim ostrzeżenie, że zapis zmienia widok inwestora — pokazywane tylko, gdy wybrany wariant
  różni się od zapisanego. Wzorzec jak przy zmianie sposobu rozliczenia materiałów: to samo okno,
  ten sam flow, bez osobnego modala potwierdzenia.
- **„Zapisz jako domyślne" dotyczy jednego wariantu** — tego wybranego — i zapisuje też domyślny
  tryb, więc nowa inwestycja startuje w ofercie.
- **Domyślne z kodu są dwa, różne.** Oferta: opis prac, przedmiar, jednostka miary, cena j.m. netto,
  wartość przedmiaru netto. Rozliczenie: pomiar, etapy, razem netto, % wykonania.
- **Brak danych do zachowania (owner, 2026-08-19).** Nikt nie odklikał jeszcze żadnego wariantu, więc
  migracja jest tępa: usuwa stare kolumny i dodaje nowe, zero backfillu.
- **Odczyt po stronie inwestora bez zmian.** `getClientViewSettings(investmentId)` dalej zwraca jeden
  płaski zestaw — rozwiązuje tylko wariant aktywny — więc podgląd i wejście po tokenie zostają
  nietknięte.
