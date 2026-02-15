'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { SelectItem } from '@/components/ui/select'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useFormStatus } from '@/components/forms/hooks/use-form-status'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import { Loader } from '@/components/ui/loader/loader'
import { toastMessage } from '@/components/toasts'
import { formatPLN } from '@/lib/format-currency'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodT,
} from '@/lib/constants/transactions'
import { getManagementEmployeeSaldo } from '@/lib/queries/employees'
import { createSettlementAction } from '@/lib/actions/settlements'
import { settlementFormSchema, type CreateSettlementFormT } from '@/lib/schemas/settlements'
import { cn } from '@/lib/cn'

type ReferenceItemT = { id: number; name: string }

type ReferenceDataT = {
  users: ReferenceItemT[]
  investments: ReferenceItemT[]
  cashRegisters: ReferenceItemT[]
}

type SettlementFormPropsT = {
  referenceData: ReferenceDataT
  managerCashRegisterId?: number
  className?: string
}

type FormValuesT = {
  worker: string
  investment: string
  date: string
  cashRegister: string
  paymentMethod: string
  invoiceNote: string
  lineItems: { description: string; amount: string }[]
}

const today = () => new Date().toISOString().split('T')[0]

export function SettlementForm({
  referenceData,
  managerCashRegisterId,
  className,
}: SettlementFormPropsT) {
  const router = useRouter()
  const invoiceRef = useRef<HTMLInputElement>(null)
  const isRegisterLocked = managerCashRegisterId !== undefined

  // Saldo is display-only, not form data
  const [saldo, setSaldo] = useState<number | null>(null)
  const [isSaldoLoading, setIsSaldoLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      worker: '',
      investment: '',
      date: today(),
      cashRegister: isRegisterLocked ? String(managerCashRegisterId) : '',
      paymentMethod: 'CASH',
      invoiceNote: '',
      lineItems: [{ description: '', amount: '' }],
    } as FormValuesT,
    validators: {
      onSubmit: settlementFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: CreateSettlementFormT = {
        worker: Number(value.worker),
        investment: Number(value.investment),
        date: value.date,
        cashRegister: Number(value.cashRegister),
        paymentMethod: value.paymentMethod as PaymentMethodT,
        invoiceNote: value.invoiceNote || undefined,
        lineItems: value.lineItems.map((item) => ({
          description: item.description,
          amount: Number(item.amount),
        })),
      }

      const file = invoiceRef.current?.files?.[0]
      let invoiceFormData: FormData | null = null
      if (file) {
        invoiceFormData = new FormData()
        invoiceFormData.set('invoice', file)
      }

      const result = await createSettlementAction(data, invoiceFormData)

      if (result.success) {
        toastMessage(`Utworzono ${result.count} transakcji`, 'success')
        router.push('/transakcje')
      } else {
        toastMessage(result.error, 'error')
      }

      return false
    },
  })

  useCheckFormErrors(form)

  const lineItems = useStore(form.store, (s) => s.values.lineItems)
  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const { isInvalid, isSubmitting } = useFormStatus(form)

  const fetchSaldo = async (workerId: string) => {
    setSaldo(null)
    if (!workerId) return

    setIsSaldoLoading(true)
    try {
      const result = await getManagementEmployeeSaldo(Number(workerId))
      setSaldo(result.saldo)
    } catch {
      toastMessage('Nie udało się pobrać salda', 'error')
    } finally {
      setIsSaldoLoading(false)
    }
  }

  return (
    <div className={cn('max-w-3xl', className)}>
      <form.AppForm>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            {/* Employee selector */}
            <form.AppField
              name="worker"
              listeners={{
                onChange: ({ value }) => {
                  fetchSaldo(value)
                },
              }}
            >
              {(field) => (
                <field.Select label="Pracownik" placeholder="Wybierz pracownika" showError>
                  {referenceData.users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>

            {isSaldoLoading && <p className="text-muted-foreground text-sm">Ładowanie salda...</p>}
            {saldo !== null && !isSaldoLoading && (
              <p className="text-sm">
                Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
              </p>
            )}

            {/* Shared metadata */}
            <div className="grid grid-cols-2 gap-4">
              <form.AppField name="investment">
                {(field) => (
                  <field.Select label="Inwestycja" placeholder="Wybierz inwestycję" showError>
                    {referenceData.investments.map((inv) => (
                      <SelectItem key={inv.id} value={String(inv.id)}>
                        {inv.name}
                      </SelectItem>
                    ))}
                  </field.Select>
                )}
              </form.AppField>

              <form.AppField name="date">
                {(field) => <field.Input label="Data" type="date" showError />}
              </form.AppField>

              <form.AppField name="cashRegister">
                {(field) => (
                  <field.Select
                    label="Kasa"
                    placeholder="Wybierz kasę"
                    showError
                    disabled={isRegisterLocked}
                  >
                    {referenceData.cashRegisters.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </field.Select>
                )}
              </form.AppField>

              <form.AppField name="paymentMethod">
                {(field) => (
                  <field.Select label="Metoda płatności" showError>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method as PaymentMethodT]}
                      </SelectItem>
                    ))}
                  </field.Select>
                )}
              </form.AppField>
            </div>

            {/* Line items */}
            <form.Field name="lineItems" mode="array">
              {(lineItemsField) => (
                <div className="space-y-3">
                  <p className="text-foreground text-sm font-medium">Pozycje faktury</p>
                  {lineItemsField.state.value.map((_, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="flex-1">
                        <form.AppField name={`lineItems[${index}].description`}>
                          {(field) => <field.Input placeholder="Opis pozycji" showError />}
                        </form.AppField>
                      </div>
                      <div className="w-36">
                        <form.AppField name={`lineItems[${index}].amount`}>
                          {(field) => <field.Input placeholder="Kwota" type="number" showError />}
                        </form.AppField>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => lineItemsField.removeValue(index)}
                        disabled={lineItemsField.state.value.length === 1}
                        aria-label="Usuń pozycję"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => lineItemsField.pushValue({ description: '', amount: '' })}
                  >
                    Dodaj pozycję
                  </Button>
                  <p className="text-foreground text-sm font-medium">Suma: {formatPLN(total)}</p>
                </div>
              )}
            </form.Field>

            {/* Invoice file — manual input (not bound to form state, read via ref on submit) */}
            <div className="space-y-1">
              <label htmlFor="invoice" className="text-foreground text-sm font-medium">
                Faktura
              </label>
              <input
                ref={invoiceRef}
                type="file"
                id="invoice"
                name="invoice"
                accept="image/*,application/pdf"
                className="text-muted-foreground file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
              />
            </div>

            {/* Invoice note */}
            <form.AppField name="invoiceNote">
              {(field) => (
                <field.Textarea
                  label="Notatka do faktury"
                  placeholder="Wymagane jeśli brak faktury"
                  showError
                />
              )}
            </form.AppField>
          </FieldGroup>

          {/* Summary */}
          {saldo !== null && (
            <div className="bg-muted/50 border-border mt-6 space-y-1 rounded-lg border px-6 py-4">
              <p className="text-sm">
                Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
              </p>
              <p className="text-sm">
                Suma rozliczenia: <span className="font-medium">{formatPLN(total)}</span>
              </p>
              <p className="text-sm">
                Saldo po rozliczeniu:{' '}
                <span className="font-medium">{formatPLN(saldo - total)}</span>
              </p>
            </div>
          )}

          {/* Submit */}
          <footer className="mt-6">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Przetwarzanie...' : `Rozlicz (${lineItems.length} pozycji)`}
            </Button>
            {isInvalid && (
              <p className="text-destructive mt-2 text-sm font-medium">Formularz zawiera błędy</p>
            )}
          </footer>
          <Loader loading={isSubmitting} portal />
        </form>
      </form.AppForm>
    </div>
  )
}
