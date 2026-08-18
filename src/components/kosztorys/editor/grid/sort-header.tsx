'use client'

import { cn } from '@/lib/utils/cn'
import { HeaderMenu } from '@/components/ui/datasheet-grid/header-menu'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { SortIcon, SortMenuItems, type SortMenuPropsT } from './sort-menu-items'

type PropsT = SortMenuPropsT & {
  label: string
  tip?: string
}

export function SortHeader({ label, active, onSort, onPersistOrder, tip }: PropsT) {
  // The active-sort weight goes on the label element, not triggerClassName: HeaderLabel's own
  // font-medium sits on that element and would beat anything merely inherited from the trigger.
  return (
    <HeaderMenu
      label={<HeaderLabel className={cn(active && 'font-semibold')}>{label}</HeaderLabel>}
      icon={<SortIcon active={active} />}
      triggerClassName={cn(active && 'text-primary')}
      triggerTitle="Sortuj kolumnę"
      tip={tip}
    >
      <SortMenuItems active={active} onSort={onSort} onPersistOrder={onPersistOrder} />
    </HeaderMenu>
  )
}
