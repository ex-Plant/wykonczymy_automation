'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { TransactionForm } from './transaction-form'

export type ReferenceItemT = { id: number; name: string }

export type ReferenceDataT = {
  cashRegisters: ReferenceItemT[]
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}

type TransactionDialogContextT = {
  open: () => void
  close: () => void
}

const TransactionDialogContext = createContext<TransactionDialogContextT | undefined>(undefined)

export function useTransactionDialog() {
  const ctx = useContext(TransactionDialogContext)
  if (!ctx) throw new Error('useTransactionDialog must be used within TransactionDialogProvider')
  return ctx
}

type ProviderPropsT = {
  referenceData: ReferenceDataT
  children: ReactNode
}

export function TransactionDialogProvider({ referenceData, children }: ProviderPropsT) {
  const [isOpen, setIsOpen] = useState(false)

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)

  return (
    <TransactionDialogContext value={{ open, close }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nowa transakcja</DialogTitle>
            <DialogDescription>Wypełnij formularz, aby dodać nową transakcję.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-1">
            <TransactionForm referenceData={referenceData} onSuccess={close} />
          </div>
        </DialogContent>
      </Dialog>
    </TransactionDialogContext>
  )
}
