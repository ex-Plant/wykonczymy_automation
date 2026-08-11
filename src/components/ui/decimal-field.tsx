'use client'

import { useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { cn } from '@/lib/utils/cn'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

type PropsT = {
  // Omitted where an enclosing block already names the figure — a second „Stawka" over one input is
  // noise, not a label.
  label?: ReactNode
  // Stack the label over the input instead of beside it. For a label too long to sit inline without
  // pushing the input off the row („Stawka vat na materiały").
  labelAbove?: boolean
  // Shown as an (i) icon beside the label — the input stays a clean text field. An icon, not a
  // hover target on the label text: nothing about bare text says a hint is hiding behind it.
  hint?: string
  // Unit printed after the input („%", „zł").
  suffix?: ReactNode
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
  // Commit behind a „Zapisz" button instead of on blur. For a field whose write reshapes figures
  // across the whole panel, where leaving the input must not be enough to trigger it — the same
  // contract RabatValueField holds for the rabat kwota, so the settings popover reads as one form.
  withSave?: boolean
  disabled?: boolean
  onCommit: (n: number) => void
}

// Uncontrolled + `key` on the value (remount after router.refresh), commit on blur/Enter — no
// useEffect (project rule).
export function DecimalField({
  label,
  labelAbove = false,
  hint,
  suffix,
  value,
  placeholder,
  valueClassName,
  min,
  max,
  emptyAs,
  withSave = false,
  disabled = false,
  onCommit,
}: PropsT) {
  const text = value == null ? '' : String(value)
  // What has been typed since the last time `value` moved. `null` = untouched, which is what keeps
  // „Zapisz" inert until something actually changed — the button doubles as the answer to „did my
  // edit go through". Only read in withSave mode; blur-commit reads the event's own target.
  const [typed, setTyped] = useState<string | null>(null)
  // A landed write (or an undo, or a rolled-back save) moves `value` without touching this input.
  // Resync so the button can't stay armed over an edit the field no longer shows.
  const [seenText, setSeenText] = useState(text)
  if (seenText !== text) {
    setSeenText(text)
    setTyped(null)
  }

  const outOfRange = (n: number) => (min != null && n < min) || (max != null && n > max)

  // The value `raw` would commit, or null when there is nothing acceptable to write.
  const commitValueOf = (raw: string): number | null => {
    const parsed = parseDecimalInput(raw)
    if (parsed.kind === 'empty') return emptyAs ?? null
    if (parsed.kind !== 'value' || outOfRange(parsed.value)) return null
    return parsed.value
  }

  const pending = typed == null || typed === text ? null : commitValueOf(typed)

  const commitOnBlur = (e: FocusEvent<HTMLInputElement>) => {
    const next = commitValueOf(e.target.value)
    if (next == null) {
      // Written back by hand: the input is uncontrolled and its `key` only remounts when `value`
      // CHANGES, so a rejected entry would otherwise stay on screen as text the app has not accepted.
      e.target.value = text
      return
    }
    onCommit(next)
  }

  return (
    <label
      className={cn(
        'text-muted-foreground flex gap-1 text-xs',
        labelAbove ? 'flex-col items-start' : 'items-center',
      )}
    >
      {(label || hint) && (
        <span className="flex items-center gap-1">
          {label}
          {hint && <InfoTooltip content={hint} />}
        </span>
      )}
      <span className="flex items-center gap-1">
        <DecimalInput
          key={text || 'null'}
          defaultValue={text}
          placeholder={placeholder != null ? String(placeholder) : ''}
          // A „Zapisz" beside the input means the pair reads as one control, so the input borrows the
          // Button's radius. Height stays the compact h-6 that lines up with the toolbar's selects.
          className={cn(withSave && 'rounded-md', valueClassName)}
          disabled={disabled}
          onChange={withSave ? (e) => setTyped(e.target.value) : undefined}
          onBlur={withSave ? undefined : commitOnBlur}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== 'Enter') return
            if (!withSave) e.currentTarget.blur()
            else if (pending != null) onCommit(pending)
          }}
        />
        {suffix}
        {withSave && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={disabled || pending == null}
            onClick={() => pending != null && onCommit(pending)}
          >
            Zapisz
          </Button>
        )}
      </span>
    </label>
  )
}
