'use client'

import { useEffect, useState } from 'react'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { catalogueSavePreviewAction, saveItemToCatalogueAction } from '@/lib/actions/work-catalogue'
import type { CatalogueSavePreviewT } from '@/lib/kosztorys/work-catalogue/types'
import { formatPLN } from '@/lib/utils/format-currency'
import { toastMessage } from '@/lib/utils/toast'

const LOAD_FAILED = 'Nie udało się wczytać danych pozycji'

type PricesT = { clientPrice: number; wToolsRate: number; ownToolsRate: number }

// The three liczby side by side, so „nadpisz" is a decision about numbers rather than about a name.
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
  const [mode, setMode] = useState<'new' | 'overwrite'>('new')
  const [saving, setSaving] = useState(false)

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
        // A klucz already in the cennik makes „nadpisz" the answer the owner came for — a „nowa"
        // default would only ever produce the duplicate message.
        setMode(res.data.existing ? 'overwrite' : 'new')
      })
      .catch(() => fail(LOAD_FAILED))
    return () => {
      stale = true
    }
  }, [open, itemId, onOpenChange])

  async function handleSave() {
    if (!preview || saving) return
    setSaving(true)
    const res = await saveItemToCatalogueAction(itemId, mode)
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się zapisać pracy do katalogu', 'error', 4000)
      return
    }
    toastMessage(
      mode === 'overwrite' ? 'Nadpisano pozycję katalogu' : 'Dodano do katalogu',
      'success',
    )
    onOpenChange(false)
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Zapisz do katalogu…"
      description="Katalog prac to wspólny cennik — stawki zapisują się jako kwoty, wyliczone dla tej inwestycji."
      confirmLabel="Zapisz"
      onConfirm={() => void handleSave()}
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

          {preview.existing && (
            <ToggleGroup
              options={[
                { value: 'overwrite', label: 'Nadpisz' },
                { value: 'new', label: 'Nowa' },
              ]}
              value={mode}
              onChange={setMode}
              aria-label="Tryb zapisu do katalogu"
            />
          )}

          {preview.existing && <PriceList title="W katalogu" prices={preview.existing} />}
          <PriceList
            title={preview.existing ? 'Po zapisie' : 'Do zapisania'}
            prices={preview.candidate}
          />

          {preview.existing && mode === 'new' && (
            <Description tone="error" size="xs">
              Ta praca jest już w katalogu pod tą samą nazwą i jednostką — drugiej pozycji nie da
              się dodać.
            </Description>
          )}
        </>
      )}
    </FormDialogShell>
  )
}
