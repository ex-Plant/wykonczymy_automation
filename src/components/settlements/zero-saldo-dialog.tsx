'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toastMessage } from '@/components/toasts'
import { formatPLN } from '@/lib/format-currency'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodT,
} from '@/lib/constants/transactions'
import { zeroSaldoAction } from '@/lib/actions/settlements'

type ZeroSaldoDialogPropsT = {
  saldo: number
  workerId: number
  managerCashRegisterId?: number
  referenceData: {
    investments: { id: number; name: string }[]
    cashRegisters: { id: number; name: string }[]
  }
}

export function ZeroSaldoDialog({
  saldo,
  workerId,
  managerCashRegisterId,
  referenceData,
}: ZeroSaldoDialogPropsT) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)

  const isRegisterLocked = managerCashRegisterId !== undefined

  const [investment, setInvestment] = useState('')
  const [cashRegister, setCashRegister] = useState(
    isRegisterLocked ? String(managerCashRegisterId) : '',
  )
  const [paymentMethod, setPaymentMethod] = useState('CASH')

  const handleConfirm = () => {
    const formData = new FormData()
    formData.set('worker', String(workerId))
    formData.set('investment', investment)
    formData.set('cashRegister', cashRegister)
    formData.set('paymentMethod', paymentMethod)
    formData.set('amount', String(saldo))

    startTransition(async () => {
      const result = await zeroSaldoAction(formData)
      if (result.success) {
        toastMessage('Saldo zostało wyzerowane', 'success')
        setIsOpen(false)
        router.refresh()
      } else {
        toastMessage(result.error, 'error')
      }
    })
  }

  if (saldo <= 0) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Zeruj saldo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zeruj saldo pracownika</DialogTitle>
          <DialogDescription>
            Zostanie utworzona transakcja &quot;Wydatek pracowniczy&quot; na kwotę{' '}
            {formatPLN(saldo)}, zerując saldo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm">
            Aktualne saldo: <span className="font-semibold">{formatPLN(saldo)}</span>
          </p>

          <div className="space-y-2">
            <Label>Inwestycja</Label>
            <Select value={investment} onValueChange={setInvestment}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz inwestycję" />
              </SelectTrigger>
              <SelectContent>
                {referenceData.investments.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Kasa</Label>
            <Select
              value={cashRegister}
              onValueChange={setCashRegister}
              disabled={isRegisterLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz kasę" />
              </SelectTrigger>
              <SelectContent>
                {referenceData.cashRegisters.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Metoda płatności</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz metodę" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method as PaymentMethodT]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPending}>
            Anuluj
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Przetwarzanie...' : `Zeruj saldo — ${formatPLN(saldo)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
