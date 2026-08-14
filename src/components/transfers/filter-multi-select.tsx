'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, type LucideIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { FilterTriggerButton } from '@/components/transfers/filter-trigger-button'
import { cn } from '@/lib/utils/cn'

type OptionT = { value: string; label: string }

type FilterMultiSelectPropsT = {
  values: string[]
  onValuesChange: (values: string[]) => void
  options: OptionT[]
  label: string
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  searchable?: boolean
  triggerClassName?: string
  // Render just the icon (no label / count) — for tight surfaces where a tooltip carries the meaning.
  iconOnly?: boolean
  title?: string
  // Copy for the select-all row, which flips between the two. Overridable because a caller whose
  // checkmarks mean "renders in the grid" wants the OUTCOME named („Pokaż/Ukryj wszystkie"), not the
  // mechanism — the default suits a plain list filter.
  selectAllLabel?: string
  deselectAllLabel?: string
  // Extra rows beside the select-all one, for caller-defined bulk selection moves
  // (e.g. "untick every section with no executed work"). `select` maps the current selection to the
  // next one; it routes through the same local state as the other rows, so the checkmarks move with
  // it.
  extraActions?: ReadonlyArray<{ label: string; select: (current: string[]) => string[] }>
  // An independent group of on/off rows above the options, owned entirely by the caller. Lets one
  // menu answer one question („czego nie widzę") with two mechanisms behind it, instead of splitting
  // the answer across two triggers the user has to check separately.
  toggles?: ReadonlyArray<{ id: string; label: string; active: boolean; onToggle: () => void }>
  // Replaces the trigger's derived "how many options are ticked" count (hidden at 0). For a caller
  // whose menu hides things by more than the option list, where the ticked count would answer a
  // question nobody asked.
  triggerCount?: number
}

// URL param encoding: [] = all selected (no filter), ['__none__'] = nothing selected
export const FILTER_NONE = '__none__'
const DEBOUNCE_MS = 600

export function FilterMultiSelect({
  values,
  onValuesChange,
  options,
  label,
  icon: Icon,
  iconPosition = 'left',
  searchable = false,
  triggerClassName,
  iconOnly = false,
  title,
  selectAllLabel = 'Zaznacz wszystkie',
  deselectAllLabel = 'Odznacz wszystkie',
  extraActions,
  toggles,
  triggerCount,
}: FilterMultiSelectPropsT) {
  const [open, setOpen] = useState(false)
  const [localSelected, setLocalSelected] = useState<string[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allValues = options.map((o) => o.value)

  // Decode URL params → actual selection (inverse of flush)
  function deriveSelected(vals: string[]) {
    const hasNone = vals.length === 1 && vals[0] === FILTER_NONE
    const hasNoFilter = vals.length === 0
    return hasNone ? [] : hasNoFilter ? allValues : vals
  }

  // While open, use local state. While closed, use props.
  const selected = localSelected ?? deriveSelected(values)
  const allSelected = selected.length === options.length

  // Encode selection → URL params (inverse of deriveSelected)
  function flush(next: string[]) {
    const allAreSelected = next.length === options.length
    if (allAreSelected) onValuesChange([])
    else if (next.length === 0) onValuesChange([FILTER_NONE])
    else onValuesChange(next)
  }

  function scheduleFlush(next: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      flush(next)
      debounceRef.current = null
    }, DEBOUNCE_MS)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setLocalSelected(deriveSelected(values))
      setOpen(true)
      return
    }

    // If there's a pending debounce, flush immediately on close
    if (debounceRef.current && localSelected) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      flush(localSelected)
    }
    setLocalSelected(null)
    setOpen(false)
  }

  function toggleValue(value: string) {
    const isSelected = selected.includes(value)
    const next = isSelected ? selected.filter((v) => v !== value) : [...selected, value]
    const result = next.length === 0 ? [] : next
    setLocalSelected(result)
    scheduleFlush(result)
  }

  function toggleAll() {
    const next = allSelected ? [] : [...allValues]
    setLocalSelected(next)
    scheduleFlush(next)
  }

  function runExtraAction(select: (current: string[]) => string[]) {
    const next = select(selected)
    setLocalSelected(next)
    scheduleFlush(next)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <FilterTriggerButton
          active={!allSelected}
          icon={Icon}
          iconPosition={iconPosition}
          className={triggerClassName}
          title={title}
        >
          {iconOnly ? null : (
            <>
              {label}
              {triggerCount == null
                ? allSelected
                  ? ''
                  : ` (${selected.length})`
                : triggerCount > 0
                  ? ` (${triggerCount})`
                  : ''}
            </>
          )}
        </FilterTriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder="Szukaj..." />}
          <CommandList>
            {toggles && toggles.length > 0 && (
              <>
                <CommandGroup>
                  {toggles.map((toggle) => (
                    <CommandItem key={toggle.id} value={toggle.label} onSelect={toggle.onToggle}>
                      <CheckIcon className={cn(!toggle.active && 'opacity-0')} />
                      {toggle.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup>
              <CommandItem onSelect={toggleAll} className="font-medium">
                <CheckIcon className={cn(!allSelected && 'opacity-0')} />
                {allSelected ? deselectAllLabel : selectAllLabel}
              </CommandItem>
              {extraActions?.map((action) => (
                <CommandItem
                  key={action.label}
                  onSelect={() => runExtraAction(action.select)}
                  className="font-medium"
                >
                  <CheckIcon className="opacity-0" />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => toggleValue(opt.value)}
                >
                  <CheckIcon className={cn(!selected.includes(opt.value) && 'opacity-0')} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandEmpty>Brak wyników</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
