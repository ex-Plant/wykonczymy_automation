'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'

// Which view the totals panel shows — the top toggle drives it directly, fully independent of the
// grid's price view. „Podwykonawcy" and „Marża" are owner-only, filtered out of the client read-only
// view (see SummaryPanelContent).
export type SummaryViewT = 'summary' | 'wydatki' | 'etapy' | 'podwykonawcy' | 'margin'

// Persisted globally in localStorage — a reading position of the person, not of one kosztorys, same
// `table-columns:` family as the panel's axis pick. Survives refresh and the editor restore-remount.
const STORAGE_KEY = 'table-columns:kosztorys-summary-view'
const VALID_VIEWS: readonly SummaryViewT[] = [
  'summary',
  'wydatki',
  'etapy',
  'podwykonawcy',
  'margin',
]
const SUMMARY_VIEW_DEFAULT: SummaryViewT = 'summary'

export function useSummaryView(): [SummaryViewT, (view: SummaryViewT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_VIEWS, SUMMARY_VIEW_DEFAULT)
}
