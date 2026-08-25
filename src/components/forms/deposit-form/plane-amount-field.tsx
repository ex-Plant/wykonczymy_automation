import type { DepositFormApiT } from '@/components/forms/deposit-form/deposit-form-api'
import { useEffect, useRef } from 'react'
import type { VatPlaneT } from '@/lib/constants/transfers'
import { netSuggestion } from '@/lib/utils/net-suggestion'

type PlaneAmountFieldPropsT = {
  // The concrete form API, not `FormWithFieldT`: this field reads and writes kwoty through
  // `getFieldValue` / `setFieldValue`, which a name-only structural type cannot describe.
  form: DepositFormApiT
  vatRate: number
  plane: VatPlaneT
  fieldClassName?: string
}

// Gotówka is one netto kwota and that IS the whole wpłata — it has no brutto side to type. A przelew
// arrives on a faktura naming both, so both are typed and both are stored: the netto is suggested at
// the investment's stawka but stays overwritable, because a bill whose materiały sit at the shop's
// stawka has no single rate that derives it. Suggesting is the most the form may do; the moment it
// insisted, we would be back to inventing a kwota the client never paid
// (see `lib/kosztorys/deposit-planes.ts`).
export function PlaneAmountField({ form, vatRate, plane, fieldClassName }: PlaneAmountFieldPropsT) {
  // The last kwota this component wrote into the netto field — what `netSuggestion` compares against.
  const suggested = useRef<string | null>(null)

  const suggestNet = (gross: string, rate: number) => {
    const next = netSuggestion(form.getFieldValue('amount') ?? '', gross, suggested.current, rate)
    if (next === null) return
    suggested.current = next
    form.setFieldValue('amount', next)
  }

  // Re-suggest when the picked investment brings a different stawka with it — the standing
  // suggestion was computed at the old one.
  useEffect(() => {
    if (plane !== 'GROSS') return
    suggestNet(form.getFieldValue('amountGross') ?? '', vatRate)
    // The rate is the only trigger; everything else here is read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vatRate, plane])

  // No plane in the label: a wpłata gotówką carries ONE kwota and offers no second one to tell it
  // apart from, so „netto" here only invites the reader to look for a brutto that does not exist.
  if (plane === 'NET') {
    return (
      <form.AppField key="amount-net" name="amount">
        {(field) => (
          <field.Input
            label="Kwota (PLN)"
            placeholder="0.00"
            type="number"
            showError
            fieldClassName={fieldClassName}
          />
        )}
      </form.AppField>
    )
  }

  return (
    <>
      <form.AppField
        key="amount-gross"
        name="amountGross"
        listeners={{ onChange: ({ value }: { value: string }) => suggestNet(value, vatRate) }}
      >
        {(field) => (
          <field.Input
            label="Kwota brutto (PLN)"
            placeholder="0.00"
            type="number"
            showError
            fieldClassName={fieldClassName}
          />
        )}
      </form.AppField>
      <form.AppField key="amount-faktura-net" name="amount">
        {(field) => (
          <field.Input
            label="Kwota netto z faktury (PLN)"
            placeholder="0.00"
            type="number"
            showError
            fieldClassName={fieldClassName}
          />
        )}
      </form.AppField>
    </>
  )
}
