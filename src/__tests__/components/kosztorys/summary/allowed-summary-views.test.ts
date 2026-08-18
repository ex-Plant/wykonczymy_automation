import { describe, expect, it } from 'vitest'
import { allowedSummaryViews } from '@/components/kosztorys/summary/allowed-summary-views'
import type { SummaryViewT } from '@/components/kosztorys/summary/hooks/use-summary-view'

const ALL: SummaryViewT[] = ['summary', 'expenses', 'stages', 'subcontractors', 'margin']

const OWNER = { preview: false, hasMarginInputs: true }
const CLIENT = { preview: true, hasMarginInputs: true }

describe('allowedSummaryViews', () => {
  it('właściciel widzi wszystko, co host oferuje', () => {
    expect(allowedSummaryViews(ALL, OWNER)).toEqual(ALL)
  })

  // Klientowi nie wystarczy ukryć zakładkę: dokument klienta i tak nie dostaje tych liczb. Ten filtr
  // jest drugą zaporą, nie jedyną.
  it('podgląd klienta gubi „Podwykonawcy" i „Marża", nawet gdy liczby przyszły', () => {
    expect(allowedSummaryViews(ALL, CLIENT)).toEqual(['summary', 'expenses', 'stages'])
  })

  it('bez kompletu liczb „Marża" znika, a „Podwykonawcy" zostaje', () => {
    expect(allowedSummaryViews(ALL, { preview: false, hasMarginInputs: false })).toEqual([
      'summary',
      'expenses',
      'stages',
      'subcontractors',
    ])
  })

  it('host, który nie oferuje widoku, nie dostaje go z powrotem', () => {
    expect(allowedSummaryViews(['summary', 'margin'], OWNER)).toEqual(['summary', 'margin'])
    expect(allowedSummaryViews(['summary'], OWNER)).toEqual(['summary'])
  })

  it('zachowuje kolejność, w jakiej host podał widoki', () => {
    expect(allowedSummaryViews(['margin', 'summary', 'expenses'], OWNER)).toEqual([
      'margin',
      'summary',
      'expenses',
    ])
  })
})
