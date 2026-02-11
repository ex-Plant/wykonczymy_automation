import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive duration-300 cursor-pointer dark:hover:underline dark:hover:text-contrast dark:text-contrast dark:bg-background-contrast dark:border-contrast dark:hover:border-contrast",
  {
    variants: {
      variant: {
        default: 'hover:bg-black-100 hover:text-white-100 fest-label-small bg-white text-black-100',
        primary:
          'bg-black-100 text-white-100 fest-label-small hover:bg-transparent hover:text-black-100 border border-transparent hover:border-black-30',
        secondary:
          'bg-transparent text-black-100 fest-label-small border border-black-10 hover:border-black-30',
        tertiary:
          'bg-transparent text-black-100 fest-label-small rounded-[6px] border border-black-10 hover:border-black-30',
        outline:
          'bg-transparent text-black-100 fest-label-small border border-black-30 hover:bg-black-10',
        ghost: 'bg-transparent text-black-100 fest-label-small hover:bg-black-5',
        sidePanel:
          'bg-transparent text-black-100 fest-label-small justify-start rounded-[6px] hover:bg-black-10',
        gradient:
          'text-white-100 fest-label-small rounded-lg hover:opacity-90 dark:hover:opacity-90',
      },
      size: {
        // Fest Design System size (from Figma)
        fest: 'h-8 px-4 gap-2',
        lg: 'h-10 px-4 gap-2',
        sm: 'p-2 gap-2',
        icon: 'size-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'fest',
    },
  },
)

type GradientPropsT = {
  gradientFrom?: string
  gradientTo?: string
}

type ButtonPropsT = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> &
  GradientPropsT & {
    asChild?: boolean
  }

function Button({
  className,
  variant = 'primary',
  size = 'fest',
  asChild = false,
  gradientFrom = '#FF6756',
  gradientTo = '#D1A4FF',
  style,
  ...props
}: ButtonPropsT) {
  const Comp = asChild ? Slot : 'button'

  const gradientStyle =
    variant === 'gradient'
      ? {
          ...style,
          backgroundImage: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
        }
      : style

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      style={gradientStyle}
      {...props}
    />
  )
}

export { Button, buttonVariants }
