'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { INSPECTION_TYPE_LABELS, type InspectionTypeT } from '@/lib/fleet/inspection-types'

/**
 * The tick-list behind both fleet surfaces that pick a set of inspection types: „Do wymiany" on the
 * vehicle card and „Nie dotyczy (bezterminowo)" in the vehicle form.
 *
 * Which types it offers is the caller's: a mark goes on anything somebody performs, an exemption only
 * on something with a deadline — the lists differ, the widget does not. It hands back the whole next
 * set rather than the type that moved, so neither caller re-derives add-or-remove.
 */
export function InspectionTypeCheckboxes<T extends InspectionTypeT>({
  types,
  selected,
  onChange,
}: {
  types: readonly T[]
  selected: readonly T[]
  onChange: (next: T[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {types.map((type) => (
        <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={selected.includes(type)}
            onCheckedChange={() =>
              onChange(
                selected.includes(type)
                  ? selected.filter((candidate) => candidate !== type)
                  : [...selected, type],
              )
            }
          />
          {INSPECTION_TYPE_LABELS[type].pl}
        </label>
      ))}
    </div>
  )
}
