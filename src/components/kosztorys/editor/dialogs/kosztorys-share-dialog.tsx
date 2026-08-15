'use client'

import { useState, useTransition } from 'react'
import { ArrowLeft, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ClientViewSettingsForm } from '@/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog'
import { generateShareLinkAction, revokeShareLinkAction } from '@/lib/actions/kosztorys-share'
import { saveClientViewSettingsAction } from '@/lib/actions/kosztorys-client-view'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { FRONTEND_URL } from '@/lib/env'
import { copyToClipboard } from '@/lib/utils/copy-to-clipboard'
import { toastMessage } from '@/lib/utils/toast'
import { Description } from '@/components/ui/description'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // Token + its load state are owned by the parent, which fetches on the Opcje-menu click. Radix
  // fires onOpenChange only for its OWN trigger, never for a programmatic `open`, so a fetch hung
  // off onOpenChange never ran when the dialog is opened from a menu item. The dialog updates the
  // token back up on generate/revoke.
  token: string | null
  loaded: boolean
  onTokenChange: (token: string | null) => void
  // Same fetched-above contract as the token, and the same state the „Ustawienia podglądu…" window
  // edits — one copy per editor, so the two surfaces can never show different answers.
  settings: ClientViewSettingsT | null
  onSettingsChange: (settings: ClientViewSettingsT) => void
}

// Controlled from the parent (Opcje menu) rather than owning its own trigger — a DropdownMenuItem
// closes the menu on select, so the dialog can't live inside it.
export function KosztorysShareDialog({
  investmentId,
  open,
  onOpenChange,
  token,
  loaded,
  onTokenChange,
  settings,
  onSettingsChange,
}: PropsT) {
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [pending, startTransition] = useTransition()
  // Every open starts at the settings, including when a link already exists — the point is that
  // nobody hands out a link without having just looked at what it discloses, which a first-run-only
  // wizard would give up after the first share.
  const [step, setStep] = useState<'settings' | 'link'>('settings')
  const [draft, setDraft] = useState<ClientViewSettingsT | null>(settings)
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setStep('settings')
  }
  const [propsSettings, setPropsSettings] = useState(settings)
  if (propsSettings !== settings) {
    setPropsSettings(settings)
    setDraft(settings)
  }

  const url = token ? `${FRONTEND_URL}/k/${token}` : ''

  const saveAndContinue = () =>
    startTransition(async () => {
      if (!draft) return
      const res = await saveClientViewSettingsAction(investmentId, draft)
      if (!res.success) return toastMessage(res.error, 'error')
      onSettingsChange(draft)
      setStep('link')
    })

  const generate = () =>
    startTransition(async () => {
      const res = await generateShareLinkAction(investmentId)
      if (!res.success) return toastMessage(res.error, 'error')
      onTokenChange(res.data)
      toastMessage('Link gotowy. Poprzedni (jeśli był) przestał działać.', 'success')
    })

  const revoke = () =>
    startTransition(async () => {
      const res = await revokeShareLinkAction(investmentId)
      if (!res.success) return toastMessage(res.error, 'error')
      onTokenChange(null)
      setConfirmingRevoke(false)
      toastMessage('Link wyłączony.', 'success')
    })

  const copy = () => copyToClipboard(url, 'Skopiowano link.')

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader
            title="Udostępnij klientowi"
            description={
              step === 'settings'
                ? 'Najpierw sprawdź, co klient zobaczy. Ceny podwykonawców nigdy się w kosztorysie nie pojawiają.'
                : 'Kto ma link, ten widzi kosztorys — bez logowania. Ceny podwykonawców nigdy się w nim nie pojawiają.'
            }
          />
          {step === 'settings' ? (
            <>
              {!draft ? (
                <p className="text-muted-foreground text-sm">Wczytywanie…</p>
              ) : (
                <ClientViewSettingsForm value={draft} onChange={setDraft} disabled={pending} />
              )}
              <DialogFooter>
                <Button size="sm" disabled={!draft || pending} onClick={saveAndContinue}>
                  Dalej
                </Button>
              </DialogFooter>
            </>
          ) : !loaded ? (
            <p className="text-muted-foreground text-sm">Sprawdzanie…</p>
          ) : token ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
                <Button variant="outline" size="icon" onClick={copy} aria-label="Kopiuj link">
                  <Copy />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
                  Wygeneruj nowy
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmingRevoke(true)}
                  disabled={pending}
                >
                  Wyłącz link
                </Button>
              </div>
              <Description size="xs">
                „Wygeneruj nowy" unieważnia obecny link — stary adres przestaje działać.
              </Description>
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setStep('settings')}
              >
                <ArrowLeft />
                Wróć do ustawień
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button size="sm" onClick={generate} disabled={pending} className="self-start">
                Wygeneruj link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setStep('settings')}
              >
                <ArrowLeft />
                Wróć do ustawień
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmingRevoke}
        title="Wyłączyć link dla klienta?"
        description="Klient natychmiast straci dostęp do kosztorysu. Tej akcji nie da się cofnąć — aby przywrócić dostęp, musisz wygenerować nowy link (stary adres już nie zadziała)."
        confirmLabel="Wyłącz link"
        pending={pending}
        pendingLabel="Wyłączanie…"
        onConfirm={revoke}
        onCancel={() => setConfirmingRevoke(false)}
      />
    </>
  )
}
