import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { Description } from '@/components/ui/description'

// Shared column widths for the stacked summary grids. Both render as CSS grids and pin their first
// (label) column to the SAME width so the grids line up down the panel instead of each auto-sizing
// its own first column. A track is a `gridTemplateColumns` value, not an element, so these stay
// constants — everything else here is a component.
export const SUMMARY_LABEL_COL = '16rem'
// Every trailing column (netto / brutto / udział) shares one width so they read as an even set.
export const SUMMARY_VALUE_COL = '9rem'

// The shared table shell every summary grid repeats: a `bg-border` container whose `gap-px` paints
// 1px separators between the (direct-child) cells its rows lay down; each cell repaints `bg-background`
// on top. `cols` is the `gridTemplateColumns` track list. Callers pass width helpers (`w-fit`) via
// `className`.
export function SummaryTable({
  cols,
  className,
  children,
}: {
  cols: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      style={{ gridTemplateColumns: cols }}
      className={cn('border-border bg-border grid gap-px border', className)}
    >
      {children}
    </div>
  )
}

// The only three colours a summary cell may take — a bare grep for `text-chart-green` /
// `text-destructive` anywhere under summary/ means someone bypassed this and repaint drifts.
const CELL_TONE = {
  default: '',
  success: 'text-chart-green',
  error: 'text-destructive',
} as const

// The only two weights a summary cell may take, beyond the unstyled default.
const CELL_WEIGHT = {
  default: '',
  medium: 'font-medium',
  bold: 'font-bold',
} as const

export type SummaryCellToneT = keyof typeof CELL_TONE
export type SummaryCellWeightT = keyof typeof CELL_WEIGHT

// A one-line note tucked under a cell's value — an inline explanation (why it's negative, why it's
// unassigned) instead of a fourth unrelated row. Callers opt in with `note`; there is no second way
// to attach one, so every cell's note reads and lays out the same.
type SummaryCellNoteT = {
  text: string
  tone?: 'muted' | 'error'
}

type SummaryCellPropsT = {
  // Grey this cell (the inactive money column while both netto and brutto show). `opacity`, not a
  // muted text colour, so it also dims coloured amounts — success green, error red.
  muted?: boolean
  tone?: SummaryCellToneT
  weight?: SummaryCellWeightT
  className?: string
  children: ReactNode
  note?: SummaryCellNoteT | null
}

function CellNote({ note }: { note: SummaryCellNoteT }) {
  return (
    <Description size="2xs" tone={note.tone ?? 'muted'} className="font-normal">
      {note.text}
    </Description>
  )
}

// A label-track cell — one of the direct grid children the separators run between.
export function SummaryLabelCell({
  muted,
  tone,
  weight,
  className,
  children,
  note,
}: SummaryCellPropsT) {
  return (
    <span
      className={cn(
        'bg-background px-3 py-1',
        CELL_TONE[tone ?? 'default'],
        CELL_WEIGHT[weight ?? 'default'],
        muted && 'opacity-40',
        note && 'flex flex-col items-start',
        className,
      )}
    >
      {children}
      {note && <CellNote note={note} />}
    </span>
  )
}

// A value-track cell — right-aligned, tabular figures.
export function SummaryValueCell({
  muted,
  tone,
  weight,
  className,
  children,
  note,
}: SummaryCellPropsT) {
  return (
    <span
      className={cn(
        'bg-background px-3 py-1 text-right tabular-nums',
        CELL_TONE[tone ?? 'default'],
        CELL_WEIGHT[weight ?? 'default'],
        muted && 'opacity-40',
        note && 'flex flex-col items-end',
        className,
      )}
    >
      {children}
      {note && <CellNote note={note} />}
    </span>
  )
}

// A column header cell over the label track (`variant="label"`) or a value track (default).
export function SummaryHeaderCell({
  variant = 'value',
  muted,
  className,
  children,
}: {
  variant?: 'label' | 'value'
  muted?: boolean
  className?: string
  children: ReactNode
}) {
  const Cell = variant === 'label' ? SummaryLabelCell : SummaryValueCell
  return (
    <Cell muted={muted} className={cn('text-muted-foreground text-xs', className)}>
      {children}
    </Cell>
  )
}

// The single scroll region shared by both totals-panel planes: it grows to fill the collapsible's
// bounded body and scrolls internally, so the content clears the toolbar instead of hiding under it
// while the trigger bar stays pinned above. Flex-bounded (not a viewport max-height) so it tracks the
// actual panel height in one place.
export function SummaryScrollRegion({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('min-h-0 w-full flex-1 overflow-y-auto', className)}>{children}</div>
}
