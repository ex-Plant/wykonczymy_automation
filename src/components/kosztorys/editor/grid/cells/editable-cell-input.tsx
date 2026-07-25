import { forwardRef, type ComponentProps } from 'react'
import { cn } from '@/lib/utils/cn'

// The editable counterpart to ReadOnlyCellText: shared input chrome so custom-input cells (section
// name, discount value, subcontractor overrides) can't drift on their editable markup the way their
// read-only halves already had once.
export const EditableCellInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  function EditableCellInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn('size-full bg-transparent px-2 text-left text-sm outline-none', className)}
        {...props}
      />
    )
  },
)
