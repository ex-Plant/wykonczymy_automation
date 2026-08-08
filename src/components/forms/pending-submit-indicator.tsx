'use client'

import { SubmitPill } from '@/components/forms/submit-pill'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { firstPendingLabel, usePendingStore } from '@/stores/pending-store'

// Optimistic submit closes the dialog and runs the save fire-and-forget, so nothing else signals
// it's in progress. Mounted once; the shared store's `pending` flag covers every form.
//
// Two sources because the optimistic store is dialog-shaped (form id, file snapshot, reopen on
// failure) — a transition-based save can't use it, and a pill it mounted itself would die with it.
export function PendingSubmitIndicator() {
  const isSubmitting = useOptimisticFormStore((s) => s.submission?.status === 'pending')
  const label = usePendingStore((s) => firstPendingLabel(s.pending))

  if (!isSubmitting && !label) return null

  return <SubmitPill label={label ?? 'Zapisywanie…'} />
}
