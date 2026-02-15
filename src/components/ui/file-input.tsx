import * as React from 'react'

import { cn } from '@/lib/cn'

const FileInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="file"
      data-slot="file-input"
      className={cn(
        'text-muted-foreground block w-full text-sm',
        'file:bg-primary file:text-primary-foreground file:hover:bg-primary/90 file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  ),
)

FileInput.displayName = 'FileInput'

export { FileInput }
