import { cn } from '@/lib/cn'

type SkeletonPropsT = React.HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonPropsT) {
  return <div className={cn('bg-muted animate-pulse rounded-md', className)} {...props} />
}
