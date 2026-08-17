import { describe, expect, it } from 'vitest'
import { filtersMenuModel } from '@/components/kosztorys/editor/toolbar/menus/filters-menu-model'

const model = (
  counts: Record<string, number>,
  engaged: string[] = [],
  extra: { collapsedSectionCount?: number; untickedFilterCount?: number } = {},
) =>
  filtersMenuModel({
    engagedIds: new Set(engaged),
    counts: new Map(Object.entries(counts)),
    collapsedSectionCount: extra.collapsedSectionCount ?? 0,
    untickedFilterCount: extra.untickedFilterCount ?? 0,
  })

describe('the „Problemy" group', () => {
  it('offers nothing and warns about nothing on a clean kosztorys', () => {
    const { problemToggles, hasProblems } = model({})
    expect(problemToggles).toEqual([])
    expect(hasProblems).toBe(false)
  })

  // A problem list is read for what is ON it; permanently-zero rows would bury the one that isn't.
  it('drops a zero-count problem while its neighbour shows', () => {
    const { problemToggles } = model({ 'no-client-price': 9, 'overpriced-w-tools': 0 })
    expect(problemToggles.map((toggle) => toggle.id)).toEqual(['no-client-price'])
  })

  it('names the subject each row acts on — pozycje or etapy', () => {
    const { problemToggles } = model({ 'no-client-price': 9, 'stage-no-plane': 2 })
    expect(problemToggles.map((toggle) => toggle.label)).toEqual([
      'Pokaż pozycje bez ceny j.m. (9)',
      'Pokaż etapy bez wybranego sposobu rozliczenia (2)',
    ])
  })

  it('ticks a row only while its condition is engaged', () => {
    const { problemToggles } = model({ 'no-client-price': 9 }, ['no-client-price'])
    expect(problemToggles[0].active).toBe(true)
    expect(model({ 'no-client-price': 9 }).problemToggles[0].active).toBe(false)
  })
})

describe('the trigger', () => {
  // Nothing outside this menu says a problem filter is on any more, so a narrowed grid with an
  // unremarkable trigger would read as a kosztorys that lost rows.
  it('counts unticked filters, folded sekcje and engaged problems alike', () => {
    const { triggerCount } = model(
      { 'no-client-price': 9, 'stage-no-plane': 2 },
      ['stage-no-plane'],
      {
        collapsedSectionCount: 3,
        untickedFilterCount: 1,
      },
    )
    expect(triggerCount).toBe(5)
  })

  it('counts nothing for a problem that merely exists', () => {
    expect(model({ 'no-client-price': 9 }).triggerCount).toBe(0)
  })

  // The triangle reports the DATA, not the gesture — it answers „czy coś jest tu zepsute", which is
  // true before anyone opens the menu.
  it('warns on data alone, with nothing engaged', () => {
    expect(model({ 'no-client-price': 9 }).hasProblems).toBe(true)
  })

  // Owner, explicitly: work not yet entered is still something the kosztorys is waiting on.
  it('warns for the worklist problem too, not only the defects', () => {
    expect(model({ 'measure-diverged': 13 }).hasProblems).toBe(true)
  })
})
