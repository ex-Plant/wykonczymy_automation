import type { InvestmentFinancialsT } from '@/types/investment-financials'

// Bilans inwestora (investor balance) = income - material costs - labor costs + rabat.
// Material costs already include corrections (negative corrections reduce costs).
// A rabat is a labour discount: the client owes less, so it RAISES the balance.
// The materiały netto discount is the same shape on the materiały side — the client is billed the
// netto price rather than the brutto receipt, so it RAISES the balance too (and lowers marża).
export function calculateBalance(financials: InvestmentFinancialsT) {
  const totalCosts = financials.totalMaterialCosts + financials.totalLaborCosts
  return (
    financials.totalIncome - totalCosts + financials.totalRabat + financials.materialsNetDiscount
  )
}
