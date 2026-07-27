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
  return ['wpłata', 'wpłaty', 'wpłat'][pluralForm(count)]
}

// The participle declines with the same three-way split — „5 wpłat są oznaczone" is as broken as
// „3 wpłat", and the genitive form differs from both singular and paucal.
function oznaczoneVerb(count: number): string {
  return ['jest oznaczona', 'są oznaczone', 'jest oznaczonych'][pluralForm(count)]
}

// 0 = singular, 1 = paucal (2–4), 2 = genitive plural (5+, and the 12–14 exception).
function pluralForm(count: number): 0 | 1 | 2 {
  if (count === 1) return 0
  const lastTwo = count % 100
  const last = count % 10
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 1
  return 2
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
      {oznaczoneVerb(verdict.offendingCount)} jako {plane} (
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
