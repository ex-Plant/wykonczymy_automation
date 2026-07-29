// Money arrives here as float products (qty × price, with fractional plane coefficients), so a figure
// the UI renders „435,00" can hold a −5.7e-14 residue. Round before COMPARING two such figures, or a
// paid-in-full settlement reads as an overpayment. Never round mid-calculation — only at the seam
// where a number becomes a decision or a displayed total.
// `+ 0` collapses the negative zero `Math.round` hands back for a tiny negative residue, so callers
// comparing or serialising the result never meet a -0 (`formatNet` guards its own output for the
// same reason).
export const roundToCents = (amount: number) => Math.round(amount * 100) / 100 + 0
