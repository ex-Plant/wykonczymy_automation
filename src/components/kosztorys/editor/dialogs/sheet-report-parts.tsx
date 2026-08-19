'use client'

import { useState, type ReactNode } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'

// The shared vocabulary of a sheet report: a table whose first column is a label and whose rest are
// figures, and a fold that hides a long list behind its own summary line. Both dialogs („Pobierz z
// arkusza" and „Porównaj z arkuszem") are built from these, so a reader who has learned one has
// learned the other.

export function ReportTable({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-xs">
            {headers.map((header, index) => (
              <th
                key={index}
                // The first column carries the name of the thing, the rest carry its figures — one
                // left edge to scan down, one right edge to compare numbers along.
                className={`py-1 font-normal ${index === 0 ? 'text-left' : 'pl-3 text-right'}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export const SHEET_SIDE = 'Arkusz Google'
export const APP_SIDE = 'Ta aplikacja'

export type ReportCellT = { content: ReactNode; tone?: string }

export function ReportRow({ label, cells }: { label: ReactNode; cells: ReportCellT[] }) {
  return (
    <tr className="border-border/60 border-t align-middle">
      <td className="py-1">{label}</td>
      {cells.map((cell, index) => (
        <td
          key={index}
          className={`py-1 pl-3 text-right tabular-nums ${cell.tone ?? 'text-foreground'}`}
        >
          {cell.content}
        </td>
      ))}
    </tr>
  )
}

// Which side said what is the one thing the reader must never have to infer — hence named columns
// rather than a sentence with two numbers in it. Both dialogs put every side-by-side figure through
// this pair, so „Różnica" always means the same subtraction in the same direction.
export function ComparisonTable({ children }: { children: ReactNode }) {
  return <ReportTable headers={['', SHEET_SIDE, APP_SIDE, 'Różnica']}>{children}</ReportTable>
}

export function ComparisonRow({
  label,
  sheet,
  app,
  delta,
}: {
  label: ReactNode
  sheet: ReactNode
  app: ReactNode
  delta: string | null
}) {
  const cells: ReportCellT[] = [
    { content: sheet },
    { content: app },
    {
      content: delta ?? 'zgadza się',
      tone: delta === null ? 'text-muted-foreground' : 'text-amber-600',
    },
  ]
  return <ReportRow label={label} cells={cells} />
}

// „sekcja · opis", the way both dialogs name a praca they are listing rather than pricing. `note`
// is the rare per-praca aside — „wpisane etapy" on a praca an import is about to remove — and rides
// the same line so the eye picks it out of a fold that can run to hundreds of rows.
export function ItemList({
  items,
}: {
  items: { section: string; description: string; note?: string }[]
}) {
  return (
    <>
      {items.map((item, index) => (
        <p key={`${index}-${item.description}`} className="text-muted-foreground text-xs">
          {item.section} · {item.description}
          {item.note && <span className="text-amber-600"> · {item.note}</span>}
        </p>
      ))}
    </>
  )
}

// The count belongs in the summary line and the rows behind a click: these lists run to hundreds of
// prace, and unfolded a single one buries every other line in the dialog.
export function ReportFold({
  summary,
  tone = 'text-amber-600',
  children,
}: {
  summary: ReactNode
  tone?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="space-y-0.5">
      <Collapsible.Trigger className="flex w-full cursor-pointer items-start gap-1 text-left">
        <ChevronDown
          className={`mt-1 size-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${tone}`}
        />
        <span className={tone}>{summary}</span>
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        <div className="space-y-0.5 pl-4.5">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
