import { TriangleAlert } from 'lucide-react'
import { SETTLEMENT_MODE_OPTIONS } from '@/lib/kosztorys/money-axis'
import { formatNet } from '@/lib/kosztorys/format'
import type { SettlementPlaneVerdictT } from '@/lib/kosztorys/reconciliation'

// A wpłata tagged on the other plane than the investment is settled on. It records and counts, so the
// totals look fine — only this says which of the two is wrong (the mode or the wpłata's plane).
// Owner-only, like the robocizna/rabat scream: a client can't act on it and shouldn't see the doubt.
export function SettlementPlaneWarning({ verdict }: { verdict: SettlementPlaneVerdictT }) {
  const modeLabel = SETTLEMENT_MODE_OPTIONS.find(({ value }) => value === verdict.mode)?.label
  const offendingPlane = verdict.mode === 'NET' ? 'brutto' : 'netto'

  return (
    <p
      role="alert"
      className="border-destructive text-destructive flex max-w-lg items-start gap-2 rounded border-2 px-2 py-1.5 text-xs font-semibold"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span>
        Rozliczenie: {modeLabel} — a wpłaty {offendingPlane}:{' '}
        {formatNet(verdict.offendingAmount)}. Zweryfikuj sposób rozliczenia albo płaszczyznę wpłaty.
      </span>
    </p>
  )
}
