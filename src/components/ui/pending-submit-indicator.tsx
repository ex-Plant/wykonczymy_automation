'use client'

import { SubmitPill } from '@/components/ui/submit-pill'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { firstPendingLabel, usePendingStore } from '@/stores/pending-store'

// Optimistic submit closes the dialog and runs the save fire-and-forget, so nothing else signals
// it's in progress. Mounted once in the app shell next to EnvBadge — it outlives whatever raised it
// (a dialog, a popover, the kosztorys editor), which is why it lives here and not under forms/.
//
// Two sources because the optimistic store is dialog-shaped (form id, file snapshot, reopen on
// failure) — a transition-based save can't use it, and a pill it mounted itself would die with it.
export function PendingSubmitIndicator() {
  const isSubmitting = useOptimisticFormStore((s) => s.submission?.status === 'pending')
  const label = usePendingStore((s) => firstPendingLabel(s.pending))

  if (!isSubmitting && !label) return null

  return <SubmitPill label={label ?? 'Zapisywanie…'} />
}
