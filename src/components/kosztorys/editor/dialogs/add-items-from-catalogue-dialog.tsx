'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { insertCatalogueItemsAction } from '@/lib/actions/work-catalogue'
import { formatNet } from '@/lib/kosztorys/format'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'
import type { AppendedCatalogueSliceT } from '@/lib/kosztorys/work-catalogue/append-catalogue-items'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { cn } from '@/lib/utils/cn'
import { toastMessage } from '@/lib/utils/toast'
import { useWorkCatalogue } from './use-work-catalogue'

type PropsT = {
  sections: SectionSubtotalT[]
  open: boolean
  onOpenChange: (open: boolean) => void
  // The editor patches the grid from this rather than refetching the tree.
  onInserted: (slice: AppendedCatalogueSliceT['section']) => void
}

const searchText = (item: WorkCatalogueItemT) => `${item.description} ${item.category ?? ''}`

// „Dodaj → Praca z katalogu…". Selection is ordered, not a Set: the prace land in the rozpiska in the
// order they were ticked, and that is the only ordering the user has any control over.
export function AddItemsFromCatalogueDialog({ sections, open, onOpenChange, onInserted }: PropsT) {
  const { catalogue, resetCatalogue } = useWorkCatalogue(open)
  const [selected, setSelected] = useState<number[]>([])
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [pending, setPending] = useState(false)

  const {
    filteredData: filtered,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(catalogue ?? [], searchText)

  // No section is preselected — any default lands the praca where the user isn't looking. Names are
  // not unique, so the pozycja count is what tells two „Łazienka" apart.
  const sectionOptions = sections.map((section) => ({
    value: String(section.sectionId),
    label: `${section.sectionName} (${section.itemCount} poz.)`,
  }))

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelected([])
      setSectionId(null)
      resetCatalogue()
      setSearchTerm('')
    }
    onOpenChange(next)
  }

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleConfirm() {
    if (sectionId === null || selected.length === 0) return
    setPending(true)
    const res = await insertCatalogueItemsAction(sectionId, selected)
    setPending(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się dodać prac', 'error', 4000)
      return
    }
    toastMessage(selected.length === 1 ? 'Dodano pracę' : 'Dodano prace', 'success')
    // Warned, not refused: a katalog price the owner entered on purpose still goes in, but he is told
    // which praca crossed the ceiling.
    for (const warning of res.data.warnings) toastMessage(warning, 'error', 6000)
    handleOpenChange(false)
    onInserted(res.data.section)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader
          className="px-4 pt-4"
          title="Dodaj pracę z katalogu"
          description="Wybrane prace trafią na koniec sekcji z ceną i obiema stawkami z katalogu, bez przedmiaru."
        />
        <div className="space-y-2 px-4 py-3">
          <SimpleSelect
            value={sectionId === null ? '' : String(sectionId)}
            onValueChange={(value) => setSectionId(value ? Number(value) : null)}
            options={sectionOptions}
            placeholder="Wybierz sekcję…"
            className="w-full"
          />
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj pracy…"
            className="w-full"
          />
        </div>
        {catalogue === null ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Ładowanie katalogu…</p>
        ) : catalogue.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Katalog prac jest pusty.</p>
        ) : (
          <div className="max-h-[45vh] min-h-0 overflow-y-auto border-t py-2">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-sm">Nie znaleziono pracy.</p>
            ) : (
              filtered.map((item) => {
                const isSelected = selected.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-pressed={isSelected}
                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  >
                    <Check className={cn(isSelected ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1 truncate">
                      {item.description}
                      {item.category && (
                        <span className="text-muted-foreground"> · {item.category}</span>
                      )}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {formatNet(item.clientPrice)} / {item.unit}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        )}
        <DialogActions
          className="px-4 pt-3 pb-4"
          confirmLabel={`Dodaj${selected.length > 0 ? ` (${selected.length})` : ''}`}
          onConfirm={() => void handleConfirm()}
          onCancel={() => handleOpenChange(false)}
          confirmDisabled={selected.length === 0 || sectionId === null || pending}
        />
      </DialogContent>
    </Dialog>
  )
}
