# Plan Brief: Kosztorys filters made visible and extended

**Change**: `2026-08-18-kosztorys-filters-visible-and-extended` · **Plan**: `plan.md` · Linear: EX-713, EX-714 (replacing cancelled EX-693)

## What we're building

The kosztorys editor can hide rows four ways — search, filter conditions, an engaged problem, collapsed
sections — and today none of them is legible without opening a menu. Two changes:

1. **A chip bar** under the toolbar naming every source currently hiding rows, each removable in one
   click, plus „Wyczyść wszystko" (EX-713).
2. **Three new complementary condition pairs** in the registry — rabat, źródło stawki wykonawcy,
   komentarz (EX-714).

## Phases

| #   | Phase                                     | Shape                                                                                                                                                                                                                           |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Three new condition pairs in the registry | Pure logic — `row-conditions.ts` + a guard so `foldableSectionIds` skips conditions that can't fold a section + a plane gate so the „Prace" list stays ~8-10 rows instead of 12                                                 |
| 2   | The active-filter chip bar                | New `FilterChip` primitive, a pure `active-filters-model.ts`, the bar itself as a second line in the toolbar, an on-demand grid re-measure, fold suppression equalized with search, `resetFilters` widened to also clear search |

## The three decisions that shape it

- **Fold suppression gets equalized with Szukaj.** The archived first instalment recorded "an active
  item filter suppresses folding" as a rule, but only search actually does it. Invisible today; the
  chip bar puts both states on screen and makes it a visible lie.
- **„Wyczyść wszystko" clears everything the bar shows** — conditions, problem, sections, search — but
  not sort, which hides nothing. This widens the existing „Zresetuj filtry" and the empty-state reset.
- **Chips coexist with the trigger counters.** The counts on „Filtry" / „Problemy" stay.

## The trap

`useElementHeight` measures the grid on mount and on window resize only — **no ResizeObserver, on
purpose** (one looped with react-datasheet-grid's own resize detector). A chip bar appearing above the
grid moves `rect.top` without either trigger, so the grid silently keeps a too-tall height and its
bottom rows get clipped. Phase 2 owes an explicit, state-driven re-measure — and that is also why the
bar is one line with horizontal scroll rather than wrapping: a wrapping bar would re-measure the grid
every Nth chip.

## Dropped during planning

**Value filters (wykonawca / etap)** — on merit, not cost. One etap carries exactly one wykonawca, so
the stage column already IS the crew axis; and for the commonest job on that screen, typing a crew's
weekly progress, "rows where crew X has qty > 0" hides precisely the rows where the new quantity goes.
No issue filed. **Saved filter views** remain out of scope and unfiled.

## Next

```
/10x-implement kosztorys-filters-visible-and-extended
```
