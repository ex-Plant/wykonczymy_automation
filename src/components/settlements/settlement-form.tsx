'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toastMessage } from '@/components/toasts'
import { formatPLN } from '@/lib/format-currency'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethodT } from '@/lib/constants/transactions'
import { getEmployeeSaldo, createSettlement } from '@/lib/settlements/actions'

type ReferenceDataT = {
  users: { id: number; name: string }[]
  investments: { id: number; name: string }[]
  cashRegisters: { id: number; name: string }[]
}

type LineItemT = {
  id: string
  description: string
  amount: string
}

type SettlementFormPropsT = {
  referenceData: ReferenceDataT
}

const createEmptyLineItem = (): LineItemT => ({
  id: crypto.randomUUID(),
  description: '',
  amount: '',
})

export function SettlementForm({ referenceData }: SettlementFormPropsT) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Shared metadata
  const [worker, setWorker] = useState('')
  const [investment, setInvestment] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [cashRegister, setCashRegister] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  // Line items
  const [lineItems, setLineItems] = useState<LineItemT[]>([createEmptyLineItem()])

  // Invoice
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceNote, setInvoiceNote] = useState('')

  // Employee saldo
  const [saldo, setSaldo] = useState<number | null>(null)
  const [isSaldoLoading, setIsSaldoLoading] = useState(false)

  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const handleWorkerChange = async (value: string) => {
    setWorker(value)
    setSaldo(null)

    if (!value) return

    setIsSaldoLoading(true)
    try {
      const result = await getEmployeeSaldo(Number(value))
      setSaldo(result.saldo)
    } catch {
      toastMessage('Nie udało się pobrać salda', 'error')
    } finally {
      setIsSaldoLoading(false)
    }
  }

  const updateLineItem = (id: string, field: 'description' | 'amount', value: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
  }

  const addLineItem = () => {
    setLineItems((prev) => [...prev, createEmptyLineItem()])
  }

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSubmit = () => {
    const formData = new FormData()
    formData.set('worker', worker)
    formData.set('investment', investment)
    formData.set('date', date)
    formData.set('cashRegister', cashRegister)
    formData.set('paymentMethod', paymentMethod)
    formData.set('lineItems', JSON.stringify(lineItems.map(({ description, amount }) => ({ description, amount }))))
    if (invoiceFile) formData.set('invoice', invoiceFile)
    if (invoiceNote) formData.set('invoiceNote', invoiceNote)

    startTransition(async () => {
      const result = await createSettlement(formData)
      if (result.success) {
        toastMessage(`Utworzono ${result.count} transakcji`, 'success')
        router.push('/transakcje')
      } else {
        toastMessage(result.error, 'error')
      }
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Employee selector */}
      <div className="space-y-2">
        <Label>Pracownik</Label>
        <Select value={worker} onValueChange={handleWorkerChange}>
          <SelectTrigger>
            <SelectValue placeholder="Wybierz pracownika" />
          </SelectTrigger>
          <SelectContent>
            {referenceData.users.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSaldoLoading && (
          <p className="text-muted-foreground text-sm">Ładowanie salda...</p>
        )}
        {saldo !== null && !isSaldoLoading && (
          <p className="text-sm">
            Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
          </p>
        )}
      </div>

      {/* Shared metadata */}
      <div className="grid grid-cols-2 gap-4">
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
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Kasa</Label>
          <Select value={cashRegister} onValueChange={setCashRegister}>
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

      {/* Line items */}
      <div className="space-y-3">
        <Label>Pozycje faktury</Label>
        {lineItems.map((item, index) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="text-muted-foreground flex h-9 items-center text-sm">
              {index + 1}.
            </span>
            <Input
              placeholder="Opis pozycji"
              value={item.description}
              onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Kwota"
              value={item.amount}
              onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)}
              className="w-36"
              min="0"
              step="0.01"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeLineItem(item.id)}
              disabled={lineItems.length === 1}
              aria-label="Usuń pozycję"
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
          Dodaj pozycję
        </Button>
        <p className="text-foreground text-sm font-medium">
          Suma: {formatPLN(total)}
        </p>
      </div>

      {/* Invoice */}
      <div className="space-y-3">
        <Label>Faktura</Label>
        <Input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
        />
        <div className="space-y-2">
          <Label>Notatka do faktury</Label>
          <Textarea
            placeholder="Notatka (opcjonalna, jeśli dołączono plik)"
            value={invoiceNote}
            onChange={(e) => setInvoiceNote(e.target.value)}
          />
        </div>
      </div>

      {/* Summary */}
      {saldo !== null && (
        <div className="bg-muted/50 border-border space-y-1 rounded-lg border px-6 py-4">
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
      <Button onClick={handleSubmit} disabled={isPending}>
        {isPending ? 'Przetwarzanie...' : `Rozlicz (${lineItems.length} pozycji)`}
      </Button>
    </div>
  )
}
