/**
 * A number as the text an editable cell shows AND accepts back — the pl-PL comma, no thousands
 * separator, no padding to a fixed number of places.
 *
 * Deliberately not `formatQty` / `formatNet` (`lib/kosztorys/format.ts`): those go through
 * `toLocaleString`, which inserts a NBSP thousands separator and rounds to a fixed precision. Both
 * are right for a figure being *read* and fatal for one being *edited* — the text they produce does
 * not parse back to the number it came from, which is the whole failure this helper exists to avoid.
 */
export const decimalText = (value: number | null | undefined): string =>
  value == null ? '' : String(value).replace('.', ',')
