import { createTextColumn } from 'react-datasheet-grid'
import { decimalText } from '@/lib/utils/decimal-text'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

// A pl-PL decimal cell, in place of react-datasheet-grid's own `floatColumn` — which reads „12,5" as
// 12 (`parseFloat` stops at the comma and returns the prefix instead of failing) while rendering the
// blurred cell through `new Intl.NumberFormat()` with NO locale argument, i.e. the browser's. On a
// Polish browser that made the cell display the very separator it refused to accept, and drop the
// decimal of anyone who typed it. Here one representation does both directions: comma in, comma out.

// No thousands separator on the way out — it would not survive the round trip back through the
// input. Stripped on the way IN because a paste from the owner's sheet carries one (a NBSP).
const parse = (raw: string): number | null => {
  const parsed = parseDecimalInput(raw.replace(/\s/g, ''))
  // The hand-rolled decimal fields hold a half-typed value back; this one cannot — dsg parses every
  // keystroke and hands the parser no access to the value being replaced, so „-" clears the cell,
  // exactly as it did under `floatColumn`.
  return parsed.kind === 'value' ? parsed.value : null
}

// Left-aligned (createTextColumn's default): every kosztorys cell reads under a left-aligned header,
// so numbers don't float at the far edge of a wide column.
export const decimalColumn = createTextColumn<number | null>({
  parseUserInput: parse,
  parsePastedValue: parse,
  formatBlurredInput: decimalText,
  formatInputOnFocus: decimalText,
  formatForCopy: decimalText,
})
