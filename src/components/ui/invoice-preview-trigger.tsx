import { FileText, Search } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { InvoiceFileT } from '@/types/transfers'

export type InvoicePreviewTriggerPropsT = {
  invoices: InvoiceFileT[]
  label: string
  onClick: () => void
  // `compact` defaults to the ghost icon-button's 36px box but lets `className` override it — the
  // transfers table and a fixed-height virtualized row have different height budgets.
  variant?: 'field' | 'compact'
  className?: string
}

export function InvoicePreviewTrigger({
  invoices,
  label,
  onClick,
  variant = 'field',
  className,
}: InvoicePreviewTriggerPropsT) {
  const isCompact = variant === 'compact'
  const pageCount = invoices.length
  // A mixed set has no single icon that tells the truth, so it falls back to the document icon.
  const mimeTypes = new Set(invoices.map((invoice) => invoice.mimeType))
  const isImage = mimeTypes.size === 1 && [...mimeTypes][0]?.startsWith('image/')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        pageCount > 1
          ? `Podgląd faktury (${pageCount} stron): ${label}`
          : `Podgląd faktury: ${label}`
      }
      className={cn(
        'text-muted-foreground hover:text-foreground relative cursor-pointer',
        isCompact
          ? cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'mx-auto')
          : 'border-input hover:border-primary/50 hover:bg-muted/50 flex h-9 w-full min-w-0 items-center gap-2 rounded-md border px-3 transition-colors',
        className,
      )}
    >
      {isImage ? <Search /> : <FileText />}
      {!isCompact && <span className="truncate text-sm">{label}</span>}
      {pageCount > 1 && (
        // The icon alone can't say how many pages sit behind it. Absolutely positioned so the badge
        // never grows the box — the virtualized wydatki rows are laid out at a fixed height.
        <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[0.625rem] leading-none font-medium tabular-nums">
          {pageCount}
        </span>
      )}
    </button>
  )
}
