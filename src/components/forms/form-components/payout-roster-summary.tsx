import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { WarningBanner } from '@/components/ui/warning-banner'
import { HintTooltip } from '@/components/ui/tooltip'
import { formatNet } from '@/lib/kosztorys/format'
import { pluralize } from '@/lib/utils/polish-plural'
import { cn } from '@/lib/utils/cn'
import { workerKey } from '@/lib/kosztorys/subcontractor-summary'
import type { SubcontractorRosterT } from '@/lib/queries/subcontractor-roster'

function stageNoun(count: number): string {
  return pluralize(count, ['etap', 'etapy', 'etapów'])
}

// The badge next to ONE worker's figure, so it needs its own aria-label: `PlaneUnconfirmedBadge`'s
// names rozliczenie etapu and `LabelHintIcon`'s `mismatch` variant is asserted by E2E — reusing
// either would make the wrong sentence readable to a screen reader and to a test.
function NoStagesBadge() {
  return (
    <HintTooltip
      content="Ta osoba nie ma przypisanego żadnego etapu na tej inwestycji, więc jej „należne” to 0 — wypłata pokaże się jako nadpłata, dopóki etapy nie zostaną przypisane."
      className="text-destructive"
    >
      <TriangleAlert className="size-4" aria-label="Pracownik bez przypisanych etapów" />
    </HintTooltip>
  )
}

/**
 * Read-only and non-blocking on purpose: it never touches `transferFieldRules`, never becomes a zod
 * issue and never gates submit — a wypłata to somebody with no etapy is legitimate to record.
 *
 * Both warnings name a count and offer somewhere to go, per `SettlementPlaneWarning`'s rule.
 */
export function PayoutRosterSummary({
  roster,
  isLoading,
  investmentId,
  selectedWorkerId,
  selectedWorkerName,
}: {
  roster: SubcontractorRosterT | null
  isLoading: boolean
  investmentId: number
  selectedWorkerId: number | null
  selectedWorkerName?: string
}) {
  if (isLoading) {
    return <p className="text-muted-foreground mt-6 text-sm">Wczytywanie rozliczenia…</p>
  }
  if (!roster) return null

  // A worker absent from the roster is `no_stages` reached from the other side — never assigned an
  // etap AND never paid, so no row was ever built. Synthesised into a zero row rather than left out,
  // so the "no etapy" warning is one badge in one place instead of two shapes saying one thing.
  const selected =
    selectedWorkerId === null
      ? null
      : (roster.rows.find((row) => row.workerId === selectedWorkerId) ?? {
          workerId: selectedWorkerId,
          name: selectedWorkerName ?? 'Wybrany pracownik',
          due: 0,
          paid: 0,
          remaining: 0,
          state: 'no_stages' as const,
        })
  const visible = selected ? [selected] : roster.rows

  if (visible.length === 0 && roster.unassignedStageCount === 0) return null

  return (
    <div className="bg-muted/50 border-border mt-6 space-y-2 rounded-lg border px-6 py-4">
      <p className="text-sm font-medium">Rozliczenie robocizny na tej inwestycji</p>

      {roster.unassignedStageCount > 0 && (
        <WarningBanner>
          {roster.unassignedStageCount} {stageNoun(roster.unassignedStageCount)} z wykonanymi
          pracami nie ma przypisanej osoby — kwoty poniżej są zaniżone o tę robociznę.{' '}
          <Link href={`/inwestycje/${investmentId}/kosztorys_v2`} className="underline">
            Przypisz etapy
          </Link>
        </WarningBanner>
      )}

      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">Brak rozliczonych etapów na tej inwestycji.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {visible.map((row) => (
            <li key={workerKey(row.workerId)} className="flex flex-wrap items-center gap-x-3">
              <span className="flex items-center gap-1.5 font-medium">
                {row.name}
                {row.state === 'no_stages' && <NoStagesBadge />}
              </span>
              <span className="text-muted-foreground">należne {formatNet(row.due)}</span>
              <span className="text-muted-foreground">wypłacono {formatNet(row.paid)}</span>
              <span className={cn('font-medium', row.remaining < 0 && 'text-destructive')}>
                pozostało {formatNet(row.remaining)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
