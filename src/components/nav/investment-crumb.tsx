import Link from 'next/link'

import { HistoryBackButton } from '@/components/ui/history-back-button'
import { getInvestmentName } from '@/lib/queries/investments'

type InvestmentCrumbPropsT = {
  params: Promise<{ id: string }>
}

export async function InvestmentCrumb({ params }: InvestmentCrumbPropsT) {
  const { id } = await params
  // Not a guard — keeps a junk id out of the query's cache keys.
  if (!/^\d+$/.test(id)) return null

  const name = await getInvestmentName(id)
  if (!name) return null

  return (
    <div className="flex min-w-0 items-center gap-2">
      <HistoryBackButton />
      <Link
        href={`/inwestycje/${id}`}
        className="text-foreground truncate text-sm font-medium hover:underline"
      >
        {name}
      </Link>
    </div>
  )
}
