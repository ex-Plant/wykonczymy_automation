import { cn } from '@/lib/cn'

export const GridVisualHelper = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-10000 mx-auto w-full max-w-screen-2xl px-6">
      <div className="grid h-full grid-cols-4 gap-4 sm:grid-cols-8 md:grid-cols-12 xl:grid-cols-16">
        <GridVisualHelperRow /> {/* 4 columns - mobile */}
        <GridVisualHelperRow />
        <GridVisualHelperRow />
        <GridVisualHelperRow />
        {/* SM: 8 columns */}
        <GridVisualHelperRow className="hidden sm:block" />
        <GridVisualHelperRow className="hidden sm:block" />
        <GridVisualHelperRow className="hidden sm:block" />
        <GridVisualHelperRow className="hidden sm:block" />
        {/* MD: 12 columns */}
        <GridVisualHelperRow className="hidden md:block" />
        <GridVisualHelperRow className="hidden md:block" />
        <GridVisualHelperRow className="hidden md:block" />
        <GridVisualHelperRow className="hidden md:block" />
        {/* XL: 16 columns */}
        <GridVisualHelperRow className="hidden xl:block" />
        <GridVisualHelperRow className="hidden xl:block" />
        <GridVisualHelperRow className="hidden xl:block" />
        <GridVisualHelperRow className="hidden xl:block" />
      </div>
    </div>
  )
}

const GridVisualHelperRow = ({ className }: { className?: string }) => {
  return (
    <div className={cn('col-span-1 border-[0.5px] border-r border-black/20', className)}>
      <div className="h-full bg-red-500/10"></div>
    </div>
  )
}
