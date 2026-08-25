import { describe, expect, it } from 'vitest'
import { decimalColumn } from '@/components/ui/datasheet-grid/decimal-column'

// The stock floatColumn read „12,5" as 12 and then printed the value back with the comma it had just
// refused. Both halves are asserted here, because either one alone still loses the decimal.
const { parseUserInput, formatBlurredInput, formatInputOnFocus } = decimalColumn.columnData!

describe('decimalColumn', () => {
  it('przyjmuje przecinek jako separator dziesiętny', () => {
    expect(parseUserInput('12,5')).toBe(12.5)
    expect(parseUserInput('12.5')).toBe(12.5)
  })

  it('to samo, co pokazuje, da się w nie wpisać', () => {
    expect(formatBlurredInput(12.5)).toBe('12,5')
    expect(formatInputOnFocus(12.5)).toBe('12,5')
    expect(parseUserInput(formatBlurredInput(1234.56))).toBe(1234.56)
  })

  it('wkleja liczbę z separatorem tysięcy z arkusza', () => {
    expect(decimalColumn.pasteValue!({ value: '1 234,5', rowData: null, rowIndex: 0 })).toBe(1234.5)
  })

  it('puste / niedokończone → null', () => {
    expect(parseUserInput('')).toBeNull()
    expect(parseUserInput('-')).toBeNull()
    expect(formatBlurredInput(null)).toBe('')
  })
})
