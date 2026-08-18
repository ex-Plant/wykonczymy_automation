import { useState } from 'react'

/**
 * Editable copy of a value the parent owns, reset whenever the parent hands down a different one.
 *
 * The reset is the point: a dialog that is mounted once and reopened with fresh data would otherwise
 * keep the previous open's edits, and a `useEffect` doing the same thing would paint the stale draft
 * for one frame first. Adjusting state during render — the identity check below — is React's own
 * answer to that, so the new source is what the first paint sees.
 *
 * Identity, not equality: the caller re-fetches on every open, so a freshly read object that happens
 * to hold the same fields is still a new answer from the server and still discards the draft.
 *
 * Which makes the source's own stability the precondition — pass state or a prop, never something
 * derived during render. A `useDraft(items.map(...))` gets a new array every render, resets on each
 * one, and the form is simply uneditable. Such a caller passes `isSame` instead, comparing what the
 * value actually says rather than which object said it.
 */
export function useDraft<T>(source: T, isSame: (a: T, b: T) => boolean = Object.is) {
  // Both wrapped in a lambda: React reads a bare function argument as a lazy initializer / an
  // updater, so a function-typed `T` would be invoked and the draft would hold its return value.
  const [draft, setDraft] = useState(() => source)
  const [lastSource, setLastSource] = useState(() => source)

  if (!isSame(lastSource, source)) {
    setLastSource(() => source)
    setDraft(() => source)
  }

  return [draft, setDraft] as const
}
