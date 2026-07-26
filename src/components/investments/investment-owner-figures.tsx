'use client'

import { StatButton } from '@/components/ui/stat-button'
import { SaldoDisplay } from '@/components/ui/saldo-display'
import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { SETTLED_TYPE } from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/utils/format-currency'
import type { FinancialFieldT } from '@/types/export'

const RESTRICTED_NOTE = '\nWidoczność — właściciel'
const TOOLTIPS = {
  loss: 'Koszt pokrywany przez firmę. Obniża marżę. Nie wchodzi do bilansu inwestora.',
  settledMaterials:
    'Materiały kupione przez firmę, wliczone w robociznę. ' +
    'Obniżają marżę, ale nie obciążają bilansu inwestora.',
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
  settledFields: FinancialFieldT[]
}

// Company-plane figures, kept OUTSIDE the summary panel: the panel renders the client settlement, and
// a gating mistake inside it must never be able to leak marża to a client. The whole strip is gated,
// not just marża — nothing here is the investor's business.
// Wypłaty are deliberately absent: the panel's „Podwykonawcy" view already carries them.
export function InvestmentOwnerFigures({ margin, totalLoss, settledFields }: PropsT) {
  const { role: userRole } = useCurrentUser()
  if (!isAdminOrOwnerRole(userRole)) return null

  return (
    <div className="text-muted-foreground space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
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

      {settledFields.length > 0 && (
        <div className="space-y-1">
          <Description>
            {SETTLED_TYPE.label}
            <InfoTooltip
              content={TOOLTIPS.settledMaterials}
              label={`Co to jest: ${SETTLED_TYPE.label}`}
              className="ml-1"
            />
          </Description>
          <div className="flex flex-wrap items-center gap-2">
            {settledFields.map((field) => (
              <StatButton
                key={field.label}
                label={field.label}
                value={field.value}
                color={SETTLED_TYPE.color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
