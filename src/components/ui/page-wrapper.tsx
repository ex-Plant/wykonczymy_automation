import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type PageWrapperPropsT = {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export function PageWrapper({ title, description, children, className }: PageWrapperPropsT) {
  return (
    <div className={cn('grid grid-cols-1 gap-6 p-6 lg:p-8', className)}>
      <h1 className="text-foreground text-2xl font-semibold">{title}</h1>

      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}

      {children}
    </div>
  )
}
