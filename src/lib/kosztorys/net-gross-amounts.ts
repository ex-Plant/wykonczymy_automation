import { toNet } from '@/lib/kosztorys/calc'
import { roundToCents } from '@/lib/utils/round-to-cents'

/**
 * The netto behind a brutto kwota, in the string form the money inputs hold. '' in, '' out: an empty
 * kwota has no counterpart, and a half-typed one ('-', '1e') must not write NaN into the other field.
 */
export const netFromGross = (gross: string, vatRate: number): string => {
  const amount = Number(gross)
  if (gross === '' || !Number.isFinite(amount)) return ''
  return roundToCents(toNet(amount, vatRate)).toFixed(2)
}
