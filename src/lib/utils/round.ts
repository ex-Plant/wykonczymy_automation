// Six places is what the editor's own coefficient field stores (`subcontractor-price-edit`), so a
// derived coefficient survives a round-trip through it unchanged.
export const round6 = (value: number): number => Math.round(value * 1e6) / 1e6
