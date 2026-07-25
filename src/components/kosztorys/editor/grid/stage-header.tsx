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
import { HeaderLabel } from '@/components/kosztorys/editor/grid/header-label'
import { EditableCellInput } from '@/components/kosztorys/editor/grid/cells/editable-cell-input'
import { PlaneUnconfirmedBadge } from '@/components/ui/plane-unconfirmed-badge'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { useInlineRename } from '@/components/kosztorys/editor/use-inline-rename'
import { PLANE_LABELS, STAGE_PLANES } from '@/lib/kosztorys/constants'
import { cn } from '@/lib/utils/cn'
import type { KosztorysStageT, StagePlaneT } from '@/lib/kosztorys/types'

type PropsT = {
  stage: KosztorysStageT
  onRename?: (stageId: number, label: string) => void
  onRemove?: (stageId: number) => void
  onSetPlane?: (stageId: number, plane: StagePlaneT) => void
}

// Stage column header: „Zmień nazwę" edits the label inline (empty → the „Etap N" placeholder,
// persisting null), „Usuń etap" deletes behind a confirm.
export function StageHeader({ stage, onRename, onRemove, onSetPlane }: PropsT) {
  const label = stage.label ?? `Etap ${stage.ordinal}`
  const { editing, start, inputProps } = useInlineRename((name) =>
    onRename?.(stage.id, name.trim()),
  )
  const [confirmOpen, setConfirmOpen] = useState(false)

  // No handlers = a read-only mount (clientView): render the bare label, no menu/rename/delete AND no
  // plane icon or warning — the rozliczenie is internal subcontractor information, never client-facing.
  if (!onRename && !onRemove && !onSetPlane) {
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
              <PlaneUnconfirmedBadge content="Wybierz jak rozliczać etap — do tego czasu ilości w tej kolumnie są zablokowane, bo nie weszłyby do rachunku żadnej ekipy." />
            )}
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
        <DropdownMenuItem onSelect={() => start(stage.label ?? '')}>
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
