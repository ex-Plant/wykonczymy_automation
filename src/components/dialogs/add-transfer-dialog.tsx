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

const TransferForm = dynamic(
  () =>
    import('@/components/forms/transfer-form/transfer-form').then((m) => ({
      default: m.TransferForm,
    })),
  {
    loading: () => (
      <p className="text-muted-foreground p-8 text-center text-sm">Ładowanie formularza...</p>
    ),
  },
)

export type ReferenceItemT = { id: number; name: string; type?: string }

export type ReferenceDataT = {
  cashRegisters: ReferenceItemT[]
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}

type AddTransferDialogPropsT = {
  referenceData: ReferenceDataT | undefined
  managerCashRegisterId?: number
  variant?: 'default' | 'icon'
}

export function AddTransferDialog({
  referenceData,
  managerCashRegisterId,
}: AddTransferDialogPropsT) {
  const [isOpen, setIsOpen] = useState(false)

  if (!referenceData) return <></>

  return (
    <>
      <Button variant="default" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
        <Plus className="size-4" />
        Nowy transfer
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className={`p-4`}>
            <DialogTitle>Nowy transfer</DialogTitle>
            <DialogDescription>Wypełnij formularz, aby dodać nowy transfer.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-1">
            <TransferForm
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
