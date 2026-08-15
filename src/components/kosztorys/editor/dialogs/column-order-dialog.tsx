'use client'

import { useState } from 'react'
import { Reorder, motion } from 'framer-motion'
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
import {
  ANCHORED_COLUMN_KEYS,
  movableColumnKeys,
  placeMovables,
  rankForMove,
  type ColumnRanksT,
} from '@/lib/kosztorys/column-order'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The picker's own list, already in grid order — one source for „which columns exist and what are
  // they called", so this window can't disagree with the visibility list beside it.
  items: ColumnToggleItemT[]
  ranks: ColumnRanksT
  baseRanks: ColumnRanksT
  onSetRank: (key: string, rank: number) => void
  onReset: () => void
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index])
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
  const keys = items.map((item) => item.id)
  const movableKeys = movableColumnKeys(keys)
  const labels = new Map(items.map((item) => [item.id, item]))

  // The list is driven locally while a drag is in flight and only committed on drop. Writing the
  // rank on every crossing instead would push a store update through the editor context mid-drag,
  // rebuilding the whole grid between frames — that is what made dragging crawl.
  const [order, setOrder] = useState(movableKeys)
  const [propsOrder, setPropsOrder] = useState(movableKeys)
  if (!sameKeys(propsOrder, movableKeys)) {
    setPropsOrder(movableKeys)
    setOrder(movableKeys)
  }

  // Anchors sit at their real index (`Opis prac` is NOT at the top — it lives behind „Rozjazd"),
  // movables fill the slots between them in drag order. Same interleave the grid runs.
  const slots = placeMovables(keys, order)

  // Writes ONE key: the dragged group's new rank. Persisting the whole list would freeze today's
  // default order in every browser (see use-column-order). The key comes from the row that was
  // dragged, so nothing has to be inferred from the two orders.
  function commitOrder(key: string) {
    if (sameKeys(movableKeys, order)) return
    onSetRank(key, rankForMove(movableKeys, key, order.indexOf(key), ranks, baseRanks))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(90vw,420px)]">
        <DialogHeader
          title="Ustaw kolejność kolumn"
          description="Przeciągnij pozycję, żeby przestawić kolumny w tabeli. Ustawienie zapamiętuje ta przeglądarka i działa we wszystkich kosztorysach."
        />

        {/* layoutScroll + min-h-0: without the first, framer measures drags against a stale scroll
            offset once the list is scrolled; without the second the inner box never shrinks in the
            dialog's flex column, so DialogContent scrolls instead and takes the footer with it. */}
        <motion.div layoutScroll className="min-h-0 overflow-y-auto">
          <Reorder.Group
            axis="y"
            values={order}
            onReorder={setOrder}
            className="flex list-none flex-col gap-1"
          >
            {slots.map((key) => {
              const item = labels.get(key)
              const label = item?.label ?? key
              if (ANCHORED_COLUMN_KEYS.has(key)) {
                return (
                  <div
                    key={key}
                    className="text-muted-foreground bg-muted/40 flex items-center gap-2 rounded-md px-2 py-2 text-sm"
                  >
                    {label}
                    <span className="ml-auto text-xs">stała pozycja</span>
                  </div>
                )
              }
              return (
                <Reorder.Item
                  key={key}
                  value={key}
                  onDragEnd={() => commitOrder(key)}
                  className={cn(
                    'bg-background hover:bg-accent flex cursor-grab items-center gap-2 rounded-md border px-2 py-2 text-sm active:cursor-grabbing',
                    item?.visible === false && 'text-muted-foreground',
                  )}
                >
                  <GripVertical className="text-muted-foreground size-4" />
                  {label}
                  {item?.visible === false && <EyeOff className="ml-auto size-4" />}
                </Reorder.Item>
              )
            })}
          </Reorder.Group>
        </motion.div>

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
