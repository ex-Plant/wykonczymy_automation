'use client'

import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layouts/sidebar/sidebar'
import {
  TransactionDialogProvider,
  useTransactionDialog,
  type ReferenceDataT,
} from '@/components/transactions/transaction-dialog-provider'
import type { RoleT } from '@/collections/users'

type LayoutShellPropsT = {
  user: { name: string; email: string; role: RoleT }
  referenceData: ReferenceDataT | undefined
  children: ReactNode
}

export function LayoutShell({ user, referenceData, children }: LayoutShellPropsT) {
  if (referenceData) {
    return (
      <TransactionDialogProvider referenceData={referenceData}>
        <ShellInner user={user}>{children}</ShellInner>
      </TransactionDialogProvider>
    )
  }

  // EMPLOYEE — no dialog provider needed
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

function ShellInner({
  user,
  children,
}: {
  user: { name: string; email: string; role: RoleT }
  children: ReactNode
}) {
  const dialog = useTransactionDialog()

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} onAddTransaction={dialog.open} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
