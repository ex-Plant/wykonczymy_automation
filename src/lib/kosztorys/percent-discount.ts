import { z } from 'zod'

// Input for the percent-discount bulk-apply tool. The percent is not stored state — clicking „Zastosuj"
// writes `percent X` into every item's per-item rabat, so the only input is the percent.
//
// `min(0)`: applying 0% zeroes every per-item rabat — the owner's way of turning the rabat off, so the
// mass-clear is the intent rather than an accident (it was `gt(0)` until they asked for it). `max(100)`:
// a rabat over 100% would price the row negative.
export const applyPercentDiscountSchema = z.object({
  percent: z.coerce.number().min(0).max(100),
})
