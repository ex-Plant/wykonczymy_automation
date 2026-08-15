---
change_id: kosztorys-column-order
title: User-defined column order in the kosztorys editor
status: implemented
created: 2026-08-15
updated: 2026-08-15
archived_at: null
branch: ex-692-kosztorys-column-order
worktree: null
---

## Notes

Linear: **EX-692** (In Progress).

Przycisk „Ustaw kolejność kolumn…" w `kosztorys-view-menu` otwiera modal z drag-n-drop
(framer-motion `Reorder`) nad grupami z `toggleKey`; sparse `id → rank` w localStorage; sort
w `selectV2Columns`; współdzielony `ColumnToggleMenu` (5 tabel TanStack) nietknięty.

Ustalenia z rozmowy przed planem:

- Kolejność kolumn = kolejność tablicy `columns` — `react-datasheet-grid` nie ma własnego API
  reorderu, więc cały mechanizm jest nasz.
- Jednostką reorderu jest grupa z `toggleKey()`, nie surowe id: kolumny etapów mają dynamiczne id
  (`stage_<id>`, `stageValueNet_<id>`, …) i muszą się przenosić blokiem. To ta sama przestrzeń
  kluczy, którą już zwraca `columnToggleItems` (zdeduplikowana, z labelami, w kolejności gridu).
- Widoczny zbiór ≠ pełny zbiór (osie/warstwa/widok/ukryte filtrują), więc drop „między dwoma
  widocznymi sąsiadami" musi rozwiązać się do rangi w pełnej liście.
- Kolejność jest preferencją właściciela → nie może działać w `preview` (sort po wczesnym returnie
  `previewVisible` w `selectV2Columns`).
- Odrzucone: drag nagłówków w gridzie (kolumny są wirtualizowane poziomo — `useVirtualizer`
  `horizontal: true` w `Grid.js`; nagłówek ma już dwa gesty: trigger Radixa i uchwyt resize).
- Brak nowej zależności: `framer-motion` 12 już jest w `package.json`. W apce nie ma dziś żadnego
  sortable DnD — tylko dropzone'y plików.
- Pułapka: dialog otwierany z wnętrza Radix `DropdownMenu` musi żyć poza menu, sterowany stanem
  w toolbarze.
