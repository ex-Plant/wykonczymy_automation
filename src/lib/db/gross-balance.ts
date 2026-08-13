/** The investor balance carried onto the brutto plane. Negative means the client owes, so the VAT —
 *  another charge on them — DEDUCTS. It rides the prace alone, and on the prace net of the rabat: a
 *  discounted złoty was never billed, so it never carried VAT. The rabat is already inside `balance`
 *  (`calculateBalance` adds it back), which is why it has to come off the VAT base separately here.
 *  A strata is NOT a term of that base — it is face value on both planes (EX-675), so it reaches
 *  this reading through `balance` alone. Lives beside `calculate-balance.ts`, whose terms it reuses —
 *  it names no kosztorys concept and had no business sitting in the kosztorys layer. */
export function grossBalance(
  balance: number,
  vatRate: number,
  totalLaborCosts: number,
  totalRabat: number,
): number {
  return balance - vatRate * (totalLaborCosts - totalRabat)
}
