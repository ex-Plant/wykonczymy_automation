import { forwardRef, type ComponentProps, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils/cn'

// onKeyDown is omitted rather than forwarded: Enter/Escape MUST be swallowed here so the keypress
// can't also drive react-datasheet-grid's selection underneath the cell, and a raw handler would let
// a caller opt out of that.
type PropsT = Omit<ComponentProps<'input'>, 'onKeyDown'> & {
  onEnter?: (event: KeyboardEvent<HTMLInputElement>) => void
  onEscape?: (event: KeyboardEvent<HTMLInputElement>) => void
}

// The editable counterpart to ReadOnlyCellText: shared input chrome so custom-input cells (section
// name, discount value, subcontractor overrides) can't drift on their editable markup the way their
// read-only halves already had once.
export const EditableCellInput = forwardRef<HTMLInputElement, PropsT>(function EditableCellInput(
  { className, onEnter, onEscape, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn('size-full bg-transparent px-2 text-left text-sm outline-none', className)}
      onKeyDown={(event) => {
        const handler = event.key === 'Enter' ? onEnter : event.key === 'Escape' ? onEscape : null
        if (!handler) return
        event.preventDefault()
        event.stopPropagation()
        handler(event)
      }}
      {...props}
    />
  )
})
