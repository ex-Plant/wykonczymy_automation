import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'

// The state machine behind the editor's click-to-rename inputs (section-name cell, stage header):
// a draft seeded from the current value, Enter/blur commits it, Escape cancels. cancelledRef
// survives the blur, which is what lets both keys route through blur and still be told apart — the
// two call sites used to disagree here, Escape in the stage header committing the unchanged label
// instead of skipping the rename the way the cell did.
export function useInlineRename(onCommit: (draft: string) => void) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelledRef = useRef(false)

  function start(currentValue: string) {
    cancelledRef.current = false
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
        if (!cancelledRef.current) onCommit(draft)
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
