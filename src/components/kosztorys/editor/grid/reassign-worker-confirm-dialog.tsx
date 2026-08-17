'use client'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { STAGE_HEADER_COPY as COPY } from './stage-header-copy'
import type { WorkerRefT } from '@/types/reference-data'

type PropsT = {
  // The move being confirmed. `undefined` means nothing is pending and the dialog stays unmounted;
  // `null` is a real target — „Bez przypisania" is as much a reassignment as any name.
  targetWorkerId: number | null | undefined
  stageLabel: string
  // Executed value of the etap at its own plane — the amount that changes hands.
  executedValue: number
  currentWorkerName?: string
  workers: WorkerRefT[]
  onConfirm: (workerId: number | null) => void
  onCancel: () => void
}

// Moving an etap that already has executed work is the one edit here that shifts money between two
// people's settlements: the amount leaves the previous person's należne while their wypłaty stay put,
// so their „pozostało do wypłaty" goes red. Naming both people and the amount is the whole job — a
// generic „na pewno?" would be worthless for a decision that has a price on it.
//
// Mounted only while a move is pending, so the copy can always name real values instead of branching
// on placeholders for the far commoner idle case.
export function ReassignWorkerConfirmDialog({
  targetWorkerId,
  stageLabel,
  executedValue,
  currentWorkerName,
  workers,
  onConfirm,
  onCancel,
}: PropsT) {
  if (targetWorkerId === undefined) return null

  const targetName =
    workers.find((worker) => worker.id === targetWorkerId)?.name ?? COPY.workerUnassigned

  return (
    <ConfirmDialog
      open
      title={COPY.reassignConfirm.title(stageLabel)}
      description={COPY.reassignConfirm.description(
        stageLabel,
        executedValue,
        currentWorkerName ?? COPY.workerUnknown,
        targetName,
      )}
      confirmLabel={COPY.reassignConfirm.confirmLabel}
      variant="neutral"
      onConfirm={() => onConfirm(targetWorkerId)}
      onCancel={onCancel}
    />
  )
}
