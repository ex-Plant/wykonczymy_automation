'use client'

import { type Table } from '@tanstack/react-table'
import { Settings2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

type ColumnTogglePropsT<TData> = {
  readonly table: Table<TData>
}

export function ColumnToggle<TData>({ table }: ColumnTogglePropsT<TData>) {
  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide() && col.columnDef.meta?.canHide !== false)

  if (toggleableColumns.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5">
          <Settings2 className="size-4" />
          Kolumny
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {toggleableColumns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={col.getIsVisible()}
            onCheckedChange={(value) => col.toggleVisibility(!!value)}
            onSelect={(e) => e.preventDefault()} // block closing dropdown upon selection
          >
            {col.columnDef.meta?.label ?? col.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
