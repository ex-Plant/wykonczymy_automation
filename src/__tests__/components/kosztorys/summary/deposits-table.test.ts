import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DepositsTable } from '@/components/kosztorys/summary/tables/deposits-table'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import type { DepositTransactionRowT } from '@/types/reference-data'

// Rendered to a static string rather than a DOM: the assertions are about which blocks the table
// emits, and the repo carries no jsdom/RTL. `renderToStaticMarkup` needs neither.
const render = (totalsOnly: boolean) =>
  renderToStaticMarkup(
    createElement(DepositsTable, { investmentId: 1, rows: ROWS, clientView: false, totalsOnly }),
  )

const ROWS: DepositTransactionRowT[] = [
  { id: 1, date: '2026-07-01', amount: 1000, vatPlane: 'NET' },
  { id: 2, date: '2026-07-02', amount: 250, vatPlane: 'GROSS' },
  { id: 3, date: '2026-07-03', amount: 40, vatPlane: null },
]

describe('DepositsTable totalsOnly', () => {
  it('keeps all three Razem buckets and drops the per-wpłata rows', () => {
    const html = render(true)

    expect(html).toContain('Razem netto')
    expect(html).toContain('Razem brutto')
    expect(html).toContain('Razem nie określono')
    // The list grid's header is the tell that the per-row block rendered at all.
    expect(html).not.toContain('Rozliczenie netto/brutto')
    for (const row of ROWS) expect(html).not.toContain(formatPLDate(row.date))
  })

  it('totals match the non-stripped render', () => {
    const stripped = render(true)
    const full = render(false)

    for (const total of [1000, 250, 40]) {
      expect(stripped).toContain(formatNet(total))
      expect(full).toContain(formatNet(total))
    }
    expect(full).toContain('Rozliczenie netto/brutto')
  })
})
