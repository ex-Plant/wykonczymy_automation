'use client'

import { useState } from 'react'
import { Receipt } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import type { ReferenceDataT } from '@/components/dialogs/add-transaction-dialog'

const SettlementForm = dynamic(
  () =>
    import('@/components/settlements/settlement-form').then((m) => ({
      default: m.SettlementForm,
    })),
  {
    loading: () => (
      <p className="text-muted-foreground p-8 text-center text-sm">Ładowanie formularza...</p>
    ),
  },
)

type AddSettlementDialogPropsT = {
  referenceData: ReferenceDataT | undefined
  managerCashRegisterId?: number
}

export function AddSettlementDialog({
  referenceData,
  managerCashRegisterId,
}: AddSettlementDialogPropsT) {
  const [isOpen, setIsOpen] = useState(false)

  if (!referenceData) return <></>

  // Settlement form expects `users`, reference data has `workers` — same data
  const settlementReferenceData = {
    users: referenceData.workers,
    investments: referenceData.investments,
    cashRegisters: referenceData.cashRegisters,
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
        <Receipt className="size-4" />
        Rozliczenie
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="p-4">
            <DialogTitle>Rozliczenie pracownika</DialogTitle>
            <DialogDescription>
              Dodaj pozycje z faktury — każda stanie się osobną transakcją typu &quot;Wydatek
              pracowniczy&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-1">
            <SettlementForm
              referenceData={settlementReferenceData}
              managerCashRegisterId={managerCashRegisterId}
              onSuccess={() => setIsOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
