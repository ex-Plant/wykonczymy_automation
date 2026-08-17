import { describe, expect, it } from 'vitest'
import {
  allProblemIds,
  problemsMenuModel,
} from '@/components/kosztorys/editor/toolbar/menus/problems-menu-model'

const model = (counts: Record<string, number>, engaged: string[] = []) =>
  problemsMenuModel({
    engagedIds: new Set(engaged),
    counts: new Map(Object.entries(counts)),
  })

describe('the „Problemy" list', () => {
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

  // The stawka a price problem judges only renders in one view, so the row has to say which — in
  // words, since a glyph on some rows and not others made the list look like two kinds of thing.
  it('names the view a price problem belongs to', () => {
    const { problemToggles } = model({ 'overpriced-w-tools': 1 })
    expect(problemToggles[0].label).toBe(
      'Pokaż pozycje ze zbyt wysoką stawką wykonawcy w widoku z narzędziami (1)',
    )
  })

  it('ticks a row only while its condition is engaged', () => {
    const { problemToggles } = model({ 'no-client-price': 9 }, ['no-client-price'])
    expect(problemToggles[0].active).toBe(true)
    expect(model({ 'no-client-price': 9 }).problemToggles[0].active).toBe(false)
  })
})

describe('the trigger', () => {
  // The button IS the alarm: it reports the DATA, not the gesture, and it is absent entirely when
  // there is nothing to report.
  it('warns on data alone, with nothing engaged', () => {
    expect(model({ 'no-client-price': 9 }).hasProblems).toBe(true)
  })

  // Owner, explicitly: work not yet entered is still something the kosztorys is waiting on.
  it('warns for the worklist problem too, not only the defects', () => {
    expect(model({ 'measure-diverged': 13 }).hasProblems).toBe(true)
  })
})

// The exclusivity is only as good as the list it clears: a problem missing from it would be the one
// that survives a pick and quietly unions itself with the new one.
describe('allProblemIds', () => {
  it('covers every problem the list can ever offer, engaged or not', () => {
    const offered = model({
      'no-client-price': 1,
      'measure-diverged': 1,
      'overpriced-w-tools': 1,
      'overpriced-own-tools': 1,
      'no-w-tools-price': 1,
      'no-own-tools-price': 1,
      'stage-no-plane': 1,
      'stage-no-worker': 1,
    }).problemToggles.map((toggle) => toggle.id)

    expect(allProblemIds().sort()).toEqual(offered.sort())
  })
})
