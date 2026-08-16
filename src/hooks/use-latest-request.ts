import { useRef } from 'react'

/**
 * Latest-wins for a fetch the user can restart before the first one lands. `start()` claims the slot
 * and hands back the „am I still the newest" check that every state write from that request must go
 * through; `disown()` retires whatever is in flight without starting anything, for a reset that a
 * late response must not repopulate.
 *
 * A superseded request also stays silent on failure — its error would toast over a newer, successful
 * load — which is why the check guards the catch branch too, not just the happy path.
 */
export function useLatestRequest() {
  const latest = useRef(0)

  return useRef({
    start() {
      const id = (latest.current += 1)
      return () => latest.current === id
    },
    disown() {
      latest.current += 1
    },
  }).current
}
