import { useState } from 'react'

/**
 * Latest-wins for a fetch the user can restart before the first one lands. `start()` claims the slot
 * and hands back the „am I still the newest" check that every state write from that request must go
 * through; `disown()` retires whatever is in flight without starting anything, for a reset that a
 * late response must not repopulate.
 *
 * A superseded request also stays silent on failure — its error would toast over a newer, successful
 * load — which is why the check guards the catch branch too, not just the happy path.
 *
 * `useState` with a lazy initializer, not `useRef`: the counter is never a render input, and reading
 * a ref during render is impure — React may discard a render and re-run it.
 */
export function useLatestRequest() {
  const [request] = useState(() => {
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
  })

  return request
}
