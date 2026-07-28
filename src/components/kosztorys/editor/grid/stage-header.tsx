'use client'

import { useState } from 'react'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenuCheckboxRow,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { HeaderMenu } from '@/components/ui/datasheet-grid/header-menu'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { PlaneUnconfirmedBadge } from '@/components/ui/plane-unconfirmed-badge'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { useInlineRename } from '@/components/kosztorys/editor/hooks/use-inline-rename'
import { PLANE_LABELS, TOOL_PLANES } from '@/lib/kosztorys/constants'
import { STAGE_HEADER_COPY as COPY } from './stage-header-copy'
import { isActiveRef } from '@/lib/utils/is-active-ref'
import { cn } from '@/lib/utils/cn'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'

type PropsT = {
  stage: KosztorysStageT
  onRename?: (stageId: number, label: string) => void
  onRemove?: (stageId: number) => void
  onSetPlane?: (stageId: number, plane: ToolPlaneT) => void
  workers?: WorkerRefT[]
  onSetWorker?: (stageId: number, workerId: number | null) => void
  // The etap's executed value at its own plane — quoted in the reassignment confirm so the dialog and
  // the panel can't cite different amounts. 0 (or absent) means nothing has been executed here yet.
  executedValue?: number
}

// An emptied label persists as null and falls back to the „Etap N" placeholder.
export function StageHeader({
  stage,
  onRename,
  onRemove,
  onSetPlane,
  workers,
  onSetWorker,
  executedValue = 0,
}: PropsT) {
  const label = stage.label ?? `Etap ${stage.ordinal}`
  const { editing, start, inputProps } = useInlineRename((name) =>
    onRename?.(stage.id, name.trim()),
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  // The worker a pending reassignment would move the etap to. `undefined` means no dialog is open —
  // `null` can't carry that, it is the legitimate „Bez przypisania" target.
  const [pendingWorkerId, setPendingWorkerId] = useState<number | null | undefined>(undefined)

  // The reference query is unfiltered, so without this a deactivated worker stays pickable here
  // after disappearing from every form. No activeOnly escape hatch — unlike the entity comboboxes,
  // there is no reason to assign new work to someone who no longer works here.
  const activeWorkers = (workers ?? []).filter(isActiveRef)
  const currentWorkerName = activeWorkers.find((worker) => worker.id === stage.workerId)?.name

  // Moving executed work off someone is the one destructive-feeling edit here: it drops their
  // „pozostało" by the amount and raises the new person's. Confirm only in that case — assigning an
  // empty etap, or filling in a blank assignment, needs no ceremony.
  function pickWorker(workerId: number | null) {
    if (workerId === stage.workerId) return
    if (executedValue > 0 && stage.workerId != null) {
      setPendingWorkerId(workerId)
      return
    }
    onSetWorker?.(stage.id, workerId)
  }

  // No handlers = a read-only mount (preview): render the bare label, no menu/rename/delete AND no
  // plane icon or warning — the rozliczenie is internal subcontractor information, never client-facing.
  if (!onRename && !onRemove && !onSetPlane && !onSetWorker) {
    return (
      <HeaderLabel className={cn('px-1', stage.label == null && 'text-muted-foreground')}>
        {label}
      </HeaderLabel>
    )
  }

  if (editing) {
    return (
      <EditableCellInput
        {...inputProps}
        autoFocus
        className="min-w-0 px-1 text-xs"
        placeholder={`Etap ${stage.ordinal}`}
      />
    )
  }

  return (
    <>
      <HeaderMenu
        label={
          <span
            className={cn(
              'inline-flex items-center gap-2',
              stage.plane == null && 'text-destructive',
            )}
          >
            {/* A wrench here would claim a crew nobody picked. */}
            {stage.plane != null && planeIcon(stage.plane)}
            <HeaderLabel
              className={cn(stage.plane != null && stage.label == null && 'text-muted-foreground')}
            >
              {label}
            </HeaderLabel>
            {stage.plane == null && (
              <PlaneUnconfirmedBadge content={COPY.planeUnconfirmed} />
            )}
          </span>
        }
        icon={<ChevronDown className="opacity-50" />}
        triggerTitle="Opcje etapu"
      >
        {onSetPlane && (
          <>
            <DropdownMenuLabel>{COPY.planeSectionLabel}</DropdownMenuLabel>
            {/* Single-select skinned as checkboxes. onCheckedChange ignores its arg — re-picking the
                active plane can't unset it. */}
            {TOOL_PLANES.map((plane) => (
              <DropdownMenuCheckboxRow
                key={plane}
                checked={stage.plane === plane}
                onCheckedChange={() => onSetPlane(stage.id, plane)}
                label={PLANE_LABELS[plane]}
                trailing={planeIcon(plane)}
              />
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        {onSetWorker && (
          <>
            <DropdownMenuLabel>{COPY.workerSectionLabel}</DropdownMenuLabel>
            {stage.plane == null ? (
              // Disabled until a rozliczenie exists: the settlement pass skips a plane-less etap
              // before it computes any value, so an assignment made here would show a name against a
              // silent 0 zł należne.
              <p className="text-muted-foreground px-2 py-1.5 text-xs">{COPY.workerNeedsPlane}</p>
            ) : (
              <>
                {activeWorkers.map((worker) => (
                  <DropdownMenuCheckboxRow
                    key={worker.id}
                    checked={stage.workerId === worker.id}
                    onCheckedChange={() => pickWorker(worker.id)}
                    label={worker.name}
                  />
                ))}
                <DropdownMenuCheckboxRow
                  checked={stage.workerId == null}
                  onCheckedChange={() => pickWorker(null)}
                  label={COPY.workerUnassigned}
                />
              </>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => start(stage.label ?? '')}>
          <Pencil />
          {COPY.renameAction}
        </DropdownMenuItem>
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash2 />
              {COPY.removeAction}
            </DropdownMenuItem>
          </>
        )}
      </HeaderMenu>

      <ConfirmDialog
        open={confirmOpen}
        title={COPY.removeConfirm.title(label)}
        description={COPY.removeConfirm.description}
        confirmLabel={COPY.removeConfirm.confirmLabel}
        onConfirm={() => {
          onRemove?.(stage.id)
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Conditional: mounted only while a reassignment is pending, so the copy can name the amount
          and both people without a placeholder branch for the far commoner no-op case. */}
      {pendingWorkerId !== undefined && (
        <ConfirmDialog
          open
          title={COPY.reassignConfirm.title(label)}
          description={COPY.reassignConfirm.description(
            label,
            executedValue,
            currentWorkerName ?? COPY.workerUnknown,
            activeWorkers.find((worker) => worker.id === pendingWorkerId)?.name ??
              COPY.workerUnassigned,
          )}
          confirmLabel={COPY.reassignConfirm.confirmLabel}
          onConfirm={() => {
            onSetWorker?.(stage.id, pendingWorkerId)
            setPendingWorkerId(undefined)
          }}
          onCancel={() => setPendingWorkerId(undefined)}
        />
      )}
    </>
  )
}
