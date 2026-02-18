import { Skeleton } from '@/components/ui/skeleton'

const SKELETON_ROWS = 5
const SKELETON_COLS = 6

export function TransferTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        {/* Header */}
        <div className="border-b px-4 py-3">
          <div className="flex gap-4">
            {Array.from({ length: SKELETON_COLS }).map((_, i) => (
              <Skeleton key={`h-${i}`} className="h-4 flex-1" />
            ))}
          </div>
        </div>

        {/* Rows */}
        {Array.from({ length: SKELETON_ROWS }).map((_, rowIdx) => (
          <div key={`r-${rowIdx}`} className="border-b px-4 py-3 last:border-b-0">
            <div className="flex gap-4">
              {Array.from({ length: SKELETON_COLS }).map((_, colIdx) => (
                <Skeleton key={`c-${rowIdx}-${colIdx}`} className="h-4 flex-1" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  )
}
