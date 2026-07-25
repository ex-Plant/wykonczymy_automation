'use client'

import { useRouter } from 'next/navigation'

type BackButtonPropsT = {
  label: string
  fallbackHref: string
}

export function BackButton({ label, fallbackHref }: BackButtonPropsT) {
  const router = useRouter()

  // A direct load (shared link, refresh) has no in-app history to pop.
  function goBack() {
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="text-muted-foreground hover:text-foreground w-fit cursor-pointer text-sm"
    >
      &larr; {label}
    </button>
  )
}
