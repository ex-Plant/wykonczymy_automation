'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { KosztorysSectionRow } from '@/components/kosztorys/editor/kosztorys-section-row'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'

type PropsT = {
  subtotals: SectionSubtotalT[]
  onClose: () => void
  onAddSection: () => void
  onAddItem: (sectionId: number) => void
  onRenameSection: (sectionId: number, name: string) => void
  onRemoveSection: (sectionId: number) => void
}

export function KosztorysSectionSummary({
  subtotals,
  onClose,
  onAddSection,
  onAddItem,
  onRenameSection,
  onRemoveSection,
}: PropsT) {
  const [pendingRemove, setPendingRemove] = useState<SectionSubtotalT | null>(null)

  return (
    <aside className="border-border bg-background absolute inset-y-0 right-0 z-30 flex w-72 flex-col overflow-hidden border-l shadow-lg">
      <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
        <h2 className="text-foreground text-sm font-medium">Sekcje</h2>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X />
        </Button>
      </div>

      <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
        {subtotals.map((subtotal) => (
          <KosztorysSectionRow
            key={subtotal.sectionId}
            subtotal={subtotal}
            onAddItem={onAddItem}
            onRenameSection={onRenameSection}
            onRequestRemove={setPendingRemove}
          />
        ))}
      </ul>

      <div className="border-border shrink-0 border-t p-2">
        <Button size="sm" variant="outline" className="w-full" onClick={onAddSection}>
          <Plus /> Nowa sekcja
        </Button>
      </div>

      <ConfirmDialog
        open={pendingRemove != null}
        title={`Usunąć sekcję „${pendingRemove?.sectionName}"?`}
        description={`Usunie też ${pendingRemove?.itemCount} pozycji wraz z wpisanymi w nich ilościami etapów. Tej operacji nie można cofnąć.`}
        confirmLabel="Usuń"
        onConfirm={() => {
          if (pendingRemove) onRemoveSection(pendingRemove.sectionId)
          setPendingRemove(null)
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </aside>
  )
}
