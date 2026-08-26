'use client'

import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { useFilePickIngest } from '@/components/forms/hooks/use-file-pick-ingest'
import {
  showsInvestment,
  needsExpenseCategory,
  isLaborCost,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { editTransferFormSchema } from '@/lib/schemas/transfer-form'
import type { EditTransferFormValuesT } from './edit-transfer-form-api'
import { submitWithInvoicePages } from '@/lib/invoices/submit-with-invoice-pages'
import { useInvoiceRemoval } from '@/hooks/use-invoice-removal'
import type { UpdateTransferFormT } from '@/lib/schemas/transfer'
import type { TransferRowT } from '@/types/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import { updateTransferAction } from '@/lib/actions/transfers'
import {
  AmountField,
  DateField,
  DescriptionField,
  EntityComboboxField,
} from '@/components/forms/form-fields'
import { ExpenseCategoryField } from '@/components/forms/edit-transfer-form/expense-category-field'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormClearButton } from '../form-components/form-clear-button'

type EditTransferFormPropsT = {
  row: TransferRowT
  referenceData: ReferenceDataBaseT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

const FORM_ID = 'edit-transfer'

export function EditTransferForm({
  row,
  referenceData,
  onSubmitSuccess,
  keepOpen,
}: EditTransferFormPropsT) {
  const { submit } = useFormSubmit(FORM_ID)
  const { files, isIngesting, inputKey, fileInputProps, reset: resetFiles } = useFilePickIngest()

  // Bare reset: no draft here, so `defaultValues` really is the row — clearing means „back to saved".
  function handleReset() {
    form.reset()
    resetFiles()
  }

  const form = useAppForm({
    defaultValues: {
      description: row.description,
      amount: isLaborCost(row.type) ? String(row.amount) : undefined,
      date: row.date.slice(0, 10),
      paymentMethod: row.paymentMethod,
      investment: row.investmentId ? String(row.investmentId) : '',
      expenseCategory: row.expenseCategoryId ? String(row.expenseCategoryId) : '',
      otherCategory: row.otherCategoryId ? String(row.otherCategoryId ?? '') : '',
      invoiceNote: row.invoiceNote ?? '',
    } as EditTransferFormValuesT,
    validators: {
      onSubmit: editTransferFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: UpdateTransferFormT = {
        description: value.description,
        amount: value.amount ? Number(value.amount) : undefined,
        date: value.date,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        investment: value.investment ? Number(value.investment) : undefined,
        expenseCategory: value.expenseCategory ? Number(value.expenseCategory) : undefined,
        otherCategory: value.otherCategory ? Number(value.otherCategory) : undefined,
        invoiceNote: value.invoiceNote || undefined,
      }

      await submit(!!keepOpen, {
        action: async () => {
          // Enter bypasses the disabled submit button, so the guard has to exist here too —
          // saving mid-ingest would persist the row without the pages still being converted.
          if (isIngesting) return { success: false, error: 'Poczekaj na przetworzenie plików.' }

          return submitWithInvoicePages(files, (pageIds) =>
            // `undefined` means "no pages this save" to an update that only ever ADDS invoices.
            updateTransferAction(row.id, data, pageIds.length > 0 ? pageIds : undefined),
          )
        },
        successMessage: 'Transakcja zaktualizowana',
        onSubmitSuccess,
        onReset: handleReset,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  // Gate the type field on the LIVE investment value, not row.investmentId — the
  // investment is editable here, so adding one to a correction must reveal the
  // type field without a reload (matches the create form's currentInvestment).
  const currentInvestment = useStore(form.store, (s) => s.values.investment)

  // Removal is immediate (its own action), unlike the rest of this form which applies on „Zapisz" —
  // the file input below only ever ADDS pages, so there is no other way to drop one here.
  const { visibleInvoices, handleRemove, handleRemoveAll, removalConfirm } = useInvoiceRemoval(
    row.id,
    row.invoices,
  )

  return (
    <form.AppForm>
      <FormClearButton onReset={handleReset} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          <DescriptionField form={form} />

          {isLaborCost(row.type) && <AmountField form={form} />}

          <DateField form={form} />

          {/* Payment method hidden — only CASH is currently used */}

          {showsInvestment(row.type) && (
            <EntityComboboxField
              form={form}
              variant="investment"
              items={referenceData.investments}
            />
          )}

          {needsExpenseCategory(row.type, !!currentInvestment) && (
            <ExpenseCategoryField form={form} expenseCategories={referenceData.expenseCategories} />
          )}

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

          {/* No plane field here by design (owner, 2026-08-20): retagging a wpłata moves the debt by
              a VAT's worth, exactly like editing its kwota — which this form already refuses. A
              transfer has no version history, so the correction path is the one that leaves a trail:
              anuluj i zaksięguj na nowo. */}
          <form.AppField name="invoiceNote">
            {(field) => (
              <field.Textarea label="Notatka" placeholder="Wpisz notatkę..." rows={3} showError />
            )}
          </form.AppField>

          <div className="space-y-2">
            {visibleInvoices.length > 0 && files.length === 0 && (
              <InvoicePreviewButton
                invoices={visibleInvoices}
                onRemove={handleRemove}
                onRemoveAll={visibleInvoices.length > 1 ? handleRemoveAll : undefined}
              />
            )}
            <FileInput
              key={inputKey}
              label="Dodaj faktury"
              accept="image/*,application/pdf"
              multiple
              {...fileInputProps}
            />
          </div>
        </FieldGroup>

        <FormFooter
          label="Zapisz"
          submittingLabel="Zapisywanie..."
          className="mt-6"
          disabled={isIngesting}
        />
      </form>

      <ConfirmDialog {...removalConfirm} />
    </form.AppForm>
  )
}
