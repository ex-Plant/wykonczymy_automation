import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import { useMemo, useState } from 'react'
import { ActiveFilterLabel } from '@/components/ui/active-filter-label'
import { EmptyFieldMessage } from './empty-field-message'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import { activeOrSelected } from '@/lib/utils/is-active-ref'
import type { ReferenceItemT } from '@/types/reference-data'

type CashRegisterFieldPropsT<TName extends string> = {
  form: FormWithFieldT<TName>
  name?: TName
  label?: string
  placeholder?: string
  cashRegisters: ReferenceItemT[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners?: Record<string, any>
}

// Generic over the field name because the four call sites point it at four different ones
// (sourceRegister / targetRegister / defaultCashRegister), and the point of the type is that the
// form handed in actually HAS the one being asked for.
export function CashRegisterField<TName extends string = 'sourceRegister'>({
  form,
  // TS cannot prove a literal satisfies a caller-chosen TName; the generic default is what makes
  // this true whenever `name` is omitted.
  name = 'sourceRegister' as TName,
  label = 'Kasa',
  placeholder = 'Wybierz kasę',
  cashRegisters,
  listeners,
}: CashRegisterFieldPropsT<TName>) {
  const [activeOnly, setActiveOnly] = useState(true)

  const selectedId = useFieldValue(form, name)

  const filteredRegisters = useMemo(
    () => activeOrSelected(cashRegisters, activeOnly, selectedId),
    [cashRegisters, activeOnly, selectedId],
  )

  const emptyMessage = cashRegisters.length === 0 ? 'Brak kas' : 'Brak aktywnych kas'
  const labelExtra = <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} />

  const comboboxItems = useMemo(
    () => filteredRegisters.map((cr) => ({ value: String(cr.id), label: cr.name })),
    [filteredRegisters],
  )

  return (
    <form.AppField name={name} listeners={listeners}>
      {(field) =>
        filteredRegisters.length > 0 ? (
          <field.Combobox
            label={label}
            labelExtra={labelExtra}
            placeholder={placeholder}
            items={comboboxItems}
            showError
          />
        ) : (
          <EmptyFieldMessage label={label} message={emptyMessage} labelExtra={labelExtra} />
        )
      }
    </form.AppField>
  )
}
