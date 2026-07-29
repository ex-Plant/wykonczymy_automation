import { Info, TriangleAlert } from 'lucide-react'
import { HintTooltip } from '@/components/ui/tooltip'

// Each variant owns its icon, tone and `aria-label`. The labels are asserted by E2E and read aloud
// by screen readers, so pinning them to the variant is what stops two surfaces drifting apart — and
// what makes picking the wrong one a type error rather than a silently wrong sentence. A variant
// whose copy never varies (`noVat`) owns its `content` too, so the caller passes nothing but intent.
const VARIANT = {
  mismatch: {
    Icon: TriangleAlert,
    className: 'text-destructive',
    ariaLabel: 'Niezgodność z transakcjami',
  },
  info: { Icon: Info, className: 'text-muted-foreground', ariaLabel: 'Informacja o pozycji' },
  noVat: {
    Icon: Info,
    className: 'text-muted-foreground',
    ariaLabel: 'Pozycja bez VAT',
    content: 'Pozycja bez VAT — kwota brutto równa się netto',
  },
} as const

// A variant that owns its copy takes no `content`; one explaining a per-row figure requires it.
export type LabelHintT =
  | { variant: 'mismatch'; content: string }
  | { variant: 'info'; content: string }
  | { variant: 'noVat' }

// The label-side counterpart to a value cell's `note`: a hover-only explanation icon beside a label.
// Cells take it as a prop (`hints`), so a row selects a variant instead of hand-rolling another
// HintTooltip+icon block inline and re-deciding icon, colour and aria-label each time.
export function LabelHintIcon(hint: LabelHintT) {
  const spec = VARIANT[hint.variant]
  const content = hint.variant === 'noVat' ? VARIANT.noVat.content : hint.content
  const { Icon } = spec

  return (
    <HintTooltip content={content} className={spec.className}>
      <Icon className="size-3.5" aria-label={spec.ariaLabel} />
    </HintTooltip>
  )
}
