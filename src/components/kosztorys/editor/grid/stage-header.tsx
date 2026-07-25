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
import { PlaneUnconfirmedBadge } from '@/components/ui/plane-unconfirmed-badge'
import { planeIcon, PLANE_LABELS } from '@/components/kosztorys/editor/plane-icons'
import { cn } from '@/lib/utils/cn'
import type { KosztorysStageT, StagePlaneT } from '@/lib/kosztorys/types'

const STAGE_PLANES: StagePlaneT[] = ['w_tools', 'own_tools']

type PropsT = {
  stage: KosztorysStageT
  onRename?: (stageId: number, label: string) => void
  onRemove?: (stageId: number) => void
  onSetPlane?: (stageId: number, plane: StagePlaneT) => void
}

// Stage column header: „Zmień nazwę" edits the label inline (empty → the „Etap N" placeholder,
// persisting null), „Usuń etap" deletes behind a confirm. The inline input is uncontrolled, so its
// `defaultValue` is read only when edit mode opens — no stale value can leak if the stage behind
// this column index shifts under the persisted DOM node.
export function StageHeader({ stage, onRename, onRemove, onSetPlane }: PropsT) {
  const label = stage.label ?? `Etap ${stage.ordinal}`
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // No handlers = a read-only mount (clientView): render the bare label, no menu/rename/delete AND no
  // plane icon or warning — the rozliczenie is internal subcontractor information, never client-facing.
  if (!onRename && !onRemove && !onSetPlane) {
    return (
      <span className={cn('px-1 text-sm', stage.label == null && 'text-muted-foreground')}>
        {label}
      </span>
    )
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="h-full w-full min-w-0 bg-transparent px-1 text-sm outline-none"
        defaultValue={stage.label ?? ''}
        placeholder={`Etap ${stage.ordinal}`}
        onBlur={(e) => {
          onRename?.(stage.id, e.target.value.trim())
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.currentTarget.value = stage.label ?? ''
            e.currentTarget.blur()
          }
        }}
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
            {/* No icon while the plane is unconfirmed — a wrench would claim a crew nobody picked. */}
            {stage.plane != null && planeIcon(stage.plane)}
            <span
              className={cn(stage.plane != null && stage.label == null && 'text-muted-foreground')}
            >
              {label}
            </span>
            {stage.plane == null && <PlaneUnconfirmedBadge content="Wybierz jak rozliczać etap" />}
          </span>
        }
        icon={<ChevronDown className="opacity-50" />}
        triggerTitle="Opcje etapu"
      >
        {onSetPlane && (
          <>
            <DropdownMenuLabel>Rozliczenie</DropdownMenuLabel>
            {/* Single-select skinned as checkboxes. onCheckedChange ignores its arg — re-picking the
                active plane can't unset it. */}
            {STAGE_PLANES.map((plane) => (
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
        <DropdownMenuItem onSelect={() => setEditing(true)}>
          <Pencil />
          Zmień nazwę
        </DropdownMenuItem>
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash2 />
              Usuń etap
            </DropdownMenuItem>
          </>
        )}
      </HeaderMenu>

      <ConfirmDialog
        open={confirmOpen}
        title={`Usunąć „${label}"?`}
        description="Kolumna etapu i wszystkie wpisane w niej ilości zostaną usunięte."
        confirmLabel="Usuń"
        onConfirm={() => {
          onRemove?.(stage.id)
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
