'use client'

import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'

/**
 * The frame both sheet windows sit in. Shared for the two sentences it owns rather than for the
 * markup: „Czytam arkusz Google…" and „Nie udało się odczytać arkusza Google." are the only thing
 * the owner sees when a read is slow or a sheet is unreachable, and written twice they would have
 * drifted into two different accounts of the same failure.
 *
 * `data` renders through a callback because the blocks below read it unconditionally — passed as
 * plain children they would be built before the null check that guards them.
 */
export function SheetReportDialog<DataT>({
  open,
  onOpenChange,
  title,
  description,
  loaded,
  data,
  actions,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  loaded: boolean
  data: DataT | null
  actions?: ReactNode
  children: (data: DataT) => ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader title={title} description={description} />

        {!loaded ? (
          <p className="text-muted-foreground text-sm">Czytam arkusz Google…</p>
        ) : !data ? (
          <p className="text-destructive text-sm">Nie udało się odczytać arkusza Google.</p>
        ) : (
          <div className="space-y-5 text-sm">{children(data)}</div>
        )}

        {actions}
      </DialogContent>
    </Dialog>
  )
}
