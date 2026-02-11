import { cn } from '@/lib/cn'

type PropsT = {
  placement: 'top' | 'bottom'
  className?: string
}

export function Gradient({ placement, className }: PropsT) {
  return (
    <div
      className={cn(
        'from-black-100/10 via-black-100/10 pointer-events-none absolute right-0 left-0 z-10 h-18 to-transparent',
        placement === 'top' && 'top-0 bg-linear-to-b',
        placement === 'bottom' && 'bottom-0 bg-linear-to-t',
        className,
      )}
    ></div>
  )
}
