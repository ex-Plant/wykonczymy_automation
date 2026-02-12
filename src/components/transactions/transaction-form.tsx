'use client'

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
} from '@/lib/constants/transactions'
import { createTransactionAction } from '@/lib/transactions/actions'
import type { ReferenceDataT } from './transaction-dialog-provider'

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
    onSubmit: async ({ value }) => {
      const formData = new FormData()

      formData.set('description', value.description)
      formData.set('amount', value.amount)
      formData.set('date', value.date)
      formData.set('type', value.type)
      formData.set('paymentMethod', value.paymentMethod)
      formData.set('cashRegister', value.cashRegister)

      if (value.investment) formData.set('investment', value.investment)
      if (value.worker) formData.set('worker', value.worker)
      if (value.otherCategory) formData.set('otherCategory', value.otherCategory)
      if (value.otherDescription) formData.set('otherDescription', value.otherDescription)
      if (value.invoiceNote) formData.set('invoiceNote', value.invoiceNote)

      // Get invoice file from the file input
      const invoiceInput = document.querySelector<HTMLInputElement>('input[name="invoice"]')
      const invoiceFile = invoiceInput?.files?.[0]
      if (invoiceFile) formData.set('invoice', invoiceFile)

      const result = await createTransactionAction(formData)

      if (result.success) {
        toastMessage('Transakcja dodana', 'success')
        onSuccess()
      } else {
        toastMessage(result.error, 'error')
      }

      return false
    },
  })

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
          <div className="space-y-1">
            <label htmlFor="invoice" className="text-foreground text-sm font-medium">
              Faktura
            </label>
            <input
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

        <div className="mt-6">
          <FormFooter />
        </div>
      </form>
    </form.AppForm>
  )
}
