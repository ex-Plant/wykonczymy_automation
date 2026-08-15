import { formatPLN } from '@/lib/utils/format-currency'
import { RegisterBalanceDisplay } from '@/components/ui/register-balance-display'

type RegisterBalanceSummaryPropsT = {
  registerBalance: number
  total: number
  totalLabel?: string
}

export function RegisterBalanceSummary({
  registerBalance,
  total,
  totalLabel = 'Suma wydatków',
}: RegisterBalanceSummaryPropsT) {
  return (
    <div className="bg-muted/50 border-border mt-6 space-y-1 rounded-lg border px-6 py-4">
      <RegisterBalanceDisplay registerBalance={registerBalance} label="Aktualne saldo" />
      <p className="text-sm">
        {totalLabel}: <span className="font-medium">{formatPLN(total)}</span>
      </p>
      <RegisterBalanceDisplay
        registerBalance={registerBalance - total}
        label="Saldo po transakcji"
      />
    </div>
  )
}
