'use client'

import { useState } from 'react'

export type DialogToggleT = {
  open: boolean
  setOpen: (open: boolean) => void
}

// An action whose dialog needs nothing beyond an open flag.
export function useDialogToggle(): DialogToggleT {
  const [open, setOpen] = useState(false)
  return { open, setOpen }
}
