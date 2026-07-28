'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import {
  appendPresetSectionsAction,
  listPresetSectionsAction,
} from '@/lib/actions/kosztorys-presets'
import { useSearchFilter } from '@/hooks/use-search-filter'
import type { AppendedSliceT } from '@/lib/kosztorys/append-preset-sections'
import type { PresetSectionMetaT } from '@/lib/db/presets'
import { cn } from '@/lib/utils/cn'
import { pluralize } from '@/lib/utils/polish-plural'
import { toastMessage } from '@/lib/utils/toast'
import { groupPresetSections, metaKey, type PresetGroupT } from './preset-picker-groups'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // The editor patches the grid from this rather than refetching the tree.
  onAppended: (slice: AppendedSliceT) => void
}

const getPresetName = (group: PresetGroupT) => group.presetName

const sekcjeNoun = (count: number) => pluralize(count, ['sekcja', 'sekcje', 'sekcji'])

// Selection is cumulative across szablony and confirms once.
export function AddSectionsFromPresetDialog({
  investmentId,
  open,
  onOpenChange,
  onAppended,
}: PropsT) {
  // null = not yet loaded (distinct from [] = loaded-but-empty), so the „Brak szablonów" empty-state
  // never flashes during the fetch and a failed load isn't mistaken for a genuinely empty library.
  const [sections, setSections] = useState<PresetSectionMetaT[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activePresetId, setActivePresetId] = useState<number | null>(null)
  // Below `sm` (48rem — this repo overrides the scale) only one pane fits, so this drives which of
  // the two is shown. Both stay mounted at every width — above `sm` the state is inert.
  const [pane, setPane] = useState<'presets' | 'sections'>('presets')
  const [pending, setPending] = useState(false)

  const groups = groupPresetSections(sections ?? [], selected)
  const {
    filteredData: filteredGroups,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(groups, getPresetName)
  // Falling back to the first szablon keeps the right pane filled from the moment the list lands,
  // without an effect that writes state during render.
  const activeGroup = groups.find((group) => group.presetId === activePresetId) ?? groups[0]

  // Fetch-on-open: the picker can be opened programmatically (from the „Dodaj" menu item, bypassing
  // Radix's own open trigger), so syncing the load to the `open` prop is the one reliable seam. Only
  // the async list write happens here — the reset-to-null lives in the close handler (a synchronous
  // setState in an effect body is a cascading-render smell the lint forbids).
  useEffect(() => {
    if (!open) return
    // A close-then-reopen while the first load is in flight would otherwise resolve into the reset
    // state — showing a stale list, or toasting an error at a dialog nobody is looking at.
    let stale = false
    const fail = (message: string) => {
      if (stale) return
      setSections([])
      toastMessage(message, 'error', 4000)
    }
    void listPresetSectionsAction()
      .then((res) => {
        if (stale) return
        if (res.success) setSections(res.data)
        else fail(res.error ?? 'Nie udało się wczytać szablonów')
      })
      // A transport-level RPC rejection never resolves to {success:false}; without this „Ładowanie
      // szablonów…" hangs forever on a dropped request.
      .catch(() => fail('Nie udało się wczytać szablonów'))
    return () => {
      stale = true
    }
  }, [open])

  // Every close routes through here (cancel / esc / overlay / post-confirm), so resetting on close
  // guarantees the next open re-fetches fresh instead of showing the previous list — without an
  // in-effect setState.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelected(new Set())
      setSections(null)
      setActivePresetId(null)
      setPane('presets')
      setSearchTerm('')
    }
    onOpenChange(next)
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Loading a whole szablon into an empty kosztorys is the common case, so it stays one click.
  function toggleGroup(keys: string[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (keys.every((key) => next.has(key))) keys.forEach((key) => next.delete(key))
      else keys.forEach((key) => next.add(key))
      return next
    })
  }

  async function handleConfirm() {
    const selections = (sections ?? [])
      .filter((meta) => selected.has(metaKey(meta)))
      .map((meta) => ({ presetId: meta.presetId, sectionId: meta.sectionId }))
    if (selections.length === 0) return
    setPending(true)
    const res = await appendPresetSectionsAction(investmentId, selections)
    setPending(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się dodać sekcji', 'error', 4000)
      return
    }
    toastMessage(selections.length === 1 ? 'Dodano sekcję' : 'Dodano sekcje', 'success')
    handleOpenChange(false)
    onAppended(res.data)
  }

  const count = selected.size
  const allActiveSelected =
    activeGroup.metas.length > 0 && activeGroup.selectedCount === activeGroup.metas.length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader
          className="px-4 pt-4"
          title="Dodaj sekcję z szablonu"
          description="Wybierz sekcje z zapisanych szablonów. Zostaną dodane z pracami i cenami, bez przedmiaru."
        />
        {sections === null ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Ładowanie szablonów…</p>
        ) : sections.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Brak zapisanych szablonów.</p>
        ) : (
          <div className="mt-3 flex max-h-[55vh] min-h-0 border-t">
            <div
              className={cn(
                'w-full flex-col sm:flex sm:w-1/2',
                pane === 'presets' ? 'flex' : 'hidden',
              )}
            >
              <div className="p-2">
                <SearchFilterInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Szukaj szablonu…"
                  inputClassName="w-full lg:w-full"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredGroups.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-4 text-sm">
                    Nie znaleziono szablonu.
                  </p>
                ) : (
                  filteredGroups.map((group) => (
                    <button
                      key={group.presetId}
                      type="button"
                      // Ticking a whole szablon goes through „Zaznacz wszystkie", not this row.
                      onClick={() => {
                        setActivePresetId(group.presetId)
                        setPane('sections')
                      }}
                      aria-current={group.presetId === activeGroup.presetId}
                      className={cn(
                        'hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                        group.presetId === activeGroup.presetId && 'bg-accent',
                      )}
                    >
                      <span className="flex-1 truncate">{group.presetName}</span>
                      {group.selectedCount > 0 && (
                        <span className="text-primary text-xs font-medium">
                          {group.selectedCount}/{group.metas.length}
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {group.metas.length} {sekcjeNoun(group.metas.length)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div
              className={cn(
                'w-full flex-col sm:flex sm:w-1/2 sm:border-l',
                pane === 'sections' ? 'flex' : 'hidden',
              )}
            >
              {/* The name shows at every width, not only as the drill-in's back label: with the left
                pane filtered, the highlighted row can be off-screen, and „Zaznacz wszystkie" must
                never be ambiguous about which szablon it fills. */}
              <button
                type="button"
                onClick={() => setPane('presets')}
                className="hover:bg-accent flex items-center gap-1 border-b px-3 py-2 text-left text-sm sm:hidden"
              >
                <ChevronLeft />
                <span className="truncate">{activeGroup.presetName}</span>
              </button>
              <p className="hidden truncate border-b px-3 py-2 text-sm font-medium sm:block">
                {activeGroup.presetName}
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto py-2">
                {/* Lives in the unfiltered pane by construction: mass-select can never reach sekcje
                  the user cannot see. */}
                <button
                  type="button"
                  onClick={() => toggleGroup(activeGroup.metas.map(metaKey))}
                  aria-pressed={allActiveSelected}
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  <Check className={cn(allActiveSelected ? 'opacity-100' : 'opacity-0')} />
                  <span className="text-muted-foreground flex-1 text-xs">
                    {allActiveSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                  </span>
                </button>
                {activeGroup.metas.map((meta) => {
                  const key = metaKey(meta)
                  const isSelected = selected.has(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(key)}
                      aria-pressed={isSelected}
                      className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    >
                      <Check className={cn(isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 truncate">{meta.sectionName}</span>
                      <span className="text-muted-foreground text-xs">{meta.itemCount} poz.</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        <DialogActions
          className="px-4 pt-3 pb-4"
          confirmLabel={`Dodaj${count > 0 ? ` (${count})` : ''}`}
          onConfirm={() => void handleConfirm()}
          onCancel={() => handleOpenChange(false)}
          confirmDisabled={count === 0 || pending}
        />
      </DialogContent>
    </Dialog>
  )
}
