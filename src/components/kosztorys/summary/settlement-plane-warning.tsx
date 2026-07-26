import { VAT_PLANE_LABELS } from '@/lib/constants/transfers'
import { settlementModeLabel } from '@/lib/kosztorys/settlement-mode'
import { formatNet } from '@/lib/kosztorys/format'
import { WarningBanner } from '@/components/ui/warning-banner'
import type { SettlementPlaneVerdictT } from '@/lib/kosztorys/reconciliation'

// Owner-only, like the robocizna/rabat scream: a client can't act on it and shouldn't see the doubt.
export function SettlementPlaneWarning({ verdict }: { verdict: SettlementPlaneVerdictT }) {
  if (!verdict.offendingPlane) return null

  return (
    <WarningBanner className="max-w-lg">
      Rozliczenie: {settlementModeLabel(verdict.mode)} — a wpłaty{' '}
      {VAT_PLANE_LABELS[verdict.offendingPlane].toLowerCase()}: {formatNet(verdict.offendingAmount)}.
      Zweryfikuj sposób rozliczenia albo płaszczyznę wpłaty.
    </WarningBanner>
  )
}
