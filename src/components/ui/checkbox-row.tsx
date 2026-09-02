import type { ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

// The whole row is the hit target, which is why the label carries the padding and the hover — a
// bare `<Checkbox>` next to text gives a 16px one.
export function CheckboxRow({
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <label className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(state) => onCheckedChange(state === true)}
      />
      {children}
    </label>
  )
}
