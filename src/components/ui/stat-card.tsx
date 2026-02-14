import { cn } from '@/lib/cn'

type StatCardPropsT = {
  readonly label: string
  readonly value: string
  readonly className?: string
}

export function StatCard({ label, value, className }: StatCardPropsT) {
  return (
    <div className={cn('border-border bg-card rounded-lg border p-4', className)}>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-foreground mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}
