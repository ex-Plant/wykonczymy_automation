---
change_id: add-item-section-picker
title: Wybór sekcji przed dodaniem pracy z menu „Dodaj"
status: implemented
created: 2026-08-31
updated: 2026-08-31
archived_at: null
branch: null
worktree: null
---

## Notes

Dziś „Dodaj → Praca" zgaduje sekcję docelową: jeśli dokładnie jedna sekcja jest rozwinięta,
praca ląduje w niej, w przeciwnym razie w OSTATNIEJ sekcji rozpiski
(`toolbar/menus/kosztorys-add-menu.tsx`). To zaskakuje — przy dwóch rozwiniętych sekcjach
wybór wraca do ostatniej, nie do tej, na którą użytkownik patrzy.

Ustalenia z rozmowy (2026-08-31):

1. Forma: podmenu w istniejącym `DropdownMenu` („Praca ▸ lista sekcji"), spójne ze stylem
   pozostałych pozycji menu — bez nowego dialogu.
2. Heurystyka „ostatnia / jedyna rozwinięta" znika całkowicie — żadnego domyślnego wyboru,
   sekcję zawsze wskazuje użytkownik.
3. Zakres: tylko „Praca". „Sekcja", „Sekcja z szablonu…" i etapy zostają bez zmian — tam
   dopisanie na koniec nie jest zaskakujące.
4. Pusta rozpiska (po weryfikacji w przeglądarce): podmenu w ogóle się nie renderuje, a „Praca"
   zakłada pierwszą sekcję razem z pozycją w środku (`handleAddSection`). Wcześniejszy pomysł
   „wyzwalacz wyszarzony" upadł — strzałka podmenu rysowała się nadal i sugerowała wybór, którego
   nie było.

Poza zakresem (zgłoszone, nierozstrzygnięte): przy aktywnym sortowaniu kolumny nowy wiersz
wchodzi w widoku w innym miejscu niż zapisuje go serwer — `handleInsertItem` ma na to
blokadę (`if (sort) return`), `handleAddItem` nie.
