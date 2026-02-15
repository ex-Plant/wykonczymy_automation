'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'

const TransactionForm = dynamic(
  () =>
    import('@/components/transactions/transaction-form').then((m) => ({
      default: m.TransactionForm,
    })),
  {
    loading: () => (
      <p className="text-muted-foreground p-8 text-center text-sm">Ładowanie formularza...</p>
    ),
  },
)

export type ReferenceItemT = { id: number; name: string }

export type ReferenceDataT = {
  cashRegisters: ReferenceItemT[]
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}

type AddTransactionDialogPropsT = {
  referenceData: ReferenceDataT | undefined
  managerCashRegisterId?: number
  variant?: 'default' | 'icon'
}

export function AddTransactionDialog({
  referenceData,
  managerCashRegisterId,
}: AddTransactionDialogPropsT) {
  const [isOpen, setIsOpen] = useState(false)

  if (!referenceData) return <></>

  return (
    <>
      <Button variant="default" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
        <Plus className="size-4" />
        Nowa transakcja
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className={`p-4`}>
            <DialogTitle>Nowa transakcja</DialogTitle>
            <DialogDescription>Wypełnij formularz, aby dodać nową transakcję.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-1">
            <TransactionForm
              referenceData={referenceData}
              managerCashRegisterId={managerCashRegisterId}
              onSuccess={() => setIsOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
