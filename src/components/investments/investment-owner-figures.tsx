'use client'

import { StatButton } from '@/components/ui/stat-button'
import { SaldoDisplay } from '@/components/ui/saldo-display'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { formatPLN } from '@/lib/utils/format-currency'

const RESTRICTED_NOTE = '\nWidoczność — właściciel'
const TOOLTIPS = {
  loss: 'Koszt pokrywany przez firmę. Obniża marżę. Nie wchodzi do bilansu inwestora.',
  margin:
    'Marża = Robocizna − Wypłaty − Rabat − Strata − materiały wliczone w robociznę.\n' +
    'Ile firma zarabia na inwestycji.' +
    RESTRICTED_NOTE,
} as const

type PropsT = {
  // Computed server-side via calculateMargin(financials) — never re-derived here, so listing and
  // detail can't drift on marża.
  margin: number
  totalLoss: number
}

// Company-plane figures, kept OUTSIDE the summary panel: the panel renders the client settlement, and
// a gating mistake inside it must never be able to leak marża to a client. The whole strip is gated,
// not just marża — nothing here is the investor's business.
// Wypłaty are deliberately absent: the panel's „Podwykonawcy" view already carries them, and so are
// the settled-material tiles — the panel's „Wydatki" view now carries that split as its own table.
export function InvestmentOwnerFigures({ margin, totalLoss }: PropsT) {
  const { role: userRole } = useCurrentUser()
  if (!isAdminOrOwnerRole(userRole)) return null

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
      <SaldoDisplay saldo={margin} label="Marża" tooltip={TOOLTIPS.margin} />
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
