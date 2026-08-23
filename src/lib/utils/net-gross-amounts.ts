import { toGross } from '@/lib/kosztorys/calc'

// The two directions across VAT, in the string form the money inputs hold. '' in, '' out: an empty
// kwota has no counterpart, and a half-typed one ('-', '1e') must not write NaN into the other field.
const convert = (raw: string, cross: (amount: number) => number): string => {
  const amount = Number(raw)
  if (raw === '' || !Number.isFinite(amount)) return ''
  return (Math.round(cross(amount) * 100) / 100).toFixed(2)
}

export const grossFromNet = (net: string, vatRate: number): string =>
  convert(net, (amount) => toGross(amount, vatRate))

export const netFromGross = (gross: string, vatRate: number): string =>
  convert(gross, (amount) => amount / (1 + vatRate))
