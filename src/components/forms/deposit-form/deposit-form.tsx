'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useStore } from '@/components/forms/hooks/form-hooks'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { useInvestmentFromUrl } from '@/components/forms/hooks/use-investment-from-url'
import { FormShell } from '@/components/forms/form-components/form-shell'
import {
  DEPOSIT_UI_TYPES,
  TRANSFER_TYPE_LABELS,
  VAT_PLANES,
  type PaymentMethodT,
  type VatPlaneT,
} from '@/lib/constants/transfers'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { expenseFormSchema } from '@/components/forms/expense-form/expense-schema'
import type { CreateTransferFormT } from '@/lib/schemas/transfer'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/utils/date'
import {
  AmountField,
  CashRegisterField,
  DateField,
  DescriptionField,
  EntityComboboxField,
  PaymentMethodField,
  VatPlaneField,
} from '@/components/forms/form-fields'
import FormFooter from '../form-components/form-footer'
import { createTransferAction } from '@/lib/actions/transfers'
import { useDepositFormStore } from '@/stores/form-stores'

type DepositFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

type FormValuesT = {
  description: string
  amount: string
  date: string
  type: string
  paymentMethod: string
  vatPlane?: string
  sourceRegister: string
  investment?: string
}

const FORM_ID = 'deposit'

const isVatPlane = (value: string | undefined): value is VatPlaneT =>
  VAT_PLANES.includes(value as VatPlaneT)

export function DepositForm({ referenceData, onSubmitSuccess, keepOpen }: DepositFormPropsT) {
  // COMPANY_FUNDING visible only to admin/owner — managers see other deposit types
  const depositTypes = isAdminOrOwnerRole(referenceData.currentUserRole)
    ? DEPOSIT_UI_TYPES
    : DEPOSIT_UI_TYPES.filter((t) => t !== 'COMPANY_FUNDING')

  // Fills the select only when it would otherwise be empty — a draft that already names an
  // investment keeps it, so navigating between investments never rewrites a half-filled form.
  const investmentFromUrl = useInvestmentFromUrl(referenceData.investments)

  const { form, reset } = useManagedForm<FormValuesT, CreateTransferFormT>({
    formId: FORM_ID,
    useFormStore: useDepositFormStore,
    schema: expenseFormSchema,
    defaultValues: {
      description: '',
      amount: '',
      date: today(),
      type: 'INVESTOR_DEPOSIT',
      paymentMethod: 'CASH',
      vatPlane: 'NET',
      sourceRegister: getDefaultCashRegister(referenceData),
      investment: investmentFromUrl,
    },
    mergeStored: (stored) => ({
      ...stored,
      investment: stored.investment || investmentFromUrl,
      // A draft saved before „nie określono" was removed carries a value the select no longer
      // offers, which would render the field blank — fall back to the netto default.
      vatPlane: isVatPlane(stored.vatPlane) ? stored.vatPlane : 'NET',
    }),
    keepOpen,
    successMessage: 'Wpłata dodana',
    onSubmitSuccess,
    action: createTransferAction,
    toData: (value) => ({
      description: value.description,
      amount: Number(value.amount),
      date: value.date,
      type: value.type as CreateTransferFormT['type'],
      paymentMethod: value.paymentMethod as PaymentMethodT,
      vatPlane: isVatPlane(value.vatPlane) ? value.vatPlane : undefined,
      sourceRegister: Number(value.sourceRegister),
      investment: value.investment ? Number(value.investment) : undefined,
    }),
  })

  const currentType = useStore(form.store, (s) => s.values.type)

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        {/* Type */}
        <form.AppField
          name="type"
          listeners={{
            onChange: () => {
              form.resetField('investment')
            },
          }}
        >
          {(field) => (
            <field.Select label="Typ wpłaty" showError>
              {depositTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRANSFER_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>

        {/* Directly under the type, same slot the wydatek form gives it — the investment is what the
            rest of the form is about, not a trailing detail. INVESTOR_DEPOSIT only; COMPANY_FUNDING
            hides it along with netto/brutto. */}
        {currentType === 'INVESTOR_DEPOSIT' && (
          <EntityComboboxField form={form} variant="investment" items={referenceData.investments} />
        )}

        <DescriptionField form={form} placeholder="Opis wpłaty" />

        <div className="flex items-start gap-4">
          <AmountField form={form} fieldClassName="min-w-0 flex-1" />
          <DateField form={form} fieldClassName="w-40" />
        </div>

        <CashRegisterField form={form} cashRegisters={referenceData.cashRegisters} />

        <PaymentMethodField form={form} />

        {currentType === 'INVESTOR_DEPOSIT' && <VatPlaneField form={form} />}
      </FieldGroup>

      <FormFooter className="mt-6" />
    </FormShell>
  )
}
