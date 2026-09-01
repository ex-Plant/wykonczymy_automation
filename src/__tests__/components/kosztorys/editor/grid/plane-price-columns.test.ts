import { describe, expect, it } from 'vitest'
import {
  buildV2Columns,
  buildV2Grid,
} from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { DEFAULT_HIDDEN_COLUMNS } from '@/lib/kosztorys/column-config'
import { axisAllows } from '@/lib/kosztorys/money-axis'
import { PLANE_PRICE_BASE_KEYS, planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'

// Both crews' rates on screen at once, in every view — the reading the owner asked for. The point of
// the columns is comparison, so the assertions are about the two planes standing SIDE BY SIDE and
// staying distinguishable; a spec that exercised one plane would pass on a build that renders the
// same plane twice.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: null, workerId: null },
]

const VIEWS = ['client', 'w_tools', 'own_tools'] as const

const PLANE_PRICE_IDS = (['w_tools', 'own_tools'] as ToolPlaneT[]).flatMap((plane) =>
  PLANE_PRICE_BASE_KEYS.map((base) => planePriceKey(base, plane)),
)

function ids(opts: Partial<BuildV2ColumnsOptsT> & Pick<BuildV2ColumnsOptsT, 'view'>): string[] {
  return buildV2Columns({ stages: STAGES, ...opts })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('subcontractor rate columns, both planes', () => {
  it('assembles all six in every view', () => {
    for (const view of VIEWS) {
      expect(ids({ view })).toEqual(expect.arrayContaining(PLANE_PRICE_IDS))
    }
  })

  // The client's own „Cena j.m. netto" keeps the bare id and stays where the offer is read. It is a
  // different figure from a crew's rate, and its id is the one stored in each investment's client-view
  // settings — the assertion guards that identity, not a layout preference.
  it("keeps the client's own price column distinct and client-only", () => {
    expect(ids({ view: 'client' })).toContain('price')
    expect(ids({ view: 'w_tools' })).not.toContain('price')
  })

  it('offers each of the six as its own picker entry, named by plane', () => {
    const { columnToggleItems } = buildV2Grid({ view: 'client', stages: STAGES })
    const entries = columnToggleItems.filter((item) => PLANE_PRICE_IDS.includes(item.id))

    expect(entries).toHaveLength(PLANE_PRICE_IDS.length)
    // Collapsing them into one entry the way the stage axes collapse would make the comparison
    // impossible to set up: you could never show one plane's multiplier without the other's.
    expect(new Set(entries.map((item) => item.id)).size).toBe(PLANE_PRICE_IDS.length)
    expect(entries.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Mnożnik — z narzędziami',
        'Mnożnik — bez narzędzi',
        'Cena j.m. netto — z narzędziami',
        'Źródło ceny wykonawcy — bez narzędzi',
      ]),
    )
  })

  it('starts hidden in every view, so nobody meets six new columns unasked', () => {
    for (const id of PLANE_PRICE_IDS) expect(DEFAULT_HIDDEN_COLUMNS.has(id)).toBe(true)

    const { columnToggleItems } = buildV2Grid({
      view: 'client',
      stages: STAGES,
      isHidden: (id) => DEFAULT_HIDDEN_COLUMNS.has(id),
    })
    for (const item of columnToggleItems.filter((entry) => PLANE_PRICE_IDS.includes(entry.id))) {
      expect(item.visible).toBe(false)
    }
  })

  // A crew is paid without VAT, so its rate has no brutto twin — the brutto reading must not take it
  // away. This exemption did nothing for these columns until they reached the client plane, where the
  // axis is live.
  it('survives the brutto reading, like the client price it derives from', () => {
    for (const plane of ['w_tools', 'own_tools'] as ToolPlaneT[]) {
      expect(axisAllows(planePriceKey('price', plane), 'gross')).toBe(true)
      expect(axisAllows(planePriceKey('priceCoeff', plane), 'gross')).toBe(true)
    }
  })

  // The two planes must reach DIFFERENT stored fields. Same-id columns would have made this
  // impossible to express at all, which is why the id carries the plane.
  it('binds each column to its own plane, not to the active view', () => {
    const columns = buildV2Columns({ view: 'client', stages: STAGES })
    const planeOf = (id: string) =>
      (columns.find((column) => column.id === id)?.columnData as { view?: string } | undefined)
        ?.view

    expect(planeOf(planePriceKey('price', 'w_tools'))).toBe('w_tools')
    expect(planeOf(planePriceKey('price', 'own_tools'))).toBe('own_tools')
  })
})
