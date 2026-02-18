'use client'

import type { ReferenceDataT } from '@/components/dialogs/add-transfer-dialog'
import dynamic from 'next/dynamic'
import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { logoutAction } from '@/lib/actions/auth'

const AddTransferDialog = dynamic(() =>
  import('@/components/dialogs/add-transfer-dialog').then((m) => ({
    default: m.AddTransferDialog,
  })),
)

const AddSettlementDialog = dynamic(() =>
  import('@/components/dialogs/add-settlement-dialog').then((m) => ({
    default: m.AddSettlementDialog,
  })),
)

type TopNavPropsT = {
  referenceData?: ReferenceDataT
  managerCashRegisterId?: number
}

export function TopNav({ referenceData, managerCashRegisterId }: TopNavPropsT) {
  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b px-3">
      {/* Left: app name */}
      <span className="text-lg font-semibold">Wykonczymy</span>

      {/* Right: action buttons + logout */}
      <div className="flex items-center gap-2">
        {referenceData && (
          <>
            <AddSettlementDialog
              referenceData={referenceData}
              managerCashRegisterId={managerCashRegisterId}
            />
            <AddTransferDialog referenceData={referenceData} />
          </>
        )}
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors disabled:opacity-50"
          aria-label="Wyloguj"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  )
}
