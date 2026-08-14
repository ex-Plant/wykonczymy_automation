import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type FilterTriggerButtonPropsT = {
  active: boolean
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  children?: React.ReactNode
  className?: string
  title?: string
}

export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonPropsT>(
  function FilterTriggerButton(
    { active, icon: Icon, iconPosition = 'left', children, className, ...props },
    ref,
  ) {
    return (
      <Button
        ref={ref}
        variant={active ? 'activeFilter' : 'outline'}
        size="sm"
        align="start"
        className={cn('min-w-40', className)}
        {...props}
      >
        {Icon && iconPosition === 'left' && <Icon />}
        {children}
        {Icon && iconPosition === 'right' && <Icon />}
      </Button>
    )
  },
)
