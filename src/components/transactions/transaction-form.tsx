'use client'

import { useRef } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import FormFooter from '@/components/forms/form-footer'
import { toastMessage } from '@/components/toasts'
import {
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  needsInvestment,
  needsWorker,
  needsOtherCategory,
  type TransactionTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transactions'
import { createTransactionAction } from '@/lib/transactions/actions'
import { transactionFormSchema, type CreateTransactionFormT } from '@/lib/transactions/schema'
import type { ReferenceDataT } from './add-transaction-dialog'
import useCheckFormErrors from '../forms/hooks/use-check-form-errors'

type TransactionFormPropsT = {
  referenceData: ReferenceDataT
  onSuccess: () => void
}

// Form state uses strings since HTML inputs/selects work with strings.
// Numeric conversion happens in the server action.
type FormValuesT = {
  description: string
  amount: string
  date: string
  type: string
  paymentMethod: string
  cashRegister: string
  investment: string
  worker: string
  otherCategory: string
  otherDescription: string
  invoiceNote: string
}

const today = () => new Date().toISOString().split('T')[0]

export function TransactionForm({ referenceData, onSuccess }: TransactionFormPropsT) {
  const invoiceRef = useRef<HTMLInputElement>(null)

  const form = useAppForm({
    defaultValues: {
      description: '',
      amount: '',
      date: today(),
      type: 'INVESTMENT_EXPENSE',
      paymentMethod: 'CASH',
      cashRegister: '',
      investment: '',
      worker: '',
      otherCategory: '',
      otherDescription: '',
      invoiceNote: '',
    } as FormValuesT,
    validators: {
      onSubmit: transactionFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: CreateTransactionFormT = {
        description: value.description,
        amount: Number(value.amount),
        date: value.date,
        type: value.type as TransactionTypeT,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        cashRegister: Number(value.cashRegister),
        investment: value.investment ? Number(value.investment) : undefined,
        worker: value.worker ? Number(value.worker) : undefined,
        otherCategory: value.otherCategory ? Number(value.otherCategory) : undefined,
        otherDescription: value.otherDescription || undefined,
        invoiceNote: value.invoiceNote || undefined,
      }

      const file = invoiceRef.current?.files?.[0]
      let invoiceFormData: FormData | null = null
      if (file) {
        invoiceFormData = new FormData()
        invoiceFormData.set('invoice', file)
      }

      const result = await createTransactionAction(data, invoiceFormData)

      if (result.success) {
        toastMessage('Transakcja dodana', 'success')
        onSuccess()
      } else {
        console.log('result', result.error)
        toastMessage(result.error, 'error')
      }

      return false
    },
  })

  useCheckFormErrors(form)

  const currentType = useStore(form.store, (s) => s.values.type)

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          {/* Type */}
          <form.AppField name="type">
            {(field) => (
              <field.Select label="Typ transakcji" showError>
                {TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSACTION_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          {/* Description */}
          <form.AppField name="description">
            {(field) => <field.Input label="Opis" placeholder="Opis transakcji" showError />}
          </form.AppField>

          {/* Amount */}
          <form.AppField name="amount">
            {(field) => (
              <field.Input label="Kwota (PLN)" placeholder="0.00" type="number" showError />
            )}
          </form.AppField>

          {/* Date */}
          <form.AppField name="date">
            {(field) => <field.Input label="Data" type="date" showError />}
          </form.AppField>

          {/* Payment method */}
          <form.AppField name="paymentMethod">
            {(field) => (
              <field.Select label="Metoda płatności" showError>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          {/* Cash register */}
          <form.AppField name="cashRegister">
            {(field) => (
              <field.Select label="Kasa" placeholder="Wybierz kasę" showError>
                {referenceData.cashRegisters.map((cr) => (
                  <SelectItem key={cr.id} value={String(cr.id)}>
                    {cr.name}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          {/* Conditional: Investment */}
          {needsInvestment(currentType) && (
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
          )}

          {/* Conditional: Worker */}
          {needsWorker(currentType) && (
            <form.AppField name="worker">
              {(field) => (
                <field.Select label="Pracownik" placeholder="Wybierz pracownika" showError>
                  {referenceData.workers.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>
          )}

          {/* Conditional: Other category */}
          {needsOtherCategory(currentType) && (
            <>
              <form.AppField name="otherCategory">
                {(field) => (
                  <field.Select label="Kategoria" placeholder="Wybierz kategorię" showError>
                    {referenceData.otherCategories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </field.Select>
                )}
              </form.AppField>

              <form.AppField name="otherDescription">
                {(field) => (
                  <field.Textarea label="Opis kategorii" placeholder="Dodatkowy opis" showError />
                )}
              </form.AppField>
            </>
          )}

          {/* Invoice file — manual input (not bound to form state, read via DOM on submit) */}
          {currentType !== 'DEPOSIT' && (
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
          )}

          {/* Invoice note */}
          {currentType !== 'DEPOSIT' && (
            <form.AppField name="invoiceNote">
              {(field) => (
                <field.Textarea
                  label="Notatka do faktury"
                  placeholder="Wymagane jeśli brak faktury"
                  showError
                />
              )}
            </form.AppField>
          )}
        </FieldGroup>

        <div className="mt-6">
          <FormFooter />
        </div>
      </form>
    </form.AppForm>
  )
}
