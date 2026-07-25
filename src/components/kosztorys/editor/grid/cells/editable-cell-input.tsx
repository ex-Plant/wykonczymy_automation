import { forwardRef, type ComponentProps, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils/cn'
import { enterEscapeKeyDown } from '@/lib/utils/enter-escape-keydown'

// onKeyDown is omitted rather than forwarded: Enter/Escape MUST be swallowed here so the keypress
// can't also drive react-datasheet-grid's selection underneath the cell, and a raw handler would let
// a caller opt out of that.
type PropsT = Omit<ComponentProps<'input'>, 'onKeyDown'> & {
  onEnter?: (event: KeyboardEvent<HTMLInputElement>) => void
  onEscape?: (event: KeyboardEvent<HTMLInputElement>) => void
}

export const EditableCellInput = forwardRef<HTMLInputElement, PropsT>(function EditableCellInput(
  { className, onEnter, onEscape, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn('size-full bg-transparent px-2 text-left text-sm outline-none', className)}
      onKeyDown={enterEscapeKeyDown({ onEnter, onEscape })}
      {...props}
    />
  )
})
