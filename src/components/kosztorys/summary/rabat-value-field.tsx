'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

type PropsT = {
  // The stored figure to show. '' for the percent tool, which stamps into the items and stores nothing.
  value: string
  placeholder?: string
  disabled?: boolean
  isValid: (value: number) => boolean
  // Resolves false when the write failed — that is what decides whether a one-shot input clears.
  onApply: (value: number) => Promise<boolean> | void
  // The percent tool stamps and forgets, so its input empties; the kwota keeps showing what is stored.
  clearOnApply?: boolean
}

// Both rabat-globalny modes commit the same way: type, then press „Zapisz" (or Enter). Nothing is
// written on blur — a rabat is a deal-level concession, so leaving the field must never be enough to
// change it, and the two modes must not disagree about what counts as confirming a value.
export function RabatValueField({
  value,
  placeholder,
  disabled = false,
  isValid,
  onApply,
  clearOnApply = false,
}: PropsT) {
  const [raw, setRaw] = useState(value)
  const [pending, setPending] = useState(false)

  // Undo, a failed save rolling back, or a mode switch reseeding the kwota all move the stored figure
  // without touching this input — resync so the field never shows a value that is no longer stored.
  const [seenValue, setSeenValue] = useState(value)
  if (seenValue !== value) {
    setSeenValue(value)
    setRaw(value)
  }

  const parsed = parseDecimalInput(raw)
  const parsedValue = parsed.kind === 'value' ? parsed.value : null
  // `raw !== value` keeps „Zapisz" inert until something actually changed, so the button doubles as
  // the answer to „did my edit go through".
  const canApply = parsedValue != null && isValid(parsedValue) && raw !== value

  async function apply() {
    if (!canApply || pending || parsedValue == null) return
    setPending(true)
    const ok = await onApply(parsedValue)
    setPending(false)
    if (ok !== false && clearOnApply) setRaw('')
  }

  return (
    <div className="flex items-center gap-2">
      <DecimalInput
        value={raw}
        placeholder={placeholder}
        disabled={disabled || pending}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void apply()
        }}
        className="text-chart-green"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled={disabled || !canApply || pending}
        onClick={() => void apply()}
      >
        Zapisz
      </Button>
    </div>
  )
}
