import { cn } from '@/lib/cn'

export const GridVisualHelper = () => {
  return (
    <div className={`fest-container pointer-events-none fixed inset-0 z-10000`}>
      <div className={`fest-grid h-full`}>
        <GridVisualHelperRow /> {/* 4 columns - mobile */}
        <GridVisualHelperRow />
        <GridVisualHelperRow />
        <GridVisualHelperRow />
        {/* SM: 8 columns */}
        <GridVisualHelperRow className={`hidden sm:block`} />
        <GridVisualHelperRow className={`hidden sm:block`} />
        <GridVisualHelperRow className={`hidden sm:block`} />
        <GridVisualHelperRow className={`hidden sm:block`} />
        {/* MD: 12 columns */}
        <GridVisualHelperRow className={`hidden md:block`} />
        <GridVisualHelperRow className={`hidden md:block`} />
        <GridVisualHelperRow className={`hidden md:block`} />
        <GridVisualHelperRow className={`hidden md:block`} />
        {/* XL: 16 columns */}
        <GridVisualHelperRow className={`hidden xl:block`} />
        <GridVisualHelperRow className={`hidden xl:block`} />
        <GridVisualHelperRow className={`hidden xl:block`} />
        <GridVisualHelperRow className={`hidden xl:block`} />
      </div>
    </div>
  )
}

const GridVisualHelperRow = ({ className }: { className?: string }) => {
  return (
    <div className={cn(`col-span-1 border-[0.5px] border-r border-black/20`, className)}>
      <div className={`h-full bg-red-500/10`}></div>
    </div>
  )
}
