'use client'

import { WarningBanner } from '@/components/ui/warning-banner'
import type { ClientViewModeT } from '@/lib/kosztorys/client-view-settings'

const MODE_NAMES: Record<ClientViewModeT, string> = {
  OFFER: 'ofertę',
  SETTLEMENT: 'rozliczenie',
}

/**
 * Its own file because both dialogs render it and neither the shared form nor this component knows
 * the saved mode — only the caller does. Silent when the pick matches what is saved: a banner that
 * is always there stops being read.
 */
export function ClientViewModeWarning({
  picked,
  saved,
}: {
  picked: ClientViewModeT
  saved: ClientViewModeT | undefined
}) {
  if (!saved || picked === saved) return null

  return (
    <WarningBanner className="px-2">
      Zapis zmieni to, co widzi inwestor pod swoim linkiem — zobaczy {MODE_NAMES[picked]}.
    </WarningBanner>
  )
}
