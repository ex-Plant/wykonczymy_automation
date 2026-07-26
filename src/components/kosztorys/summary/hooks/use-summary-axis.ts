'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'
import { SUMMARY_AXIS_DEFAULT, type PanelAxisT } from '@/lib/kosztorys/money-axis'

export type { PanelAxisT }

// Persisted globally in localStorage — a reading preference of the person, not of one kosztorys;
// same `table-columns:` family as the grid's money-axis picker, so clearing that memory clears this
// too. Survives refresh and the editor's restore-remount, which the previous useState did not.
const STORAGE_KEY = 'table-columns:kosztorys-summary-axis'
// 'both' is not a valid pick (netto and brutto render together in every mode), so a persisted 'both'
// falls back to the default.
const VALID_AXES: readonly PanelAxisT[] = ['net', 'gross', 'mixed']

export function useSummaryAxis(): [PanelAxisT, (axis: PanelAxisT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_AXES, SUMMARY_AXIS_DEFAULT)
}
