import { describe, expect, it } from 'vitest'
import { isExempt, parseVehicleExemptions } from '@/lib/fleet/exemptions'

// The column is jsonb, so it holds whatever was last written to it — including `null` on every
// vehicle that predates the feature and anything an /admin edit could type by hand.
describe('parseVehicleExemptions', () => {
  it('keeps the scheduled types it recognises', () => {
    expect(parseVehicleExemptions(['TECHNICAL', 'TYRES'])).toEqual(['TECHNICAL', 'TYRES'])
  })

  it('returns the domain order, not the stored one', () => {
    expect(parseVehicleExemptions(['TYRES', 'TECHNICAL'])).toEqual(['TECHNICAL', 'TYRES'])
  })

  it('is empty for a vehicle that has never been given one', () => {
    expect(parseVehicleExemptions(null)).toEqual([])
    expect(parseVehicleExemptions(undefined)).toEqual([])
  })

  // An exemption on a type the form cannot show would be impossible to untick — and SERVICE has no
  // schedule to be exempt from in the first place.
  it('drops junk and anything outside the scheduled types', () => {
    expect(parseVehicleExemptions(['TECHNICAL', 'SERVICE', 'NONSENSE', 7, null])).toEqual([
      'TECHNICAL',
    ])
  })

  it('drops a stored value that is not an array at all', () => {
    expect(parseVehicleExemptions({ TECHNICAL: true })).toEqual([])
    expect(parseVehicleExemptions('TECHNICAL')).toEqual([])
  })

  it('dedupes', () => {
    expect(parseVehicleExemptions(['TECHNICAL', 'TECHNICAL'])).toEqual(['TECHNICAL'])
  })
})

describe('isExempt', () => {
  it('answers per type', () => {
    expect(isExempt(['TECHNICAL'], 'TECHNICAL')).toBe(true)
    expect(isExempt(['TECHNICAL'], 'INSURANCE')).toBe(false)
    expect(isExempt([], 'TECHNICAL')).toBe(false)
  })
})
