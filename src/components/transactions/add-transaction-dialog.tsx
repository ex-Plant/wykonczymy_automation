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
import { TransactionForm } from './transaction-form'

export type ReferenceItemT = { id: number; name: string }

export type ReferenceDataT = {
  cashRegisters: ReferenceItemT[]
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}

type AddTransactionDialogPropsT = {
  referenceData: ReferenceDataT
  variant?: 'default' | 'icon'
}

export function AddTransactionDialog({ referenceData }: AddTransactionDialogPropsT) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button variant="default" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
        <Plus className="size-4" />
        Nowa transakcja
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nowa transakcja</DialogTitle>
            <DialogDescription>Wypełnij formularz, aby dodać nową transakcję.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-1">
            <TransactionForm referenceData={referenceData} onSuccess={() => setIsOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
