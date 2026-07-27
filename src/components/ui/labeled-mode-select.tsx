'use client'

import type { ReactNode } from 'react'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { Description } from '@/components/ui/description'

type PropsT = {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOptionT[]
  description: ReactNode
  disabled?: boolean
  // Rendered below the description — the settlement mode's zero-VAT warning, the netto pricing rate
  // field. Only shown when the caller has one for the current value.
  children?: ReactNode
}

// A label + select row with the picked option's explanation underneath — the shape SettlementModeSelect
// and MaterialsNetPricingControl both need for a set-once decision about the deal, so the two read as
// one settings form instead of two near-identical implementations.
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
        <SimpleSelect
          value={value}
          onValueChange={onValueChange}
          options={options}
          disabled={disabled}
          variant="toolbarSm"
        />
      </div>
      <Description className="max-w-lg whitespace-pre-wrap" size="xs" withIcon={false}>
        {description}
      </Description>
      {children}
    </div>
  )
}
