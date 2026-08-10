'use client'

import { useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceIngest } from '@/components/forms/expense-form/use-invoice-ingest'
import { useReceiptGeneration } from '@/components/forms/expense-form/use-receipt-generation'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { useSaldo } from '@/components/forms/hooks/use-saldo'
import { useInvestmentFromUrl } from '@/components/forms/hooks/use-investment-from-url'
import {
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  billsNetAmount,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  needsTargetRegister,
  needsWorker,
  canBeSettled,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { deleteOrphanedMediaAction } from '@/lib/actions/media'
import { mapLineItem } from '@/components/forms/expense-form/map-line-item'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { positionalFiles, resolveInvoiceMediaIds } from '@/lib/utils/upload-file-client'
import { toastMessage } from '@/lib/utils/toast'
import {
  bulkExpenseFormSchema,
  type CreateBulkExpenseFormT,
} from '@/components/forms/expense-form/expense-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { today } from '@/lib/utils/date'
import {
  CashRegisterField,
  DateField,
  EntityComboboxField,
  PaymentMethodField,
  SourceRegisterField,
  LineItemsField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormShell } from '../form-components/form-shell'
import { SaldoSummary } from '../form-components/saldo-summary'
import { useExpenseFormStore } from '@/stores/form-stores'

type TransferFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

// Form state uses strings since HTML inputs/selects work with strings.
// Numeric conversion happens in the server action.
type FormValuesT = BulkExpenseFormValuesT

const FORM_ID = 'expense'

export function ExpenseForm({ referenceData, onSubmitSuccess, keepOpen }: TransferFormPropsT) {
  const { recoveredFiles, submit } = useFormSubmit(FORM_ID)

  const storedValues = useExpenseFormStore((s) => s.formData)
  const updateFormData = useExpenseFormStore((s) => s.updateFormData)
  const resetFormData = useExpenseFormStore((s) => s.resetFormData)

  const { saldo, isSaldoLoading, fetchSaldo, resetSaldo } = useSaldo()

  const {
    ingestingIds,
    isIngesting,
    registerFiles,
    attachFile,
    // Keyed by id, so surviving rows' markers/files need no shift and the reactive store
    // re-renders the removed row on its own.
    handleRemoveLineItem,
    removeFileAt,
    getRowFiles,
    getFiles,
    renameFile,
    reset: resetInvoiceFiles,
  } = useInvoiceIngest({ recoveredFiles, storedLineItems: storedValues?.lineItems })

  // FormClearButton runs form.reset() (restores the mount-time default, whose row id is stale) and
  // then this. Mint a fresh-id blank row so its React key changes and the row — with its uncontrolled
  // FileInput — remounts, clearing any native FileList that form.reset() can't reach.
  function handleReset() {
    resetFormData()
    resetSaldo()
    resetInvoiceFiles()
    resetGeneration()
    form.setFieldValue('lineItems', [makeLineItem()])
  }

  // Fills the select only when it would otherwise be empty — a draft that already names an
  // investment keeps it, so navigating between investments never rewrites a half-filled form.
  const investmentFromUrl = useInvestmentFromUrl(referenceData.investments)

  // Held in state, not rebuilt inline: makeLineItem() mints a fresh uuid, so an inline literal
  // handed to useAppForm was a new defaultValues on every render — the form re-applied it, which
  // re-rendered, which minted another id → "Maximum update depth exceeded" the moment the dialog opened.
  const [blankValues] = useState<FormValuesT>(() => ({
    date: today(),
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: 'CASH',
    sourceRegister: '',
    targetRegister: '',
    investment: investmentFromUrl,
    worker: '',
    settled: false,
    lineItems: [makeLineItem()],
  }))

  const initialValues = storedValues
    ? { ...storedValues, investment: storedValues.investment || investmentFromUrl }
    : blankValues

  const form = useAppForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: bulkExpenseFormSchema,
    },
    listeners: {
      onChange: ({ formApi }) => updateFormData(formApi.state.values as FormValuesT),
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      // Backstop to the disabled submit button (a keyboard Enter can bypass it): a row still
      // ingesting hasn't stored its processed file yet, so getFiles() would read undefined for it
      // and the line item would save without its receipt — silent loss.
      if (isIngesting) {
        toastMessage('Poczekaj na przetworzenie plików.', 'warning', 4000)
        return false
      }

      const type = value.type as TransferTypeT
      const data: CreateBulkExpenseFormT = {
        date: value.date,
        type,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        sourceRegister: value.sourceRegister ? Number(value.sourceRegister) : undefined,
        targetRegister: value.targetRegister ? Number(value.targetRegister) : undefined,
        investment: value.investment ? Number(value.investment) : undefined,
        worker: value.worker ? Number(value.worker) : undefined,
        settled: value.settled,
        lineItems: value.lineItems.map((item) => mapLineItem(item, type, !!value.investment)),
      }

      // Cross the id→position seam once, here: the upload contract and the optimistic-store
      // snapshot (persisted for recovery) are both positional (mediaIds[i] ↔ lineItems[i]).
      const files = positionalFiles(value.lineItems, getFiles())

      await submit(!!keepOpen, {
        form,
        action: async () => {
          let invoiceMediaIds: number[][] | undefined
          if (files.size > 0) {
            try {
              // Submit is the only upload site: the AI scan sends raw bytes and persists nothing, so
              // every attached file is uploaded once here.
              invoiceMediaIds = await resolveInvoiceMediaIds(value.lineItems.length, files)
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Nie udało się przesłać plików'
              return { success: false, error: message }
            }
          }
          const result = await createBulkTransferAction(data, invoiceMediaIds)
          // The files are already in Blob at this point and the expense that would have referenced
          // them was never created, so nothing can reach them again — clean up rather than leak.
          // The user keeps their form (files included) and can resubmit, which re-uploads.
          if (!result.success && invoiceMediaIds) {
            const uploaded = invoiceMediaIds.flat()
            if (uploaded.length > 0) void deleteOrphanedMediaAction(uploaded)
          }
          return result
        },
        successMessage: 'Transakcje dodane',
        files,
        onSubmitSuccess,
        onReset: handleReset,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  const {
    generateFromReceipts,
    isGenerating,
    generatingIds,
    failedIds,
    generationProgress,
    resetGeneration,
  } = useReceiptGeneration({
    form,
    otherCategories: referenceData.otherCategories,
    getFiles,
    renameFile,
  })

  // The reactive file store re-renders each FV label as generateFromReceipts renames its file — no
  // remount needed, so this is just the scan.
  const handleGenerate = generateFromReceipts

  const currentType = useStore(form.store, (s) => s.values.type)
  const currentInvestment = useStore(form.store, (s) => s.values.investment)
  const lineItems = useStore(form.store, (s) => s.values.lineItems)
  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  // TanStack Form preserves values of unmounted fields. When the user switches
  // transfer type, hidden fields (e.g. investment) keep stale selections.
  // Reset them so validation and submission use a clean slate for the new type.
  const conditionalFields = ['targetRegister', 'investment', 'worker', 'settled'] as const

  function resetConditionalFields() {
    conditionalFields.forEach((field) => form.resetField(field))
    form.resetField('sourceRegister')
    // resetField('lineItems') would restore the stale-id mount default; set a fresh-id blank row
    // instead so the row (and its uncontrolled FileInput) remounts. The queued files live outside
    // the form, so clear them too — otherwise a file queued before the type switch attaches to the
    // wrong/nonexistent line item on submit.
    form.setFieldValue('lineItems', [makeLineItem()])
    resetInvoiceFiles()
    resetGeneration()
    resetSaldo()
  }

  return (
    <FormShell form={form} onReset={handleReset}>
      <FieldGroup>
        {/* The netto hint sits UNDER the row, not on the Select as a `description` — FormBase
          renders a description between the label and the control, which would push the type
          Select down while „Data" beside it stayed put, breaking the row's alignment. */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-4">
            <form.AppField name="type" listeners={{ onChange: resetConditionalFields }}>
              {(field) => (
                <field.Select label="Typ wydatku" showError fieldClassName="min-w-0 flex-1">
                  {TRANSACTION_TRANSFER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRANSFER_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>
            <DateField form={form} fieldClassName="w-40" />
          </div>
          {billsNetAmount(currentType) && (
            <FieldDescription>
              Z kasy schodzi kwota brutto, a klienta obciąża kwota netto — dlatego przy każdej
              pozycji podajesz obie.
            </FieldDescription>
          )}
        </div>

        {showsInvestment(currentType) && (
          <EntityComboboxField form={form} variant="investment" items={referenceData.investments} />
        )}

        {canBeSettled(currentType) && (
          <form.AppField name="settled">
            {(field) => (
              <field.Checkbox label="Wliczone w robociznę (materiał w cenie robocizny — nie obciąża klienta)" />
            )}
          </form.AppField>
        )}

        {needsSourceRegister(currentType) && (
          <SourceRegisterField
            form={form}
            cashRegisters={referenceData.cashRegisters}
            saldo={saldo}
            isSaldoLoading={isSaldoLoading}
            fetchSaldo={fetchSaldo}
          />
        )}

        {needsTargetRegister(currentType) && (
          <CashRegisterField
            form={form}
            name="targetRegister"
            label="Kasa docelowa"
            placeholder="Wybierz kasę docelową"
            cashRegisters={referenceData.cashRegisters}
          />
        )}

        <PaymentMethodField form={form} />

        {needsWorker(currentType) && (
          <EntityComboboxField form={form} variant="worker" items={referenceData.workers} />
        )}

        {!isDepositType(currentType) && (
          <LineItemsField
            form={form}
            total={total}
            hasInvestment={!!currentInvestment}
            onRemoveItem={handleRemoveLineItem}
            onFileChange={attachFile}
            onRemoveFile={removeFileAt}
            onRegisterFiles={registerFiles}
            getRowFiles={getRowFiles}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            generatingIds={generatingIds}
            ingestingIds={ingestingIds}
            failedIds={failedIds}
            generationProgress={generationProgress}
            transferType={currentType}
            referenceData={referenceData}
          />
        )}
      </FieldGroup>

      {saldo !== null && <SaldoSummary saldo={saldo} total={total} />}

      <FormFooter className="mt-6" label="Zapisz" disabled={isIngesting} />
    </FormShell>
  )
}
