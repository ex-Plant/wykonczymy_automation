import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ClearButtonPropsT = {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}

export function ClearButton({ onClick, disabled, children }: ClearButtonPropsT) {
  return (
    <Button
      variant="outline"
      size="sm"
      align="start"
      className="min-w-40"
      onClick={onClick}
      disabled={disabled}
    >
      <X />
      {children}
    </Button>
  )
}
