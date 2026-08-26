import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type FormClearButtonPropsT = {
  /** What blank means is the caller's to say — this button never resets the form itself. */
  onReset: () => void
}

export function FormClearButton({ onReset }: FormClearButtonPropsT) {
  return (
    <Button
      type="button"
      variant="blue"
      size="sm"
      // Float top-right beside the dialog's X (right-2, ~48px box) — anchored to the fixed
      // DialogContent, no positioned ancestor in between.
      className="absolute top-4 right-14 z-10"
      onClick={onReset}
    >
      <RotateCcw className="size-3.5" />
      Wyczyść formularz
    </Button>
  )
}
