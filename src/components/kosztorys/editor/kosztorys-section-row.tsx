'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useInlineRename } from '@/components/kosztorys/editor/hooks/use-inline-rename'
import { formatNet } from '@/lib/kosztorys/format'
import { enterEscapeKeyDown } from '@/lib/utils/enter-escape-keydown'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'

type PropsT = {
  subtotal: SectionSubtotalT
  onAddItem: (sectionId: number) => void
  onRenameSection: (sectionId: number, name: string) => void
  onRequestRemove: (subtotal: SectionSubtotalT) => void
}

// One row per section, so the rename state is row-local and useInlineRename can be used the way the
// grid's two rename sites use it — the drawer previously carried an `editId` alongside its own draft
// and its own Enter/Escape handling, a third state machine for the same operation the section-name
// cell already performs.
export function KosztorysSectionRow({
  subtotal,
  onAddItem,
  onRenameSection,
  onRequestRemove,
}: PropsT) {
  const { editing, start, inputProps } = useInlineRename((draft) => {
    const name = draft.trim()
    if (name) onRenameSection(subtotal.sectionId, name)
  })
  // The hook's Enter/Escape props target EditableCellInput; outside the grid they have to be
  // dispatched onto the shadcn Input's native onKeyDown.
  const { onEnter, onEscape, ...nativeInputProps } = inputProps

  return (
    <li className="px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        {editing ? (
          <Input
            autoFocus
            {...nativeInputProps}
            onKeyDown={enterEscapeKeyDown({ onEnter, onEscape })}
            className="h-7 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => start(subtotal.sectionName)}
            className="group text-foreground flex min-w-0 items-center gap-1 text-left text-sm"
            title="Edytuj nazwę"
          >
            <span className="truncate">{subtotal.sectionName}</span>
            <Pencil className="text-muted-foreground size-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
        <span className="text-foreground shrink-0 text-sm tabular-nums">
          {formatNet(subtotal.net)}
        </span>
      </div>

      {!editing && (
        <div className="mt-1.5 flex flex-col gap-1">
          <Button
            size="sm"
            variant="outline"
            align="start"
            className="w-full"
            onClick={() => onAddItem(subtotal.sectionId)}
          >
            <Plus /> Dodaj pozycję do sekcji
          </Button>
          <Button
            size="sm"
            variant="outlineDestructive"
            align="start"
            className="w-full"
            onClick={() => onRequestRemove(subtotal)}
          >
            <Trash2 /> Usuń sekcję
          </Button>
        </div>
      )}
    </li>
  )
}
