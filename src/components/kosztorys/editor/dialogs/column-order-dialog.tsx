'use client'

import { Reorder } from 'framer-motion'
import { EyeOff, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import type { ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import { ANCHORED_COLUMN_KEYS, rankForMove, type ColumnRanksT } from '@/lib/kosztorys/column-order'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The picker's own list, already in grid order — one source for „which columns exist and what are
  // they called", so this window can't disagree with the visibility list beside it.
  items: ColumnToggleItemT[]
  ranks: ColumnRanksT
  baseRanks: Record<string, number>
  onSetRank: (key: string, rank: number) => void
  onReset: () => void
}

// The key that travelled furthest between the two orders — the one the drag moved, as opposed to the
// neighbours it displaced by one. A swap of two adjacent keys moves both by one; either reading
// produces the same final order, so the tie needs no resolving.
function movedKey(before: readonly string[], after: readonly string[]): string | undefined {
  let moved: string | undefined
  let furthest = 0
  after.forEach((key, index) => {
    const distance = Math.abs(index - before.indexOf(key))
    if (distance > furthest) {
      furthest = distance
      moved = key
    }
  })
  return moved
}

// „Ustaw kolejność kolumn…" — a separate surface from the visibility picker on purpose: reordering is
// rare, the picker is not, and one list doing both would need two gestures per row.
//
// Hidden columns stay on the list, greyed and still draggable, so a column's place can be set before
// it is shown — the alternative is show it, drag it, hide it again.
export function ColumnOrderDialog({
  open,
  onOpenChange,
  items,
  ranks,
  baseRanks,
  onSetRank,
  onReset,
}: PropsT) {
  const anchored = items.filter((item) => ANCHORED_COLUMN_KEYS.has(item.id))
  const movable = items.filter((item) => !ANCHORED_COLUMN_KEYS.has(item.id))
  const movableKeys = movable.map((item) => item.id)
  const labels = new Map(items.map((item) => [item.id, item]))

  // Writes ONE key: the moved group's new rank. Persisting the whole list would freeze today's
  // default order in every browser (see use-column-order).
  function handleReorder(next: string[]) {
    const key = movedKey(movableKeys, next)
    if (!key) return
    onSetRank(key, rankForMove(movableKeys, key, next.indexOf(key), ranks, baseRanks))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(90vw,420px)]">
        <DialogHeader
          title="Ustaw kolejność kolumn"
          description="Przeciągnij pozycję, żeby przestawić kolumny w tabeli. Ustawienie zapamiętuje ta przeglądarka i działa we wszystkich kosztorysach."
        />

        <div className="flex flex-col gap-1 overflow-y-auto">
          {anchored.map((item) => (
            <div
              key={item.id}
              className="text-muted-foreground bg-muted/40 flex items-center gap-2 rounded-md px-2 py-2 text-sm"
            >
              <GripVertical className="size-4 opacity-25" />
              {item.label}
              <span className="ml-auto text-xs">stała pozycja</span>
            </div>
          ))}

          <Reorder.Group
            axis="y"
            values={movableKeys}
            onReorder={handleReorder}
            className="flex list-none flex-col gap-1"
          >
            {movableKeys.map((key) => {
              const item = labels.get(key)
              return (
                <Reorder.Item
                  key={key}
                  value={key}
                  className={cn(
                    'bg-background hover:bg-accent flex cursor-grab items-center gap-2 rounded-md border px-2 py-2 text-sm active:cursor-grabbing',
                    item?.visible === false && 'text-muted-foreground',
                  )}
                >
                  <GripVertical className="text-muted-foreground size-4" />
                  {item?.label ?? key}
                  {item?.visible === false && <EyeOff className="ml-auto size-4" />}
                </Reorder.Item>
              )
            })}
          </Reorder.Group>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={Object.keys(ranks).length === 0}
            onClick={onReset}
          >
            Przywróć domyślną kolejność
          </Button>
          <DialogClose asChild>
            <Button size="sm">Zamknij</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
