'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown, ListOrdered } from 'lucide-react'

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { persistOrderBlockReason } from '@/lib/kosztorys/sort-lock-hints'
import { cn } from '@/lib/utils/cn'
import { HeaderMenu } from '@/components/ui/datasheet-grid/header-menu'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import type { SortPickT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { SortDirT, SortScopeT } from '@/lib/kosztorys/row-view'

type PropsT = {
  label: string
  active: SortPickT | null
  onSort: (pick: SortPickT | null) => void
  // „Utrwal kolejność" — writes the sort showing right now into the stored order, so it survives
  // clearing the sort. Absent in the read-only view, where the item does not appear at all. It sits
  // in this menu because it bakes THIS menu's sort; from a column header there is no one section to
  // aim at, so it covers every section at once.
  onPersistOrder?: () => void
  // Explanatory tooltip composed ONTO the trigger (not a wrapping element) — a second wrapping
  // trigger would fight the dropdown for the click.
  tip?: string
}

export function SortHeader({ label, active, onSort, onPersistOrder, tip }: PropsT) {
  const persistBlockReason = persistOrderBlockReason(active?.scope ?? null)
  const Icon = active?.dir === 'asc' ? ArrowUp : active?.dir === 'desc' ? ArrowDown : ChevronsUpDown

  // Scope is spelled out in each label instead of hiding behind a mode toggle: four commands, so
  // direction and scope are picked in one gesture and no scope can be in force unnoticed.
  function item(dir: SortDirT, scope: SortScopeT, text: string) {
    const DirIcon = dir === 'asc' ? ArrowUp : ArrowDown
    const on = active?.dir === dir && active.scope === scope
    return (
      <DropdownMenuItem onSelect={() => onSort({ dir, scope })}>
        <DirIcon className={cn(on ? 'opacity-100' : 'opacity-50')} />
        {text}
      </DropdownMenuItem>
    )
  }

  // The active-sort weight goes on the label element, not triggerClassName: HeaderLabel's own
  // font-medium sits on that element and would beat anything merely inherited from the trigger.
  return (
    <HeaderMenu
      label={<HeaderLabel className={cn(active && 'font-semibold')}>{label}</HeaderLabel>}
      icon={<Icon className={cn('size-4 shrink-0', active ? 'opacity-100' : 'opacity-50')} />}
      triggerClassName={cn(active && 'text-primary')}
      triggerTitle="Sortuj kolumnę"
      tip={tip}
    >
      {item('asc', 'section', 'Sortuj rosnąco w sekcjach')}
      {item('desc', 'section', 'Sortuj malejąco w sekcjach')}
      <DropdownMenuSeparator />
      {item('asc', 'global', 'Sortuj rosnąco w całym kosztorysie')}
      {item('desc', 'global', 'Sortuj malejąco w całym kosztorysie')}
      <DropdownMenuSeparator />
      {onPersistOrder && (
        // The wrapper div catches the hover a disabled item swallows (pointer-events-none), and keeps
        // the tooltip and the menu item off each other's ref.
        <SimpleTooltip
          content={
            persistBlockReason ??
            'Zapisuje bieżącą kolejność we wszystkich sekcjach — zostanie po wyłączeniu sortowania'
          }
        >
          <div>
            <DropdownMenuItem disabled={persistBlockReason != null} onSelect={onPersistOrder}>
              <ListOrdered />
              Utrwal kolejność
            </DropdownMenuItem>
          </div>
        </SimpleTooltip>
      )}
      <DropdownMenuItem disabled={!active} onSelect={() => onSort(null)}>
        <ChevronsUpDown className="opacity-50" />
        Wyczyść sortowanie
      </DropdownMenuItem>
    </HeaderMenu>
  )
}
