import Link from 'next/link'
import { DEPOSIT_TYPES, VAT_PLANE_LABELS } from '@/lib/constants/transfers'
import { settlementModeLabel } from '@/lib/kosztorys/settlement-mode'
import { formatNet } from '@/lib/kosztorys/format'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { WarningBanner } from '@/components/ui/warning-banner'
import type { SettlementPlaneVerdictT } from '@/lib/kosztorys/reconciliation'

// Polish counts three ways (1 / 2-4 / 5+), and „3 wpłat" reads as broken UI rather than a warning
// worth acting on.
function wplatyNoun(count: number): string {
  if (count === 1) return 'wpłata'
  const lastTwo = count % 100
  const last = count % 10
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'wpłaty'
  return 'wpłat'
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
      Ta inwestycja jest rozliczana: {settlementModeLabel(verdict.mode)}, ale{' '}
      {verdict.offendingCount} {wplatyNoun(verdict.offendingCount)}{' '}
      {verdict.offendingCount === 1 ? 'jest oznaczona' : 'są oznaczone'} jako {plane} (
      {formatNet(verdict.offendingAmount)}). Albo inwestycja rozlicza się inaczej, niż jest
      ustawiona, albo te wpłaty mają zły znacznik.{' '}
      <Link
        href={investmentTransfersHref(investmentId, { types: DEPOSIT_TYPES })}
        className="underline"
      >
        Pokaż wpłaty
      </Link>
    </WarningBanner>
  )
}
