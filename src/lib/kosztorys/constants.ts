import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

// Which pair of row fields a subcontractor plane's override writes to — „Mnożnik", „Cena j.m." and
// „Źródło" are three columns over one field pair, and every one of them has to agree on which.
export const OVERRIDE_FIELDS: Record<
  ToolPlaneT,
  { type: keyof ViewPricingT; value: keyof ViewPricingT }
> = {
  w_tools: { type: 'wToolsOverrideType', value: 'wToolsOverrideValue' },
  own_tools: { type: 'ownToolsOverrideType', value: 'ownToolsOverrideValue' },
}

// Array order is the pickers' display order.
export const TOOL_PLANES = ['w_tools', 'own_tools'] as const satisfies readonly ToolPlaneT[]

export const PLANE_LABELS: Record<ToolPlaneT, string> = {
  w_tools: 'Z narzędziami',
  own_tools: 'Bez narzędzi',
}

// Default subcontractor markup coefficients for an investment — the single source for both the
// Payload column `defaultValue` (src/collections/investments.ts) and the query fallback
// (src/lib/queries/kosztorys.ts). A section or item may override them.
export const DEFAULT_COEFFS = { wTools: 0.65, ownTools: 0.55 } as const

// Default VAT rate for an investment without one, stored as a fraction (0.08 = 8%) — the single
// source for both the Payload column `defaultValue` (src/collections/investments.ts) and the query
// fallback (src/lib/queries/kosztorys.ts). Prices are netto; brutto = net × (1 + vatRate).
export const DEFAULT_VAT = 0.08

// Unit (j.m.) combobox: suggestions cover ~97% of the real data; the cell stays creatable, so any
// custom unit is still enterable. DEFAULT_UNIT pre-fills every new item so no row lands blank.
export const UNIT_SUGGESTIONS = ['m²', 'szt', 'mb', 'kpl', 'pkt'] as const
export const DEFAULT_UNIT = 'szt'

// Placeholder description pre-filled on every new position so a fresh row reads as an item to rename
// rather than a blank line. Persisted server-side (add/insert actions) and mirrored optimistically.
export const DEFAULT_ITEM_DESCRIPTION = 'Nowa praca'

// Default values for a new section — the single source. addSectionAction and the empty-editor seed
// import these for the server-side create; the optimistic row is built from them client-side.
export const NEW_SECTION_DEFAULTS = {
  name: 'Nowa sekcja',
  defaultCostVariant: 'w_tools',
} as const satisfies { name: string; defaultCostVariant: ToolPlaneT }

// The grid's identity column. Every synthetic row (the „Razem" band and both section bands) puts its
// caption here instead of a figure, so the three cells must agree on which column that is.
export const IDENTITY_COLUMN_ID = 'description'
