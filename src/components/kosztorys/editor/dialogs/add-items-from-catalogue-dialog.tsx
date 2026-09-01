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
import {
  kosztorysCatalogueKeys,
  partitionAlreadyInKosztorys,
  type KosztorysItemRefT,
} from '@/lib/kosztorys/work-catalogue/already-in-kosztorys'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'
import type {
  AppendedCatalogueSliceT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import { toastMessage } from '@/lib/utils/toast'
import { useWorkCatalogue } from '@/components/kosztorys/editor/dialogs/use-work-catalogue'

type PropsT = {
  sections: SectionSubtotalT[]
  // The WHOLE rozpiska, so „Ukryj już dodane" answers for the kosztorys and not for one sekcja —
  // the same praca legitimately sits in several pokoje, and the owner wants all of them out of view.
  kosztorysItems: readonly KosztorysItemRefT[]
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

// Selection is ordered, not a Set: the prace land in the rozpiska in the order they were ticked,
// which sorting the table does not touch.
export function AddItemsFromCatalogueDialog({
  sections,
  kosztorysItems,
  initialSectionId = null,
  open,
  onOpenChange,
  onInserted,
}: PropsT) {
  const { catalogue } = useWorkCatalogue(open)
  const [selected, setSelected] = useState<number[]>([])
  const [sectionId, setSectionId] = useState<number | null>(initialSectionId)
  const [hideAlreadyAdded, setHideAlreadyAdded] = useState(true)
  const [pending, setPending] = useState(false)

  const {
    filteredData: filtered,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(catalogue ?? [], searchText)

  // Cached on the rozpiska alone, so a keystroke in the szukajka costs Set lookups and not a re-fold
  // of the whole kosztorys.
  const takenKeys = kosztorysCatalogueKeys(kosztorysItems)
  // Split AFTER the szukajka, so the „(N)" counts what this phrase is hiding rather than the whole
  // cennik — a number about rows the owner cannot see anyway would read as a defect.
  const { fresh, alreadyAdded } = partitionAlreadyInKosztorys(filtered, takenKeys)
  // A ticked praca is never hidden, even when it is already in the kosztorys: the owner reached it by
  // unchecking the switch on purpose, and hiding it would leave it counting into „Dodaj (N)" and
  // landing in the rozpiska with no row on screen to untick.
  const keptSelected = alreadyAdded.filter((item) => selected.includes(item.id))
  const visible = hideAlreadyAdded ? [...fresh, ...keptSelected] : filtered
  const hiddenCount = alreadyAdded.length - keptSelected.length

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
    // try/finally, not a bare await: a transport-level rejection (dropped connection, a client still
    // holding a redeployed build's action id) never resolves to `{success:false}`, and without this
    // „Dodaj" stays disabled for good with nothing said on screen.
    let res
    try {
      res = await insertCatalogueItemsAction(sectionId, selected)
    } catch {
      toastMessage('Nie udało się dodać prac — spróbuj ponownie', 'error', 4000)
      return
    } finally {
      setPending(false)
    }
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
        <div className="flex items-center gap-4 px-4 py-3">
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj pracy…"
            className="min-w-0 flex-1"
          />
          {/* Hidden, never removed: a praca that silently vanishes from the cennik reads as a gap in
              the katalog, so the count stays on screen and the switch stays reachable. The count is
              withheld until the cennik is in — „(0)" over „Ładowanie katalogu…" is a confident answer
              to a question nobody has asked yet. */}
          <label className="text-muted-foreground flex shrink-0 items-center gap-2 text-sm">
            <Checkbox
              checked={hideAlreadyAdded}
              onCheckedChange={(checked) => setHideAlreadyAdded(checked === true)}
            />
            Ukryj już dodane{catalogue !== null && ` (${hiddenCount})`}
          </label>
        </div>
        {catalogue === null ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Ładowanie katalogu…</p>
        ) : catalogue.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Katalog prac jest pusty.</p>
        ) : (
          <div className="max-h-[55vh] min-h-0 overflow-y-auto px-4 pb-3">
            <SelectedIdsContext value={selected}>
              <DataTable data={visible} columns={columns} initialSorting={INITIAL_SORTING} />
            </SelectedIdsContext>
          </div>
        )}
        {/* The sekcja is the last decision, taken once the prace are picked. */}
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
