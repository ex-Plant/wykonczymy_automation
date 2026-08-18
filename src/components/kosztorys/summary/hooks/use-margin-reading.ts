'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

export type MarginFigureT = 'forecast' | 'actual'

// Which margin the „Marża" tab shows and, for the forecast, at whose rate. Persisted in the same
// `table-columns:` family as the panel's own view pick — component state died on every tab switch,
// because the panel unmounts the tab it leaves, and re-picking the scenario each time is the whole
// complaint. Owner-plane keys on purpose: the `kosztorys-*` family is the one the client-share
// disclosure lock treats as client-writable, and neither pick belongs there.
const FIGURE_KEY = 'table-columns:kosztorys-margin-figure'
const PLANE_KEY = 'table-columns:kosztorys-margin-plane'

const FIGURES: readonly MarginFigureT[] = ['forecast', 'actual']

export function useMarginFigure(): [MarginFigureT, (figure: MarginFigureT) => void] {
  return usePersistedEnum(FIGURE_KEY, FIGURES, 'forecast')
}

export function useMarginPlane(): [ToolPlaneT, (plane: ToolPlaneT) => void] {
  return usePersistedEnum(PLANE_KEY, TOOL_PLANES, 'w_tools')
}
