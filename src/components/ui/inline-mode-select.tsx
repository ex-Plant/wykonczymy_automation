'use client'

import type { ReactNode } from 'react'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type PropsT = {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOptionT[]
  // The picked option's explanation — the same copy the Opcje rozliczenia popover shows, so a reader
  // who meets the control here isn't told a different story than the one who opens the settings.
  description?: ReactNode
  disabled?: boolean
  // Why the choice can't be made right now. Present = the select greys out and the (i) explains the
  // lock instead of the picked option — same rule as the popover's: never hide a control, say why.
  lockedReason?: string
}

// The same set-once decision as in the Opcje rozliczenia popover, offered again where its consequences
// are on screen: the owner reading „Do zapłaty" is the one who wants to try the other tryb, and making
// them hunt for a popover to do it is what kept the figure and its cause apart.
export function InlineModeSelect({
  label,
  value,
  onValueChange,
  options,
  description,
  disabled = false,
  lockedReason,
}: PropsT) {
  const hint = lockedReason ?? description
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <SimpleSelect
        value={value}
        onValueChange={onValueChange}
        options={options}
        disabled={disabled || lockedReason !== undefined}
        variant="toolbarSm"
      />
      {hint && <InfoTooltip content={hint} label={`Więcej o: ${label}`} />}
    </div>
  )
}
