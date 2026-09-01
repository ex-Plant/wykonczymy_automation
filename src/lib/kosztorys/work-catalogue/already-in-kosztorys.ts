import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// Only the two members `catalogueKey` folds — the picker has no use for the rest of a rozpiska row.
export type KosztorysItemRefT = { description: string | null; unit: string | null }

/**
 * Fold the rozpiska down to the katalog's own identity for each pozycja.
 *
 * Split from the partition below so it can be cached on the rozpiska ALONE: `catalogueKey` is
 * `foldDescription`, ~45 split/join passes per row, and the partition's other input changes on every
 * character typed into the szukajka. Folding a 1000-pozycja kosztorys per keystroke is the exact
 * trap `useSearchFilter` was already split to avoid.
 *
 * A nameless pozycja is skipped rather than folded to an empty key: the katalog cannot hold one, so
 * it could only ever match by accident.
 */
export function kosztorysCatalogueKeys(items: readonly KosztorysItemRefT[]): Set<string> {
  return new Set(
    items
      .filter((item) => item.description?.trim())
      .map((item) => catalogueKey(item.description ?? '', item.unit)),
  )
}

/**
 * Split the cennik into prace the kosztorys does not hold yet and the ones it does.
 *
 * Matched on the katalog's own `matchKey`, so „ten sam opis" means here exactly what it means in
 * „Porównaj z katalogiem" and in the UNIQUE index — a renamed rozpiska pozycja stops counting as
 * added, which is the same blind spot the comparison has and not a second rule to reason about.
 *
 * The whole kosztorys is the scope, not one sekcja: a praca already placed in another pokój is the
 * case the owner wants out of the way.
 */
export function partitionAlreadyInKosztorys(
  catalogue: readonly WorkCatalogueItemT[],
  takenKeys: ReadonlySet<string>,
): { fresh: WorkCatalogueItemT[]; alreadyAdded: WorkCatalogueItemT[] } {
  const fresh: WorkCatalogueItemT[] = []
  const alreadyAdded: WorkCatalogueItemT[] = []
  for (const item of catalogue) (takenKeys.has(item.matchKey) ? alreadyAdded : fresh).push(item)
  return { fresh, alreadyAdded }
}
