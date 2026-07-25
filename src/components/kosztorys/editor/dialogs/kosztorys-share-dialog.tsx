'use client'

import { useState, useTransition } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { generateShareLinkAction, revokeShareLinkAction } from '@/lib/actions/kosztorys-share'
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
}: PropsT) {
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [pending, startTransition] = useTransition()

  const url = token ? `${FRONTEND_URL}/k/${token}` : ''

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
            description="Kto ma link, ten widzi kosztorys — bez logowania. Ceny podwykonawców nigdy się w nim nie pojawiają."
          />
          {!loaded ? (
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
              <Description className="text-xs">
                „Wygeneruj nowy" unieważnia obecny link — stary adres przestaje działać.
              </Description>
            </div>
          ) : (
            <Button size="sm" onClick={generate} disabled={pending} className="self-start">
              Wygeneruj link
            </Button>
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
