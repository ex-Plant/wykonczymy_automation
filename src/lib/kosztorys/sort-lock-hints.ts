import type { SortScopeT } from '@/lib/kosztorys/row-view'

// What an active sort locks in the row menu, and why. Kept out of the menu component because the
// reasoning is about the sort's scope, not about rendering: a whole-kosztorys order interleaves
// sections, and display_order only expresses position WITHIN a section, so storing it would re-file
// prace under whichever section they landed next to.

// ▲▼ and „Wstaw" have no meaning against a sorted view under either scope — but the way out differs,
// so the hint carries the scope's own advice.
export function reorderLockHint(scope: SortScopeT | null): string | undefined {
  if (scope == null) return undefined
  const escape =
    scope === 'global'
      ? 'Sortowania „w całym kosztorysie" nie da się utrwalić — posortuj „w sekcjach", jeśli chcesz zachować kolejność'
      : 'Aby zachować bieżącą kolejność, użyj „Zapisz sortowanie" w menu nagłówka sortowanej kolumny'
  return `Przyciski zablokowane — wyłącz sortowanie kolumn, aby odblokować. ${escape}`
}

// Why „Zapisz sortowanie" (either scope) is unavailable, or undefined when it can run.
export function persistOrderBlockReason(scope: SortScopeT | null): string | undefined {
  if (scope === 'section') return undefined
  return scope === 'global'
    ? 'Kolejność „w całym kosztorysie" miesza sekcje i nie da się jej zapisać — posortuj „w sekcjach"'
    : 'Najpierw posortuj kolumnę — utrwalana jest kolejność z sortowania'
}
