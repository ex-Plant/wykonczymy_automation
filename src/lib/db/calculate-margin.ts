// Marża (margin) = company's profit from an investment.
// Labor costs are what the investor pays the company for work.
// Payouts (PAYOUT, paid to a worker) are wages paid out — a cost, so they lower margin.
// A rabat is a discount on the labour price — the company's own cost — so it lowers margin.
// A loss (strata) is a cost the company absorbs itself — lowers margin, never touches bilans.
// Settled internal material is bought by the company but already priced into robocizna —
// it leaves the register and lowers margin, but is never billed to the client (off bilans).
// Billing materiały netto instead of at the brutto receipt is a concession off a pass-through
// cost: the client returns less than was spent, so the company eats the difference — same
// two-sided shape as a rabat (lowers margin here, raises bilans there).
// Takes the whole financials object (symmetric with calculateBalance) so no call site
// hand-passes five same-typed positional numbers that could be transposed.
import type { InvestmentFinancialsT } from '@/types/investment-financials'

export const calculateMargin = (f: InvestmentFinancialsT) =>
  f.totalLaborCosts -
  f.totalPayouts -
  f.totalRabat -
  f.totalLoss -
  f.totalSettled -
  f.materialsNetDiscount
