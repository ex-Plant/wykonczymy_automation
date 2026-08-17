'use client'

import { useState } from 'react'
import { useEngagedConditions } from '@/components/kosztorys/editor/hooks/use-engaged-conditions'
import { usePriceView } from '@/components/kosztorys/editor/hooks/use-price-view'
import type { SortPickT, SortStateT } from '@/lib/kosztorys/row-view'

// One frozen instance, so the preview's suppressed set is referentially stable across renders and
// the editor's memos don't recompute on every keystroke.
const EMPTY_CONDITION_IDS: ReadonlySet<string> = new Set()

type ArgsT = {
  investmentId: number
  preview: boolean
}

// How the grid is being read — plane, search, sort, folds, the resize guide. Depends on nothing in
// the data plane: no rows, no stages, no actions.
export function useKosztorysViewState({ investmentId, preview }: ArgsT) {
  const [persistedView, setView] = usePriceView(investmentId)
  // Pinning the plane is the second half of the preview's disclosure lock (the allowlist is the
  // first — why the two only work as a pair is at `assertDisclosurePair`, which enforces it). Pinning
  // it HERE is also what closes the attack where a client sets localStorage['kosztorys-view:<id>'] to
  // a subcontractor view: the public page ships the full tree, coefficients included, so an unpinned
  // plane would simply render it.
  const view = preview ? 'client' : persistedView
  const [search, setSearch] = useState('')
  // Which named conditions are hiding pozycje — persisted per investment, so a filter set yesterday
  // is still on today. Suppressed wholesale under the preview like `view` above: every condition here
  // is the company's own bookkeeping question and has no business in a client's document.
  const {
    engagedIds: persistedConditionIds,
    toggle: toggleCondition,
    clear: clearConditions,
  } = useEngagedConditions(investmentId)
  const engagedConditionIds = preview ? EMPTY_CONDITION_IDS : persistedConditionIds
  const [sort, setSort] = useState<SortStateT>(null)
  // Which sections are folded shut under their band — the single description of what the grid shows,
  // driven both by a band's own chevron and by the „Sekcje" menu (unticking folds rather than
  // filtering the rows away, so a hidden section still announces itself and its total). Deliberately
  // NOT persisted: a fold is a reading gesture for the current session, and a remembered one would
  // greet the next visit with rows the user can't see and doesn't remember hiding.
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  // During a column resize we only show a vertical guide (guideX = cursor X), without touching the
  // grid — a re-layout per pointermove would be a re-render per pixel.
  const [guideX, setGuideX] = useState<number | null>(null)

  // „Zresetuj filtry" is one button wherever it appears, so it undoes everything that hides pozycje:
  // the conditions and the folds alike. Two half-resets would leave the user clicking one and still
  // facing a short grid.
  function resetFilters() {
    clearConditions()
    setCollapsedSectionIds(new Set())
  }

  function setSortField(field: string, pick: SortPickT | null) {
    setSort(pick ? { field, ...pick } : null)
  }

  // A row added into a folded section would be invisible, so the add unfolds it. Same reference back
  // when the section is already open, so an add elsewhere doesn't re-render the grid.
  function unfoldSection(sectionId: number) {
    setCollapsedSectionIds((prev) => {
      if (!prev.has(sectionId)) return prev
      const next = new Set(prev)
      next.delete(sectionId)
      return next
    })
  }

  function toggleSectionCollapsed(sectionId: number) {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(sectionId)) next.add(sectionId)
      return next
    })
  }

  return {
    view,
    setView,
    search,
    setSearch,
    engagedConditionIds,
    toggleCondition,
    sort,
    setSort,
    setSortField,
    collapsedSectionIds,
    setCollapsedSectionIds,
    toggleSectionCollapsed,
    unfoldSection,
    resetFilters,
    guideX,
    setGuideX,
  }
}
