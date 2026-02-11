'use client'

import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'

const separatorVariants = cva('shrink-0', {
  variants: {
    variant: {
      default: 'bg-border',
      fest: 'bg-black-10',
    },
    orientation: {
      horizontal: 'h-px w-full',
      vertical: 'h-5 w-px',
    },
  },
  defaultVariants: {
    variant: 'default',
    orientation: 'horizontal',
  },
})

type SeparatorPropsT = React.ComponentProps<typeof SeparatorPrimitive.Root> &
  VariantProps<typeof separatorVariants>

function Separator({
  className,
  orientation = 'vertical',
  variant = 'default',
  decorative = true,
  ...props
}: SeparatorPropsT) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      data-variant={variant}
      decorative={decorative}
      orientation={orientation}
      className={cn('dark:bg-contrast', separatorVariants({ variant, orientation }), className)}
      {...props}
    />
  )
}

export { Separator, separatorVariants }
