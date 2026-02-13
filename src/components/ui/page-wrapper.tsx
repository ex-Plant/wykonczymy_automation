import Link from 'next/link'
import type { ReactNode } from 'react'

type PageWrapperPropsT = {
  readonly title: string
  readonly description?: string
  readonly backHref?: string
  readonly backLabel?: string
  readonly children?: ReactNode
}

export function PageWrapper({ title, description, backHref, backLabel, children }: PageWrapperPropsT) {
  return (
    <div className="p-6 lg:p-8">
      {backHref && (
        <Link href={backHref} className="text-muted-foreground hover:text-foreground text-sm">
          &larr; {backLabel}
        </Link>
      )}

      <h1 className={`text-foreground text-2xl font-semibold${backHref ? ' mt-2' : ''}`}>
        {title}
      </h1>

      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}

      {children}
    </div>
  )
}
