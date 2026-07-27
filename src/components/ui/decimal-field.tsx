'use client'

import type { FocusEvent, KeyboardEvent, ReactNode } from 'react'
import { DecimalInput } from '@/components/ui/decimal-input'
import { HintTooltip } from '@/components/ui/tooltip'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

type PropsT = {
  label: ReactNode
  // Optional explanatory tooltip on the LABEL only — the input stays a clean text field.
  hint?: string
  value: number | null
  placeholder?: number
  // Colours the value only; a direct color on the input overrides the muted colour the label inherits.
  valueClassName?: string
  // Accepted range. An entry outside it is REJECTED here — the field snaps back to `value` and no
  // commit fires — rather than travelling to the server action to come back as a Zod error toast.
  // A bound the action already enforces (`vatRate` is `.min(0).max(1)`) belongs on the input too:
  // the toast tells the user what they may not do only after they have already done it.
  min?: number
  max?: number
  // What a cleared field commits. Without it, blanking the input is a silent no-op — the field looks
  // empty while the old value is still stored, so „skasuj kwotę" never actually clears anything.
  emptyAs?: number
  disabled?: boolean
  onCommit: (n: number) => void
}

// Decimal-number field. Uncontrolled + `key` on the value (remount after router.refresh),
// commit on blur/Enter — no useEffect (project rule).
export function DecimalField({
  label,
  hint,
  value,
  placeholder,
  valueClassName,
  min,
  max,
  emptyAs,
  disabled = false,
  onCommit,
}: PropsT) {
  const outOfRange = (n: number) => (min != null && n < min) || (max != null && n > max)

  const commit = (e: FocusEvent<HTMLInputElement>) => {
    const parsed = parseDecimalInput(e.target.value)
    if (parsed.kind === 'empty' && emptyAs != null) {
      onCommit(emptyAs)
      return
    }
    if (parsed.kind !== 'value') return
    // Written back by hand: the input is uncontrolled and its `key` only remounts when `value`
    // CHANGES, so a rejected entry would otherwise stay on screen as text the app has not accepted.
    if (outOfRange(parsed.value)) {
      e.target.value = value == null ? '' : String(value)
      return
    }
    onCommit(parsed.value)
  }

  const commitOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <label className="text-muted-foreground flex items-center gap-1 text-xs">
      {hint ? <HintTooltip content={hint}>{label}</HintTooltip> : label}
      <DecimalInput
        key={value == null ? 'null' : String(value)}
        defaultValue={value == null ? '' : String(value)}
        placeholder={placeholder != null ? String(placeholder) : ''}
        className={valueClassName}
        disabled={disabled}
        onBlur={commit}
        onKeyDown={commitOnEnter}
      />
    </label>
  )
}
