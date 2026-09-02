'use client'

import { useState } from 'react'

/**
 * Which pozycje the engaged conditions may no longer remove.
 *
 * A condition stops matching the moment its problem is fixed, and the fix happens INSIDE the narrowed
 * grid: typing the first digit of a cena makes „bez ceny j.m." false, so without a latch the row
 * leaves the grid one keystroke in — taking with it the „Cena j.m." that same filter revealed for
 * the repair. The same applies to every other condition; the price is only where it bites soonest.
 *
 * So the latch is add-only: while one set of conditions stays engaged, a pozycja that has been shown
 * once stays shown, and pozycje that newly start matching still arrive. Changing which conditions are
 * engaged empties it, and so does `refresh` — the explicit „pokaż mi stan teraz", which exists because
 * toggling the problem off and on again to clear the held rows is a workaround, not a gesture.
 *
 * `latch`'s identity is the reset signal: it changes exactly when the engaged set or the refresh does,
 * so a memo consuming it recomputes strictly then and NOT when ids are added. That timing is the
 * point — a newly latched id must not re-run the filter it was just exempted from; it takes effect on
 * the next recompute, which is the edit itself.
 *
 * `enabled: false` returns a null latch rather than an empty one, so a caller cannot half-honour it by
 * skipping the filter bypass while still filling the set — which is what an accumulating „disabled"
 * latch quietly becomes on the first re-render.
 */
export function useConditionRowLatch(
  engagedConditionIds: ReadonlySet<string>,
  enabled: boolean,
): { latch: { ids: Set<number> } | null; refresh: () => void } {
  const [refreshCount, setRefreshCount] = useState(0)
  const key = `${refreshCount}:${[...engagedConditionIds].sort().join('|')}`
  // State adjusted during render rather than a ref: the reset has to be visible in the SAME pass that
  // sees the new engaged set, and a mutable set behind useRef is what the ref lint rule forbids.
  const [latch, setLatch] = useState<{ key: string; ids: Set<number> }>(() => ({
    key,
    ids: new Set(),
  }))
  const current = latch.key === key ? latch : { key, ids: new Set<number>() }
  if (current !== latch) setLatch(current)
  return { latch: enabled ? current : null, refresh: () => setRefreshCount((count) => count + 1) }
}
