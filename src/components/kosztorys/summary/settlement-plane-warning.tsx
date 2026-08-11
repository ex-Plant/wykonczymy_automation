import Link from 'next/link'
import { DEPOSIT_TYPES, VAT_PLANE_LABELS } from '@/lib/constants/transfers'
import { settlementModeLabel } from '@/lib/kosztorys/settlement-mode'
import { formatNet } from '@/lib/kosztorys/format'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { pluralize } from '@/lib/utils/polish-plural'
import { WarningBanner } from '@/components/ui/warning-banner'
import type { SettlementPlaneVerdictT } from '@/lib/kosztorys/reconciliation'

function wplatyNoun(count: number): string {
  return pluralize(count, ['wpłata', 'wpłaty', 'wpłat'])
}

// The participle declines on the same three-way split, and its genitive form differs from both
// singular and paucal.
function oznaczoneVerb(count: number): string {
  return pluralize(count, ['jest oznaczona', 'są oznaczone', 'jest oznaczonych'])
}

// Owner-only, like the robocizna/rabat scream: a client can't act on it and shouldn't see the doubt.
// Names the count and links straight to the rows — a warning that only states a sum leaves the reader
// with nothing to open, which is how red banners become furniture.
export function SettlementPlaneWarning({
  verdict,
  investmentId,
}: {
  verdict: SettlementPlaneVerdictT
  investmentId: number
}) {
  if (!verdict.offendingPlane) return null

  const plane = VAT_PLANE_LABELS[verdict.offendingPlane].toLowerCase()

  return (
    <WarningBanner className="max-w-lg">
      Ta inwestycja jest rozliczana {settlementModeLabel(verdict.mode).toLocaleLowerCase()} ale{' '}
      {verdict.offendingCount} {wplatyNoun(verdict.offendingCount)}{' '}
      {oznaczoneVerb(verdict.offendingCount)} jako {plane} ({formatNet(verdict.offendingAmount)}).
      Zmień sposób rozliczenia inwestycji albo edytuj wpłatę.{' '}
      <Link
        href={investmentTransfersHref(investmentId, { types: DEPOSIT_TYPES })}
        className="underline"
      >
        Pokaż wpłaty
      </Link>
    </WarningBanner>
  )
}
