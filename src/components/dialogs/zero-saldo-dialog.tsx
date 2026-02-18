'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
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
import { zeroSaldoAction } from '@/lib/actions/settlements'
import { zeroSaldoFormSchema, type ZeroSaldoFormT } from '@/lib/schemas/settlements'

type ZeroSaldoDialogPropsT = {
  saldo: number
  workerId: number
  managerCashRegisterId?: number
  referenceData: {
    investments: { id: number; name: string }[]
    cashRegisters: { id: number; name: string }[]
  }
}

type FormValuesT = {
  investment: string
  cashRegister: string
  paymentMethod: string
}

export function ZeroSaldoDialog({
  saldo,
  workerId,
  managerCashRegisterId,
  referenceData,
}: ZeroSaldoDialogPropsT) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const isRegisterLocked = managerCashRegisterId !== undefined

  const form = useAppForm({
    defaultValues: {
      investment: '',
      cashRegister: isRegisterLocked ? String(managerCashRegisterId) : '',
      paymentMethod: 'CASH',
    } as FormValuesT,
    validators: {
      onSubmit: zeroSaldoFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: ZeroSaldoFormT = {
        worker: workerId,
        investment: Number(value.investment),
        cashRegister: Number(value.cashRegister),
        paymentMethod: value.paymentMethod as PaymentMethodT,
        amount: saldo,
      }

      const result = await zeroSaldoAction(data)

      if (result.success) {
        toastMessage('Saldo zostało wyzerowane', 'success')
        setIsOpen(false)
        router.refresh()
      } else {
        toastMessage(result.error, 'error')
      }

      return false
    },
  })

  useCheckFormErrors(form)

  const { isInvalid, isSubmitting } = useFormStatus(form)

  if (saldo <= 0) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Zeruj saldo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zeruj saldo pracownika</DialogTitle>
          <DialogDescription>
            Zostanie utworzony transfer &quot;Wydatek pracowniczy&quot; na kwotę {formatPLN(saldo)},
            zerując saldo.
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldGroup>
              <p className="text-sm">
                Aktualne saldo: <span className="font-semibold">{formatPLN(saldo)}</span>
              </p>

              <form.AppField name="investment">
                {(field) => (
                  <field.Select label="Inwestycja" placeholder="Wybierz inwestycję" showError>
                    {referenceData.investments.map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </field.Select>
                )}
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
            </FieldGroup>

            {isInvalid && (
              <p className="text-destructive mt-2 text-sm font-medium">Formularz zawiera błędy</p>
            )}

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Przetwarzanie...' : `Zeruj saldo — ${formatPLN(saldo)}`}
              </Button>
            </DialogFooter>
            <Loader loading={isSubmitting} portal />
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}
