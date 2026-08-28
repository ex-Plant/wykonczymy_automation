'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, Settings2, Share2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { getShareLinkAction } from '@/lib/actions/kosztorys-share'
import { readClientViewSettings } from '@/lib/queries/client-view-settings-endpoint'
import type { ClientViewConfigT } from '@/lib/kosztorys/client-view-settings'
import {
  OWNER_ONLY_CLIENT_VIEW_MESSAGE,
  OWNER_ONLY_SHARE_MESSAGE,
} from '@/lib/kosztorys/owner-only-messages'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'

// „Ustawienia podglądu…" and „Udostępnij" share one module because they share one figure: both open
// on the same client-view settings, and both dialogs write them back.
export type InvestorActionsT = {
  clientView: ClientViewConfigT | null
  setClientView: (config: ClientViewConfigT) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  requestSettings: () => void
  shareOpen: boolean
  setShareOpen: (open: boolean) => void
  shareToken: string | null
  setShareToken: (token: string | null) => void
  shareLoaded: boolean
  requestShare: () => void
}

export function useInvestorActions(): InvestorActionsT {
  const { investmentId } = useKosztorysEditorContext()
  const [clientView, setClientView] = useState<ClientViewConfigT | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareLoaded, setShareLoaded] = useState(false)
  const settingsRequest = useLatestRequest()

  // Fetch on the click, not inside the dialog: Radix onOpenChange never fires for a programmatic
  // `open`, so the dialog can't fetch itself. Re-read on every open, so the window never shows a set
  // that another session has since changed.
  // Latest-wins: both „Udostępnij" and „Ustawienia podglądu…" feed this one state, so a slow first
  // read landing after a second one would put a stale set back into the dialog — and the next
  // „Zapisz" would write that stale set over what the owner had just saved.
  function readSettings() {
    const isCurrent = settingsRequest.start()
    setClientView(null)
    void readClientViewSettings(investmentId)
      .then((settings) => {
        if (isCurrent()) setClientView(settings)
      })
      .catch(() => {
        if (isCurrent()) toastMessage('Nie udało się odczytać ustawień podglądu', 'error')
      })
  }

  function requestSettings() {
    setSettingsOpen(true)
    readSettings()
  }

  // Same Radix reason as readSettings — and re-fetching each open avoids showing a link that may
  // have been rotated or revoked elsewhere since last time as though it were still live.
  function requestShare() {
    setShareOpen(true)
    setShareLoaded(false)
    readSettings()
    void getShareLinkAction(investmentId)
      .then((res) => {
        setShareToken(res.success ? res.data : null)
        if (!res.success) toastMessage(res.error, 'error')
      })
      .catch(() => {
        setShareToken(null)
        toastMessage('Nie udało się sprawdzić linku', 'error')
      })
      .finally(() => setShareLoaded(true))
  }

  return {
    clientView,
    setClientView,
    settingsOpen,
    setSettingsOpen,
    requestSettings,
    shareOpen,
    setShareOpen,
    shareToken,
    setShareToken,
    shareLoaded,
    requestShare,
  }
}

export function InvestorPreviewMenuItem() {
  const { investmentId } = useKosztorysEditorContext()
  return (
    <DropdownMenuItem asChild>
      <Link href={`/podglad-inwestora/${investmentId}`} target="_blank">
        <Eye />
        <MenuItemBody label="Podgląd" description="Zobacz kosztorys tak, jak widzi go inwestor." />
      </Link>
    </DropdownMenuItem>
  )
}

// Both of these are refused by `ownerOnlyAction` on the server, and that refusal is the gate — this
// is the sign on the door. Without it a manager opens the window, fills it in and clicks „Zapisz" to
// hear „no" three screens later; the answer was never going to change, it was just held back. Read
// off `isAdminOrOwnerRole`, the very predicate the server gate calls, so the door and the lock cannot
// drift apart. Safe to read the session here: these items render only in the owner's toolbar, which
// the client views (both mounted without a CurrentUserProvider) never render.
function useMayServeTheClient(): boolean {
  const { role } = useCurrentUser()
  return isAdminOrOwnerRole(role)
}

export function ClientViewSettingsMenuItem() {
  const { investor } = useKosztorysActions()
  const allowed = useMayServeTheClient()

  return (
    <DropdownMenuItem onSelect={investor.requestSettings} disabled={!allowed}>
      <Settings2 />
      <MenuItemBody
        label="Ustawienia podglądu…"
        description={
          allowed
            ? 'Zdecyduj, które kolumny i pozycje widzi inwestor.'
            : OWNER_ONLY_CLIENT_VIEW_MESSAGE
        }
      />
    </DropdownMenuItem>
  )
}

export function ShareMenuItem() {
  const { investor } = useKosztorysActions()
  const allowed = useMayServeTheClient()

  return (
    <DropdownMenuItem onSelect={investor.requestShare} disabled={!allowed}>
      <Share2 />
      <MenuItemBody
        label="Udostępnij"
        description={
          allowed
            ? 'Wygeneruj link, którym inwestor otworzy kosztorys bez logowania.'
            : OWNER_ONLY_SHARE_MESSAGE
        }
      />
    </DropdownMenuItem>
  )
}
