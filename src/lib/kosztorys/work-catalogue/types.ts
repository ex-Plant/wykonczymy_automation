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
