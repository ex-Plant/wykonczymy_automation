---
change_id: kosztorys-sort-within-sections
title: Sortowanie pozycji wewnątrz sekcji — widok + trwały zapis kolejności
status: archived
created: 2026-08-13
updated: 2026-08-15
archived_at: 2026-08-15T08:14:09Z
branch: konradantonik/ex-682-sort-within-sections
worktree: .claude/worktrees/kosztorys-sort-within-sections
---

## Notes

Dwie części, w tej kolejności:

- **EX-682** — sortowanie kolumny działa wewnątrz każdej sekcji (widok), pasy sekcji przeżywają
  sortowanie. Dziś `sortRows` leci po całym płaskim zbiorze i dlatego
  `kosztorys-editor-body.tsx` wyłącza pasy (`enabled: sort == null`).
- **EX-683** — trwałe „Posortuj alfabetycznie": przenumerowanie `display_order` w obrębie sekcji,
  z undo, żeby kolejność przeżyła reload / eksport oferty / sync arkusza.

Rozstrzygnięte przy planowaniu: trwała akcja utrwala **bieżące sortowanie widoku** (alfabetycznie =
posortuj po „Opis" i utrwal), zasięg = jedna sekcja z jej menu, ▲▼ i wstawianie zostają wyłączone
przy aktywnym sortowaniu.
