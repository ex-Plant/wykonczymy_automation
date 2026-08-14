import { describe, expect, it } from 'vitest'
import {
  resolveRobocizna,
  type ResolvedRobociznaT,
  type RobociznaFailureT,
} from '@/lib/kosztorys/sheet-import/resolve-columns'
import { col } from '@/__tests__/fixtures/kosztorys-sheet/grid'
import {
  BIALOSTOCKA_ROBOCIZNA_HEADER,
  ZUPNICZA_ROBOCIZNA_HEADER,
} from '@/__tests__/fixtures/kosztorys-sheet/header-blocks'

function expectResolved(
  result: ResolvedRobociznaT | RobociznaFailureT,
): asserts result is ResolvedRobociznaT {
  if (!result.ok) expect.fail(`expected a resolved header, got: ${result.problems.join(' | ')}`)
}

// Żupnicza splits „Wartość netto" into S and T, so no name matches and the header refuses — the one
// layout the stored pointing exists for.
describe('resolveRobocizna with a stored column pointing', () => {
  it('resolves a column the header name could not', () => {
    const result = resolveRobocizna(ZUPNICZA_ROBOCIZNA_HEADER, { netValue: col('S') })
    expectResolved(result)

    expect(result.columns.netValue).toBe(col('S'))
    expect(result.resolvedFromMapping).toEqual(['netValue'])
    expect(result.missingFields).toEqual([])
  })

  it('lets a corrected header name win over a pointing at another column', () => {
    const result = resolveRobocizna(BIALOSTOCKA_ROBOCIZNA_HEADER, { netValue: col('AE') })
    expectResolved(result)

    expect(result.columns.netValue).toBe(col('S'))
    expect(result.resolvedFromMapping).toEqual([])
  })

  it('ignores a pointing at a column another field already owns', () => {
    const result = resolveRobocizna(ZUPNICZA_ROBOCIZNA_HEADER, { netValue: col('Q') })

    expect(result.ok).toBe(false)
    expect(result.missingFields).toEqual([{ field: 'netValue', required: true, reason: 'absent' }])
  })

  it('ignores a pointing past the header block', () => {
    const result = resolveRobocizna(ZUPNICZA_ROBOCIZNA_HEADER, { netValue: col('S') + 500 })

    expect(result.ok).toBe(false)
    expect(result.missingFields).toEqual([{ field: 'netValue', required: true, reason: 'absent' }])
  })

  it('names only the fields that came from the pointing', () => {
    const result = resolveRobocizna(ZUPNICZA_ROBOCIZNA_HEADER, {
      netValue: col('S'),
      // Already matched by name — riding along in the pointing changes nothing.
      plannedQty: col('T'),
    })
    expectResolved(result)

    expect(result.resolvedFromMapping).toEqual(['netValue'])
    expect(result.columns.plannedQty).toBe(col('N'))
  })
})
