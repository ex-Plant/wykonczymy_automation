import { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type PropsT = {
  className?: string
  children: ReactNode
  style?: CSSProperties
}

export function NavGroupWrapper({ children, className, style }: PropsT) {
  return (
    <div
      style={style}
      className={cn(
        `border-black-10 dark:bg-background-contrast dark:border-contrast flex rounded-[8px] border bg-white p-1`,
        className,
      )}
    >
      {children}
    </div>
  )
}
