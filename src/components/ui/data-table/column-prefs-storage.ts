import { type VisibilityState } from '@tanstack/react-table'
import type { ColumnRanksT } from '@/lib/table/column-order'

const VISIBILITY_PREFIX = 'table-columns:'
// Its own prefix, so fixing an order can't clobber what is hidden and vice versa.
const ORDER_PREFIX = 'table-column-order:'

export function readVisibility(key: string): VisibilityState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(VISIBILITY_PREFIX + key)
    return raw ? (JSON.parse(raw) as VisibilityState) : {}
  } catch {
    return {}
  }
}

export function writeVisibility(key: string, state: VisibilityState) {
  try {
    localStorage.setItem(VISIBILITY_PREFIX + key, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable
  }
}

// Unlike visibility's booleans these ranks are arithmetic (midpoints, comparisons) and localStorage
// is client-writable, so a hand-edited `{"amount":"x"}` would put NaN in the comparator and scramble
// the order with no error. Same guard the kosztorys store applies.
export function readOrder(key: string): ColumnRanksT {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(ORDER_PREFIX + key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ColumnRanksT
    return Object.fromEntries(Object.entries(parsed).filter(([, rank]) => Number.isFinite(rank)))
  } catch {
    return {}
  }
}

export function writeOrder(key: string, ranks: ColumnRanksT) {
  try {
    localStorage.setItem(ORDER_PREFIX + key, JSON.stringify(ranks))
  } catch {
    // localStorage full or unavailable
  }
}
