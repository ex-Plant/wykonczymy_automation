'use client'

import { useRef, useState } from 'react'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import {
  showsInvestment,
  needsExpenseCategory,
  isLaborCost,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { editExpenseFormSchema } from '@/components/forms/expense-form/expense-schema'
import { InvoiceUploadError, resolveInvoiceMediaIds } from '@/lib/utils/upload-file-client'
import { discardOrphanedUploads } from '@/lib/utils/discard-orphaned-uploads'
import { useInvoiceRemoval } from '@/hooks/use-invoice-removal'
import type { z } from 'zod'
import type { UpdateTransferFormT } from '@/lib/schemas/transfer'
import type { TransferRowT } from '@/types/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'
import { updateTransferAction } from '@/lib/actions/transfers'
import {
  AmountField,
  DateField,
  DescriptionField,
  EntityComboboxField,
  ExpenseCategoryField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormClearButton } from '../form-components/form-clear-button'

type EditTransferFormPropsT = {
  row: TransferRowT
  referenceData: ReferenceDataBaseT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

type FormValuesT = z.infer<typeof editExpenseFormSchema>

const FORM_ID = 'edit-transfer'

export function EditTransferForm({
  row,
  referenceData,
  onSubmitSuccess,
  keepOpen,
}: EditTransferFormPropsT) {
  const { submit } = useFormSubmit(FORM_ID)
  const fileRef = useRef<HTMLInputElement>(null)
  const [hasPickedFiles, setHasPickedFiles] = useState(false)
  // Bumped on reset to remount the (uncontrolled) file input, clearing its
  // native file and internal filename state — form.reset() can't reach them.
  const [fileInputKey, setFileInputKey] = useState(0)

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
    } as FormValuesT,
    validators: {
      onSubmit: editExpenseFormSchema,
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

      // Capture files before dialog closes — the ref won't be available after unmount
      const files = [...(fileRef.current?.files ?? [])]

      await submit(!!keepOpen, {
        form,
        action: async () => {
          let invoiceMediaIds: number[] | undefined
          if (files.length > 0) {
            try {
              // One row, so every picked file is a page of the same invoice: index 0 of a
              // one-row positional batch.
              const [pages] = await resolveInvoiceMediaIds(1, new Map([[0, files]]))
              invoiceMediaIds = pages
            } catch (err) {
              if (err instanceof InvoiceUploadError) discardOrphanedUploads(err.uploadedIds)
              const message = err instanceof Error ? err.message : 'Nie udało się przesłać pliku'
              return { success: false, error: message }
            }
          }
          const result = await updateTransferAction(row.id, data, invoiceMediaIds)
          // The pages are in Blob but the update that would have attached them never happened.
          if (!result.success && invoiceMediaIds) discardOrphanedUploads(invoiceMediaIds)
          return result
        },
        successMessage: 'Transakcja zaktualizowana',
        onSubmitSuccess,
        onReset: () => {
          setHasPickedFiles(false)
          setFileInputKey((k) => k + 1)
        },
      })

      return false
    },
  })

  useCheckFormErrors(form)

  // Gate the type field on the LIVE investment value, not row.investmentId — the
  // investment is editable here, so adding one to a correction must reveal the
  // type field without a reload (matches the create form's currentInvestment).
  const currentInvestment = useStore(form.store, (s) => s.values.investment)

  function handleFileChange() {
    setHasPickedFiles((fileRef.current?.files?.length ?? 0) > 0)
  }

  // Removal is immediate (its own action), unlike the rest of this form which applies on „Zapisz" —
  // the file input below only ever ADDS pages, so there is no other way to drop one here.
  const { visibleInvoices, handleRemove, handleRemoveAll } = useInvoiceRemoval(row.id, row.invoices)

  return (
    <form.AppForm>
      <FormClearButton />
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
            {(field: AppFieldComponentsT) => (
              <field.Select label="Kategoria" placeholder="Wybierz kategorię" showError>
                {referenceData.otherCategories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          <form.AppField name="invoiceNote">
            {(field: AppFieldComponentsT) => (
              <field.Textarea label="Notatka" placeholder="Wpisz notatkę..." rows={3} showError />
            )}
          </form.AppField>

          <div className="space-y-2">
            {visibleInvoices.length > 0 && !hasPickedFiles && (
              <InvoicePreviewButton
                invoices={visibleInvoices}
                onRemove={handleRemove}
                onRemoveAll={visibleInvoices.length > 1 ? handleRemoveAll : undefined}
              />
            )}
            <FileInput
              key={fileInputKey}
              ref={fileRef}
              label="Dodaj faktury"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFileChange}
            />
          </div>
        </FieldGroup>

        <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." className="mt-6" />
      </form>
    </form.AppForm>
  )
}
