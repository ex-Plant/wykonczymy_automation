import type { InvestmentFinancialsT } from '@/types/investment-financials'

// Bilans inwestora = income - material costs - labor costs + rabat + loss.
// Material costs already include corrections (negative corrections reduce costs).
// A rabat is a labour discount: the client owes less, so it RAISES the balance.
// The materiały netto discount is the same shape on the materiały side — the client is billed the
// netto price rather than the brutto receipt, so it RAISES the balance too (and lowers marża).
// A loss is the cost the company absorbed instead of charging it on, so it raises the balance the
// same way — but at FACE VALUE (EX-675): the amount entered is the amount the client stops paying,
// identically in netto and in brutto, so it never widens the VAT base in `grossBalance`.
export function calculateBalance(financials: InvestmentFinancialsT) {
  const totalCosts = financials.totalMaterialCosts + financials.totalLaborCosts
  return (
    financials.totalIncome -
    totalCosts +
    financials.totalDiscount +
    financials.materialsNetDiscount +
    financials.totalLoss
  )
}
