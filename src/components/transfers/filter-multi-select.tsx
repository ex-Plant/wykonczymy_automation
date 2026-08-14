'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, RotateCcw, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  // Replaces that flipping pair with one fixed sentence that ticks when it has been carried out — the
  // row stops being a label that rewrites itself under the cursor and becomes a state like every other
  // row in the menu. Its ON state is "nothing selected", so it reads as the opposite of the list.
  bulkToggleLabel?: string
  // Rows that tick a whole SUBSET of the options at once ("every section with no executed work").
  // They obey the same grammar as the options below them — a tick means "selected" — so both hooks
  // read the live local selection rather than any state of their own: `isActive` decides the tick,
  // `select` maps the current selection to the next one. Untick one member by hand and the group row
  // unticks with it, which is what keeps the two halves from ever disagreeing.
  optionToggles?: ReadonlyArray<{
    label: string
    isActive: (current: string[]) => boolean
    select: (current: string[]) => string[]
  }>
  // An independent group of on/off rows above the options, owned entirely by the caller. Lets one
  // menu answer one question („czego nie widzę") with two mechanisms behind it, instead of splitting
  // the answer across two triggers the user has to check separately.
  toggles?: ReadonlyArray<{ id: string; label: string; active: boolean; onToggle: () => void }>
  // Group captions, one per group in render order: the toggles, the bulk actions, the option list.
  // Worth setting once a menu mixes rows that act on different things — unlabelled, a separator only
  // says "these are different", never what each group is about.
  togglesHeading?: string
  actionsHeading?: string
  optionsHeading?: string
  // A one-click way back to "wszystko widać". It sits above the list as a Button rather than a row
  // with a checkmark because it is the one thing in the menu that is an action, not a state — its
  // own effect is to leave nothing engaged, so a tick would have nothing to report afterwards.
  // `onReset` covers whatever the caller keeps outside the option list; the option list itself is
  // reset here.
  resetAction?: { label: string; onReset: () => void; disabled?: boolean }
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
  bulkToggleLabel,
  optionToggles,
  toggles,
  resetAction,
  togglesHeading,
  actionsHeading,
  optionsHeading,
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

  // In fixed-label mode the row's own tick decides the direction, so clicking it always does what the
  // sentence says. The flipping-label mode keeps its original meaning: "everything is on → turn it off".
  const bulkActive = selected.length === 0

  function toggleAll() {
    const selectAll = bulkToggleLabel ? bulkActive : !allSelected
    const next = selectAll ? [...allValues] : []
    setLocalSelected(next)
    scheduleFlush(next)
  }

  // Flushes straight through: a pending debounce from the clicks being undone would land after the
  // reset and put them back.
  function handleReset() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setLocalSelected([...allValues])
    onValuesChange([])
    resetAction?.onReset()
  }

  function runOptionToggle(select: (current: string[]) => string[]) {
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
        {resetAction && (
          <div className="border-border border-b p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal"
              disabled={resetAction.disabled}
              onClick={handleReset}
            >
              <RotateCcw />
              {resetAction.label}
            </Button>
          </div>
        )}
        <Command>
          {searchable && <CommandInput placeholder="Szukaj..." />}
          <CommandList>
            {toggles && toggles.length > 0 && (
              <>
                <CommandGroup heading={togglesHeading}>
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
            <CommandGroup heading={actionsHeading}>
              <CommandItem onSelect={toggleAll}>
                <CheckIcon
                  className={cn(!(bulkToggleLabel ? bulkActive : allSelected) && 'opacity-0')}
                />
                {bulkToggleLabel ?? (allSelected ? deselectAllLabel : selectAllLabel)}
              </CommandItem>
              {optionToggles?.map((group) => (
                <CommandItem
                  key={group.label}
                  value={group.label}
                  onSelect={() => runOptionToggle(group.select)}
                >
                  <CheckIcon className={cn(!group.isActive(selected) && 'opacity-0')} />
                  {group.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={optionsHeading}>
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
