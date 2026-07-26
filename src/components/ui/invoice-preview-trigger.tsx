import { FileText, Search } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type InvoicePreviewTriggerPropsT = {
  isImage: boolean
  label: string
  onClick: () => void
  // `compact` is the icon-only shape for a table cell; it carries no box size of its own, so each
  // caller sets one via `className` — the transfers table and a fixed-height virtualized row have
  // different height budgets and can't share a number.
  variant?: 'field' | 'compact'
  className?: string
}

export function InvoicePreviewTrigger({
  isImage,
  label,
  onClick,
  variant = 'field',
  className,
}: InvoicePreviewTriggerPropsT) {
  const isCompact = variant === 'compact'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Podgląd: ${label}`}
      className={cn(
        'text-muted-foreground hover:text-foreground flex cursor-pointer items-center transition-colors',
        isCompact
          ? 'hover:bg-muted justify-center rounded [&_svg]:size-4'
          : 'border-input hover:border-primary/50 hover:bg-muted/50 h-9 w-full min-w-0 gap-2 rounded-md border px-3',
        className,
      )}
    >
      {isImage ? <Search /> : <FileText />}
      {!isCompact && <span className="truncate text-sm">{label}</span>}
    </button>
  )
}
