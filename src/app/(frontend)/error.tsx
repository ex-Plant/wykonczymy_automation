'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-foreground text-lg font-semibold">Coś poszło nie tak</h2>
      <Button variant="outline" onClick={() => reset()}>
        Spróbuj ponownie
      </Button>
    </div>
  )
}
