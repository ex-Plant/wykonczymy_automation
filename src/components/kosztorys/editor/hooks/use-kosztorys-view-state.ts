'use client'

import { useState } from 'react'
import { useEngagedConditions } from '@/components/kosztorys/editor/hooks/use-engaged-conditions'
import { usePriceView } from '@/components/kosztorys/editor/hooks/use-price-view'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { clientConditionIds, conditionPlane } from '@/lib/kosztorys/row-conditions'
import type { SortPickT, SortStateT } from '@/lib/kosztorys/row-view'

type ArgsT = {
  investmentId: number
  preview: boolean
  // The investment's stored client-view settings. Only consumed under `preview`.
  clientView?: ClientViewSettingsT
}

// How the grid is being read — plane, search, sort, folds, the resize guide. Depends on nothing in
// the data plane: no rows, no stages, no actions.
export function useKosztorysViewState({ investmentId, preview, clientView }: ArgsT) {
  const [persistedView, setView] = usePriceView(investmentId)
  // Pinning the plane is the second half of the preview's disclosure lock (the allowlist is the
  // first — why the two only work as a pair is at `assertDisclosurePair`, which enforces it). Pinning
  // it HERE is also what closes the attack where a client sets localStorage['kosztorys-view:<id>'] to
  // a subcontractor view: the public page ships the full tree, coefficients included, so an unpinned
  // plane would simply render it.
  // Where an engaged problem has taken the reader, on top of the stored plane and never written to it
  // — the same rule as the columns a problem reveals: it rides the gesture, and switching the problem
  // off puts back the view the reader was working in.
  const [viewOverride, setViewOverride] = useState<PriceViewT | null>(null)
  const view = preview ? 'client' : (viewOverride ?? persistedView)
  const [search, setSearch] = useState('')
  // Which named conditions are hiding pozycje — persisted per investment, so a filter set yesterday
  // is still on today. Under the preview the owner's own picks are dropped wholesale like `view`
  // above and `clientConditionIds` answers instead — it owns which conditions may reach a client.
  const {
    engagedIds: persistedConditionIds,
    toggle: toggleCondition,
    toggleExclusive: toggleConditionExclusive,
    clear: clearConditions,
  } = useEngagedConditions(investmentId)
  const engagedConditionIds = preview
    ? clientConditionIds(clientView?.hideEmptyRows)
    : persistedConditionIds
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
  // The reader wins over the problem that moved them: an explicit switch drops the override and stands
  // on its own, with the problem left engaged. Refusing it, or bouncing back, would make the toolbar's
  // most visible control dead while a filter is on.
  function pickView(next: PriceViewT) {
    setViewOverride(null)
    setView(next)
  }

  // Engaging a problem takes the reader to the plane it judges, because a stawka wykonawcy renders on
  // one plane only — narrowing to „ze zbyt wysoką stawką … bez narzędzi" while sitting in „Inwestor"
  // showed the right pozycje with the wrong number in the column the problem had just revealed. A
  // problem about no particular plane (bez ceny j.m., etapy) leaves the view where it is, and so does
  // switching a problem off.
  function pickProblem(id: string, within: Iterable<string>) {
    const engaging = !engagedConditionIds.has(id)
    toggleConditionExclusive(id, within)
    setViewOverride(engaging ? (conditionPlane(id) ?? null) : null)
  }

  function resetFilters() {
    clearConditions()
    setViewOverride(null)
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
    setView: pickView,
    search,
    setSearch,
    engagedConditionIds,
    toggleCondition,
    toggleConditionExclusive: pickProblem,
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
