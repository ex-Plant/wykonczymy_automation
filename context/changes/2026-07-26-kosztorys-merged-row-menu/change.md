---
change_id: kosztorys-merged-row-menu
title: Merge the section and row action menus back into one two-group menu
status: implemented
created: 2026-07-26
updated: 2026-07-26
archived_at: null
branch: null
worktree: null
---

## Notes

Scal ⋯ sekcji i ⋯ wiersza w jedno menu z dwiema grupami — „Praca" i „Sekcja".

Reverts the menu split introduced by `7af257b2` (EX-580 p4, "move section actions onto the band").
That commit created `kosztorys-section-actions-menu.tsx` and stripped the `section` group out of
`kosztorys-row-actions-menu.tsx`, leaving two ⋯ triggers in the same sticky „Akcje" column that
repeat the same four order commands with no cue as to their target.

Shape agreed with the owner (2026-07-26):

- One ⋯ per item row, carrying both groups separated by a `DropdownMenuSeparator` — the pre-p4
  shape, with the current singular labels „Praca" / „Sekcja".
- The band's `slot === 'actions'` goes back to a blank cell; `kosztorys-section-actions-menu.tsx`
  is deleted. Inline rename, the colour dot and the band figures stay — only the ⋯ leaves the band.
- Accepted trade-off (owner: "rozwiń żeby działać"): a **collapsed** section renders only its band,
  so its own commands are unreachable until it is expanded. No band-level fallback menu.
- `column-config.ts` unchanged — the band still carries section identity, so „Sekcja" stays hidden
  by default.
