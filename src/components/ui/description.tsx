import { Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type DescriptionSizeT = 'sm' | 'xs'

type DescriptionPropsT = {
  children: React.ReactNode
  className?: string
  withIcon?: boolean
  size?: DescriptionSizeT
}

const TEXT_SIZE: Record<DescriptionSizeT, string> = {
  sm: 'text-sm',
  xs: 'text-xs',
}

export function Description({
  children,
  className,
  withIcon = true,
  size = 'sm',
}: DescriptionPropsT) {
  return (
    <p className={cn('text-muted-foreground flex items-start gap-1', TEXT_SIZE[size], className)}>
      {/* The icon fills the shorter xs line already; sm's taller line leaves it high, so nudge it down. */}
      {withIcon && <Info className={cn(size === 'sm' && 'mt-0.5')} aria-hidden />}
      <span>{children}</span>
    </p>
  )
}
