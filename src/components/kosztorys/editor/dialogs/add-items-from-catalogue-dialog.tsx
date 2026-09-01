'use client'

import { createContext, use, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/ui/data-table/data-table'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { WORK_CATALOGUE_PICKER_COLUMNS } from '@/components/tables/work-catalogue'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { insertCatalogueItemsAction } from '@/lib/actions/work-catalogue'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'
import type { AppendedCatalogueSliceT } from '@/lib/kosztorys/work-catalogue/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { toastMessage } from '@/lib/utils/toast'
import { useWorkCatalogue } from './use-work-catalogue'

type PropsT = {
  sections: SectionSubtotalT[]
  // Set when the picker was opened from a row's menu — that row's section is the answer already.
  initialSectionId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  // The editor patches the grid from this rather than refetching the tree.
  onInserted: (slice: AppendedCatalogueSliceT['section']) => void
}

const col = createColumnHelper<WorkCatalogueItemT>()

// Kategoria first so prace of one trade arrive together, then the opis inside it — the browsing
// order, where /katalog-prac defaults to the opis because it is used to find one known row.
const INITIAL_SORTING = [
  { id: 'category', desc: false },
  { id: 'description', desc: false },
]

const searchText = (item: WorkCatalogueItemT) => `${item.description} ${item.category ?? ''}`

const SelectedIdsContext = createContext<readonly number[]>([])

// A context consumer, not a `checked` prop: DataTable memoises a row's cells on the TanStack row
// object, which ticking a checkbox does not touch — so a prop would never arrive. React re-renders
// a consumer through a memoised parent, which is the one path into an already-cached cell.
function SelectCell({
  item,
  onToggle,
}: {
  item: WorkCatalogueItemT
  onToggle: (id: number) => void
}) {
  const selected = use(SelectedIdsContext)
  return (
    <Checkbox
      checked={selected.includes(item.id)}
      onCheckedChange={() => onToggle(item.id)}
      aria-label={item.description}
    />
  )
}

// „Dodaj → Praca z katalogu…" — the same table as /katalog-prac, with a checkbox instead of the edit
// actions. Selection is ordered, not a Set: the prace land in the rozpiska in the order they were
// ticked, which sorting the table does not touch.
export function AddItemsFromCatalogueDialog({
  sections,
  initialSectionId = null,
  open,
  onOpenChange,
  onInserted,
}: PropsT) {
  const { catalogue } = useWorkCatalogue(open)
  const [selected, setSelected] = useState<number[]>([])
  const [sectionId, setSectionId] = useState<number | null>(initialSectionId)
  const [pending, setPending] = useState(false)

  const {
    filteredData: filtered,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(catalogue ?? [], searchText)

  // Nothing is preselected when the picker is opened from the toolbar — any default lands the praca
  // where the user isn't looking.
  const sectionOptions = sections.map((section) => ({
    value: String(section.sectionId),
    label: section.sectionName,
  }))

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const columns = [
    col.display({
      id: 'select',
      header: '',
      cell: (info) => <SelectCell item={info.row.original} onToggle={toggle} />,
    }),
    ...WORK_CATALOGUE_PICKER_COLUMNS,
  ]

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
    onOpenChange(false)
    onInserted(res.data.section)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="px-4 pt-4" title="Dodaj pracę z katalogu" />
        <SearchFilterInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Szukaj pracy…"
          className="mx-4 my-3"
        />
        {catalogue === null ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Ładowanie katalogu…</p>
        ) : catalogue.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Katalog prac jest pusty.</p>
        ) : (
          <div className="max-h-[55vh] min-h-0 overflow-y-auto px-4 pb-3">
            <SelectedIdsContext value={selected}>
              <DataTable data={filtered} columns={columns} initialSorting={INITIAL_SORTING} />
            </SelectedIdsContext>
          </div>
        )}
        {/* The sekcja sits next to „Dodaj", not above the list: it is the last decision, taken once
            the prace are picked. */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-muted-foreground shrink-0 text-sm">Dodaj do:</span>
            <SimpleSelect
              value={sectionId === null ? '' : String(sectionId)}
              onValueChange={(value) => setSectionId(value ? Number(value) : null)}
              options={sectionOptions}
              placeholder="Wybierz sekcję…"
              className="w-56"
            />
          </div>
          <DialogActions
            className="p-0"
            confirmLabel={`Dodaj${selected.length > 0 ? ` (${selected.length})` : ''}`}
            onConfirm={() => void handleConfirm()}
            onCancel={() => onOpenChange(false)}
            confirmDisabled={selected.length === 0 || sectionId === null || pending}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
