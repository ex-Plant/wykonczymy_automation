import { describe, expect, it } from 'vitest'
import { againstNamedFigure } from '@/components/kosztorys/editor/dialogs/sheet-footer-report'
import type { FooterComparisonT } from '@/lib/kosztorys/sheet-import/footer-totals'

const row = (patch: Partial<FooterComparisonT>): FooterComparisonT => ({
  key: 'executedNet',
  label: 'R netto - suma prac wykonannych',
  sheetValue: 0,
  appValue: 0,
  delta: 0,
  matches: true,
  matchedAgainst: 'executedNet',
  ...patch,
})

describe('againstNamedFigure', () => {
  it('calls out an „R netto" that agrees only with a figure its label does not name', () => {
    // A footer summing the wrong columns lands on the offer total: `compareFooterTotals` then reports
    // the row as matching, against a figure five digits away from the executed work. Accepting that
    // is how a sheet disagreeing with itself renders as a clean one.
    const misdirected = row({
      sheetValue: 271623.9,
      appValue: 271623.9,
      matchedAgainst: 'plannedNet',
    })

    expect(againstNamedFigure(116489.3)(misdirected)).toMatchObject({
      matches: false,
      appValue: 116489.3,
      delta: 271623.9 - 116489.3,
    })
  })

  it('reports the delta against the etapy — the Planetowa −405 zł', () => {
    expect(againstNamedFigure(116489.3)(row({ sheetValue: 116084.3 }))).toMatchObject({
      matches: false,
      delta: -405,
    })
  })

  it('agrees to the grosz', () => {
    expect(againstNamedFigure(116489.3)(row({ sheetValue: 116489.304 }))).toMatchObject({
      matches: true,
    })
  })

  it('leaves „wartość netto" to the candidate matching, which its label cannot settle', () => {
    // Przedmiar and Pomiar are both defensible readings of that row, so pinning it to one of them
    // reported a five-figure difference on a sheet that had been parsed perfectly.
    const planned = row({ key: 'plannedNet', sheetValue: 271623.9, appValue: 271623.9 })

    expect(againstNamedFigure(116489.3)(planned)).toBe(planned)
  })

  it('says nothing about a summary row the sheet does not carry', () => {
    const absent = row({ sheetValue: null, delta: null, matches: false, matchedAgainst: null })

    expect(againstNamedFigure(116489.3)(absent)).toBe(absent)
  })
})
