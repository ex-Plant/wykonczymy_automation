import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'

// cancelledRef survives the blur, which is what lets Enter and Escape both route through blur and
// still be told apart.
export function useInlineRename(onCommit: (draft: string) => void) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelledRef = useRef(false)
  // Focus alone starts an edit, so merely tabbing through a cell would otherwise commit an unchanged
  // name on blur — a write, a revalidation and an undo entry for nothing.
  const startedWithRef = useRef('')

  function start(currentValue: string) {
    cancelledRef.current = false
    startedWithRef.current = currentValue
    setDraft(currentValue)
    setEditing(true)
  }

  return {
    editing,
    start,
    // Spread onto an EditableCellInput to get the whole blur-to-commit wiring.
    inputProps: {
      value: draft,
      onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
      onBlur: () => {
        if (!cancelledRef.current && draft !== startedWithRef.current) onCommit(draft)
        setEditing(false)
      },
      onEnter: (event: KeyboardEvent<HTMLInputElement>) => event.currentTarget.blur(),
      onEscape: (event: KeyboardEvent<HTMLInputElement>) => {
        cancelledRef.current = true
        event.currentTarget.blur()
      },
    },
  }
}
