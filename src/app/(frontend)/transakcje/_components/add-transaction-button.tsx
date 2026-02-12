'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTransactionDialog } from '@/components/transactions/transaction-dialog-provider'

export function AddTransactionButton() {
  const dialog = useTransactionDialog()

  return (
    <Button variant="default" size="sm" className="gap-2" onClick={dialog.open}>
      <Plus className="size-4" />
      Nowa transakcja
    </Button>
  )
}
