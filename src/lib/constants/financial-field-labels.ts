// The tile labels the investment header matches on to pick a figure out of the field list — shared
// so the consumer reads the same string the field builder writes.

// Material spend not attributed to any expense category — in practice legacy corrections
// entered before the category became required. It counts toward totalMaterialCosts, so it
// MUST surface as its own row wherever the category split is shown, or the sum drifts below
// the listing's bilans.
export const CORRECTION_LABEL = 'Korekta (bez kategorii)'

export const LABOR_LABEL = 'Robocizna netto'
export const DISCOUNT_LABEL = 'Rabat netto'
export const INCOME_LABEL = 'Wpłaty'
export const MATERIALS_DISCOUNT_LABEL = 'Obniżka materiałów'
export const LOSS_LABEL = 'Strata'
