'use client'

import { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { catalogueSavePreviewAction, saveItemToCatalogueAction } from '@/lib/actions/work-catalogue'
import type { CatalogueSavePreviewT } from '@/lib/kosztorys/work-catalogue/types'
import { formatPLN } from '@/lib/utils/format-currency'
import { toastMessage } from '@/lib/utils/toast'

const LOAD_FAILED = 'Nie udało się wczytać danych pozycji'

type PricesT = { clientPrice: number; wToolsRate: number; ownToolsRate: number }

// Rendered for both sides so „nadpisz" is a decision about numbers rather than about a name.
function PriceList({ title, prices }: { title: string; prices: PricesT }) {
  const rows = [
    ['Cena j.m.', prices.clientPrice],
    ['Stawka z narzędziami', prices.wToolsRate],
    ['Stawka bez narzędzi', prices.ownToolsRate],
  ] as const
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{title}</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="tabular-nums">{formatPLN(value)}</span>
        </div>
      ))}
    </div>
  )
}

// „Zapisz do katalogu…" from the row menu. Every figure comes from the server preview — the same
// derivation the save itself runs — so what the dialog shows is what lands in the cennik.
export function SaveItemToCatalogueDialog({
  itemId,
  open,
  onOpenChange,
}: {
  itemId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [preview, setPreview] = useState<CatalogueSavePreviewT | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    let stale = false
    const fail = (message: string) => {
      if (stale) return
      toastMessage(message, 'error', 4000)
      onOpenChange(false)
    }
    void catalogueSavePreviewAction(itemId)
      .then((res) => {
        if (stale) return
        if (!res.success) return fail(res.error ?? LOAD_FAILED)
        setPreview(res.data)
      })
      .catch(() => fail(LOAD_FAILED))
    return () => {
      stale = true
    }
  }, [open, itemId, onOpenChange])

  // The klucz (opis + j.m.) decides it — there is no mode to pick: an occupied klucz can only be
  // overwritten, and a free one can only be created. „Nadpisz" replaces the figures of a row every
  // future kosztorys copies from, and the katalog keeps no history, so that branch asks first.
  const overwrites = preview?.existing != null

  function requestSave() {
    if (!preview || saving) return
    if (overwrites) return setConfirming(true)
    void handleSave()
  }

  async function handleSave() {
    if (!preview || saving) return
    setConfirming(false)
    setSaving(true)
    const res = await saveItemToCatalogueAction(itemId, overwrites ? 'overwrite' : 'new')
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się zapisać pracy do katalogu', 'error', 4000)
      return
    }
    toastMessage(overwrites ? 'Nadpisano pozycję katalogu' : 'Dodano do katalogu', 'success')
    onOpenChange(false)
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Zapisz do katalogu…"
      description="Katalog prac to wspólny cennik — stawki zapisują się jako kwoty, wyliczone dla tej inwestycji."
      confirmLabel={overwrites ? 'Nadpisz…' : 'Zapisz'}
      onConfirm={requestSave}
      confirmDisabled={!preview || saving}
    >
      {!preview ? (
        <Description size="xs">Wczytywanie…</Description>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium">{preview.candidate.description}</p>
            <p className="text-muted-foreground text-xs">
              {preview.candidate.unit || 'bez jednostki'}
              {preview.candidate.category ? ` · ${preview.candidate.category}` : ''}
            </p>
          </div>

          {preview.existing && <PriceList title="W katalogu" prices={preview.existing} />}
          <PriceList
            title={preview.existing ? 'Po zapisie' : 'Do zapisania'}
            prices={preview.candidate}
          />

          {preview.existing && (
            <Description size="xs">
              Ta praca jest już w katalogu pod tą samą nazwą i jednostką — zapis ją nadpisze. Chcesz
              osobną pozycję? Zmień nazwę pracy w rozpisce i zapisz jeszcze raz.
            </Description>
          )}
        </>
      )}

      {preview?.existing && (
        <ConfirmDialog
          open={confirming}
          title={`Nadpisać „${preview.existing.description}" w katalogu?`}
          description={`Stare stawki przepadną — katalog nie trzyma historii. Cena j.m. ${formatPLN(preview.existing.clientPrice)} → ${formatPLN(preview.candidate.clientPrice)}, stawka z narzędziami ${formatPLN(preview.existing.wToolsRate)} → ${formatPLN(preview.candidate.wToolsRate)}, bez narzędzi ${formatPLN(preview.existing.ownToolsRate)} → ${formatPLN(preview.candidate.ownToolsRate)}. Kosztorysy, w których ta praca już siedzi, zostają bez zmian. Jeśli chcesz dodać osobną pozycję zamiast nadpisać tę — anuluj i zmień nazwę pracy w rozpisce.`}
          confirmLabel="Nadpisz"
          pending={saving}
          pendingLabel="Zapisuję…"
          onConfirm={() => void handleSave()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </FormDialogShell>
  )
}
