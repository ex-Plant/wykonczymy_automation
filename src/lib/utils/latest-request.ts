export type LatestRequestT = {
  /** Claims the slot; the returned check answers „am I still the newest". */
  start: () => () => boolean
  disown: () => void
}

/**
 * Latest-wins for a fetch the user can restart before the first one lands. Every state write from a
 * request must go through the check `start()` hands back; `disown()` retires whatever is in flight
 * without starting anything, for a reset that a late response must not repopulate.
 *
 * A superseded request also stays silent on failure — its error would toast over a newer, successful
 * load — which is why the check guards the catch branch too, not just the happy path.
 */
export function createLatestRequest(): LatestRequestT {
  let latest = 0

  return {
    start() {
      const id = ++latest
      return () => latest === id
    },
    disown() {
      latest += 1
    },
  }
}
