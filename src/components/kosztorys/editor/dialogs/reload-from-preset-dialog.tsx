'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { listPresetSectionsAction, reloadFromPresetAction } from '@/lib/actions/kosztorys-presets'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import type { PresetSectionMetaT } from '@/lib/db/presets'
import { cn } from '@/lib/utils/cn'
import { pluralize } from '@/lib/utils/polish-plural'
import { toastMessage } from '@/lib/utils/toast'
import { groupPresetSections, type PresetGroupT } from './preset-picker-groups'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onReloaded: () => void
}

const sekcjeNoun = (count: number) => pluralize(count, ['sekcja', 'sekcje', 'sekcji'])
const praceNoun = (count: number) => pluralize(count, ['praca', 'prace', 'prac'])

const countItems = (group: PresetGroupT) =>
  group.metas.reduce((total, meta) => total + meta.itemCount, 0)

const summary = (sections: number, items: number) =>
  `${sections} ${sekcjeNoun(sections)} · ${items} ${praceNoun(items)}`

// „Wczytaj szablon…" — swap the whole rozpiska for a saved one. The counterpart to „Dodaj sekcję z
// szablonu", which appends; this one replaces, so both counts are stated before the confirm.
export function ReloadFromPresetDialog({ investmentId, open, onOpenChange, onReloaded }: PropsT) {
  const { tree } = useKosztorysEditorContext()
  // null = not yet loaded, distinct from [] = loaded-but-empty, so „Brak zapisanych szablonów" never
  // flashes mid-fetch and a failed load isn't mistaken for an empty library.
  const [sections, setSections] = useState<PresetSectionMetaT[] | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const groups = groupPresetSections(sections ?? [], new Set())
  const selected = groups.find((group) => group.presetId === selectedPresetId)

  // Fetch-on-open: opened programmatically from the „Opcje" menu, so Radix's own open trigger never
  // fires and the `open` prop is the only reliable seam.
  useEffect(() => {
    if (!open) return
    // A close-then-reopen while the first load is in flight would otherwise resolve into the reset
    // state — a stale list, or an error toast at a dialog nobody is looking at.
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
      // A transport-level rejection never resolves to {success:false}; without this the loading state
      // hangs forever on a dropped request.
      .catch(() => fail('Nie udało się wczytać szablonów'))
    return () => {
      stale = true
    }
  }, [open])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSections(null)
      setSelectedPresetId(null)
    }
    onOpenChange(next)
  }

  function handleConfirm() {
    if (!selected) return
    startTransition(async () => {
      const result = await reloadFromPresetAction(investmentId, selected.presetId)
      if (!result.success) {
        toastMessage(result.error, 'error', 6000)
        return
      }
      toastMessage(`Wczytano: ${summary(result.data.sections, result.data.items)}`, 'success')
      handleOpenChange(false)
      onReloaded()
    })
  }

  const currentSections = tree.sections.length
  const currentItems = tree.sections.reduce((total, section) => total + section.items.length, 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader
          title="Wczytaj kosztorys z szablonu"
          description="Cała rozpiska zostanie zastąpiona — razem z etapami i wpisanym wykonaniem. Stawka VAT, współczynniki i rabat globalny zostają. Stan sprzed wczytania zapisze się automatycznie — wrócisz do niego przez „Wczytaj”."
        />

        {sections === null ? (
          <p className="text-muted-foreground text-sm">Ładowanie szablonów…</p>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brak zapisanych szablonów.</p>
        ) : (
          <div className="max-h-[45vh] min-h-0 overflow-y-auto rounded-md border">
            {groups.map((group) => {
              const isSelected = group.presetId === selectedPresetId
              return (
                <button
                  key={group.presetId}
                  type="button"
                  onClick={() => setSelectedPresetId(group.presetId)}
                  aria-pressed={isSelected}
                  className={cn(
                    'hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    isSelected && 'bg-accent',
                  )}
                >
                  <Check className={cn(isSelected ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{group.presetName}</span>
                  <span className="text-muted-foreground text-xs">
                    {summary(group.metas.length, countItems(group))}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Zniknie: {summary(currentSections, currentItems)}</p>
          <p className="text-muted-foreground">
            Wejdzie: {selected ? summary(selected.metas.length, countItems(selected)) : '—'}
          </p>
        </div>

        <DialogActions
          confirmLabel="Wczytaj i zastąp"
          pending={pending}
          pendingLabel="Wczytuję…"
          onConfirm={handleConfirm}
          onCancel={() => handleOpenChange(false)}
          confirmDisabled={!selected || pending}
        />
      </DialogContent>
    </Dialog>
  )
}
