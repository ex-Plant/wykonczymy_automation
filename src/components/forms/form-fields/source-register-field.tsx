import { CashRegisterField } from './cash-register-field'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import type { ReferenceItemT } from '@/types/reference-data'

type SourceRegisterFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  cashRegisters: ReferenceItemT[]
  label?: string
  registerBalance: number | null
  isRegisterBalanceLoading: boolean
  fetchRegisterBalance: (registerId: string) => void
}

export function SourceRegisterField({
  form,
  cashRegisters,
  label = 'Kasa',
  registerBalance,
  isRegisterBalanceLoading,
  fetchRegisterBalance,
}: SourceRegisterFieldPropsT) {
  return (
    <>
      <CashRegisterField
        form={form}
        cashRegisters={cashRegisters}
        label={label}
        listeners={{ onChange: ({ value }: { value: string }) => fetchRegisterBalance(value) }}
      />
      {isRegisterBalanceLoading && (
        <p className="text-muted-foreground text-sm">Ładowanie salda...</p>
      )}
      {registerBalance !== null && !isRegisterBalanceLoading && (
        <SignedMoneyDisplay amount={registerBalance} label="Aktualne saldo" />
      )}
    </>
  )
}
