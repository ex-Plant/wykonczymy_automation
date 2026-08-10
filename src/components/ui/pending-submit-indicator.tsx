'use client'

import { SubmitPill } from '@/components/ui/submit-pill'
import { firstPendingLabel, usePendingStore } from '@/stores/pending-store'

// Optimistic submit closes the dialog and runs the save fire-and-forget, so nothing else signals
// it's in progress. Mounted once in the app shell next to EnvBadge — it outlives whatever raised it
// (a dialog, a popover, the kosztorys editor), which is why it lives here and not under forms/.
export function PendingSubmitIndicator() {
  const label = usePendingStore((state) => firstPendingLabel(state.pending))

  if (!label) return null

  return <SubmitPill label={label} />
}
