'use client'

import { StatButton } from '@/components/ui/stat-button'
import { SaldoDisplay } from '@/components/ui/saldo-display'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { formatPLN } from '@/lib/utils/format-currency'

const RESTRICTED_NOTE = '\nWidoczność — właściciel'
const TOOLTIPS = {
  loss: 'Koszt pokrywany przez firmę. Obniża marżę. Nie wchodzi do bilansu inwestora.',
  materialsNetDiscount:
    'Wydatki rozliczane po kwocie netto zamiast po kwocie z paragonu.\n' +
    'Obniża marżę i podnosi bilans inwestora — inwestor płaci mniej.',
  margin:
    'Marża = Robocizna − Wypłaty − Rabat − Strata − materiały wliczone w robociznę − obniżka materiałów.\n' +
    'Ile firma zarabia na inwestycji.' +
    RESTRICTED_NOTE,
} as const

type PropsT = {
  // Computed server-side via calculateMargin(financials) — never re-derived here, so listing and
  // detail can't drift on marża.
  margin: number
  totalLoss: number
  // What billing materiały netto gives away — already inside `margin`. Shown so a figure that lowers
  // marża is readable rather than silent. 0 (no rate saved, or a brutto-settled investment) hides it.
  materialsNetDiscount: number
}

// Company-plane figures, kept OUTSIDE the summary panel: the panel renders the client settlement, and
// a gating mistake inside it must never be able to leak marża to a client. The whole strip is gated,
// not just marża — nothing here is the investor's business.
// Wypłaty are deliberately absent: the panel's „Podwykonawcy" view already carries them, and so are
// the settled-material tiles — the panel's „Wydatki" view now carries that split as its own table.
export function InvestmentOwnerFigures({ margin, totalLoss, materialsNetDiscount }: PropsT) {
  const { role: userRole } = useCurrentUser()
  if (!isAdminOrOwnerRole(userRole)) return null

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
      <SaldoDisplay saldo={margin} label="Marża" tooltip={TOOLTIPS.margin} />
      {materialsNetDiscount !== 0 && (
        <StatButton
          label="Obniżka materiałów"
          value={formatPLN(materialsNetDiscount)}
          className="border-chart-purple"
          tooltip={TOOLTIPS.materialsNetDiscount}
        />
      )}
      {totalLoss !== 0 && (
        <StatButton
          label="Strata"
          value={formatPLN(totalLoss)}
          className="border-chart-purple"
          tooltip={TOOLTIPS.loss}
        />
      )}
    </div>
  )
}
