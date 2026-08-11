'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils/cn'

type PropsT = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'inputMode'>

// Shared styled decimal text field — the visual primitive behind DecimalField (uncontrolled,
// commit-on-blur) and controlled callers like the percent-rabat tool. `type=text` + inputMode=decimal
// so parseDecimalInput owns parsing (comma/dot, empty); h-6 lines up with the SimpleSelect family.
export function DecimalInput({ className, ...props }: PropsT) {
  return (
    <input
      type="text"
      inputMode="decimal"
      className={cn(
        'border-border h-6 w-20 rounded border bg-transparent px-1 text-right text-xs outline-none disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}
