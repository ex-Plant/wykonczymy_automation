// The catalogue row as every reader sees it. Both stawki are frozen ZŁOTÓWKI, never współczynniki:
// a coefficient would silently re-price the praca against the target investment's global coeffs the
// moment it left the katalog, so the number the owner saw when saving would not be the number the
// rozpiska got.
export type WorkCatalogueItemT = {
  id: number
  description: string
  category: string | null
  unit: string
  clientPrice: number
  wToolsRate: number
  ownToolsRate: number
  matchKey: string
}

// One catalogue row as the seed proposes it — the shape minus the id the database mints.
export type CatalogueSeedItemT = Omit<WorkCatalogueItemT, 'id'>

// One occurrence of a klucz inside the szablon, kept only so a rozbieżność can be shown with the
// sekcja it came from — the owner recognises „Łazienka 1 mówi 300 zł" and nothing else.
export type SeedOccurrenceT = {
  sectionName: string
  clientPrice: number
  wToolsRate: number
  ownToolsRate: number
}

// Which of the three liczby a rozbieżność is about — the cennik diverges on the stawki far more
// often than on the „Cena j.m.", and the two mean different things to the owner.
export type SeedConflictFieldT = 'clientPrice' | 'wToolsRate' | 'ownToolsRate'

// A klucz whose occurrences do not agree on all three liczby. Reported, never resolved by hand:
// the winner rule already picked, this only says the pick was not unanimous.
export type SeedConflictT = {
  matchKey: string
  description: string
  fields: SeedConflictFieldT[]
  occurrences: SeedOccurrenceT[]
}
