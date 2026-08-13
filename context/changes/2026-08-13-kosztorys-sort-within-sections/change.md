---
change_id: kosztorys-sort-within-sections
title: Sortowanie pozycji wewnątrz sekcji — widok + trwały zapis kolejności
status: new
created: 2026-08-13
updated: 2026-08-13
archived_at: null
branch: null
worktree: null
---

## Notes

Dwie części, w tej kolejności:

- **EX-682** — sortowanie kolumny działa wewnątrz każdej sekcji (widok), pasy sekcji przeżywają
  sortowanie. Dziś `sortRows` leci po całym płaskim zbiorze i dlatego
  `kosztorys-editor-body.tsx` wyłącza pasy (`enabled: sort == null`).
- **EX-683** — trwałe „Posortuj alfabetycznie": przenumerowanie `display_order` w obrębie sekcji,
  z undo, żeby kolejność przeżyła reload / eksport oferty / sync arkusza.

Do rozstrzygnięcia w planie: czy trwała akcja utrwala **bieżące sortowanie widoku**, czy jest
osobnym „alfabetycznie po opisie"; oraz co robić z ▲▼ / wstawianiem przy aktywnym sortowaniu.
