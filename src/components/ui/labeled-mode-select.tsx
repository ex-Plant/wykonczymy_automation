'use client'

import type { ReactNode } from 'react'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type PropsT = {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOptionT[]
  // The picked option's explanation. Omitted for an option that needs none — the icon disappears
  // with it, rather than opening onto empty space.
  description?: ReactNode
  disabled?: boolean
  // Rendered below the row — the settlement mode's zero-VAT warning, the netto pricing rate field.
  // Only shown when the caller has one for the current value.
  children?: ReactNode
}

// A label + select row for a set-once decision about the deal, with the picked option's explanation
// behind an (i) rather than printed underneath: the settings popover stacks four of these, and four
// paragraphs of prose made it a wall to scroll past instead of a form to fill.
export function LabeledModeSelect({
  label,
  value,
  onValueChange,
  options,
  description,
  disabled = false,
  children,
}: PropsT) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Description withIcon={false} size="xs">
          {label}
        </Description>
        {description && <InfoTooltip content={description} label={`Więcej o: ${label}`} />}
        <SimpleSelect
          value={value}
          onValueChange={onValueChange}
          options={options}
          disabled={disabled}
          variant="toolbarSm"
        />
      </div>
      {children}
    </div>
  )
}
