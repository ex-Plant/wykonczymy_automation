import { cn } from '@/lib/cn'

type SectionHeaderPropsT = {
  readonly children: React.ReactNode
  readonly className?: string
}

export function SectionHeader({ children, className }: SectionHeaderPropsT) {
  return <h2 className={cn('text-foreground text-lg font-semibold', className)}>{children}</h2>
}
