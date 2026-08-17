'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ClientViewSettingsForm } from '@/components/kosztorys/editor/dialogs/client-view-settings-form'
import {
  saveClientViewDefaultsAction,
  saveClientViewSettingsAction,
} from '@/lib/actions/kosztorys-client-view'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // Fetched by the parent on the menu click — Radix never fires onOpenChange for a programmatic
  // `open`, the same reason the share dialog takes its token from above.
  settings: ClientViewSettingsT | null
  onSaved: (settings: ClientViewSettingsT) => void
}

// Nothing is written until „Zapisz": closing the window leaves the client's link exactly as it was,
// so the owner can look through the list without deciding anything.
export function KosztorysClientViewDialog({
  investmentId,
  open,
  onOpenChange,
  settings,
  onSaved,
}: PropsT) {
  const [draft, setDraft] = useState<ClientViewSettingsT | null>(settings)
  const [propsSettings, setPropsSettings] = useState(settings)
  if (propsSettings !== settings) {
    setPropsSettings(settings)
    setDraft(settings)
  }
  const [pending, startTransition] = useTransition()

  const save = (asDefaults: boolean) =>
    startTransition(async () => {
      if (!draft) return
      // „Zapisz jako domyślne" saves this investment too, never only the firm-wide default: the
      // default applies to investments with no settings of their own, so writing it alone would
      // leave the kosztorys the owner is looking at unchanged by the button they just pressed.
      const res = await saveClientViewSettingsAction(investmentId, draft)
      if (!res.success) return toastMessage(res.error, 'error')
      // Published before the second write is attempted: that row IS saved, so leaving the parent on
      // the old value after a failed defaults write would make the editor and the DB disagree.
      onSaved(draft)
      if (asDefaults) {
        const defaults = await saveClientViewDefaultsAction(draft)
        if (!defaults.success) {
          return toastMessage(
            `Zapisano dla tej inwestycji, ale nie jako domyślne: ${defaults.error}`,
            'error',
          )
        }
      }
      toastMessage(
        asDefaults ? 'Zapisano — te ustawienia są teraz domyślne.' : 'Zapisano ustawienia.',
        'success',
      )
      onOpenChange(false)
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Ustawienia podglądu inwestora"
          // Scoped to the rozpiska on purpose: the setting reaches the grid's columns and pozycje,
          // while the podsumowanie below it keeps its own client projection.
          description="Zaznacz, które kolumny i pozycje inwestor widzi w rozpisce. Ceny podwykonawców nie pojawiają się w niej nigdy."
        />
        {!draft ? (
          <p className="text-muted-foreground text-sm">Wczytywanie…</p>
        ) : (
          <ClientViewSettingsForm value={draft} onChange={setDraft} disabled={pending} />
        )}
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={!draft || pending}
            onClick={() => save(true)}
          >
            Zapisz jako domyślne
          </Button>
          <Button size="sm" disabled={!draft || pending} onClick={() => save(false)}>
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
