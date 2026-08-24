import { getPayload } from 'payload'
import config from '@payload-config'
import { parseInvestmentId, requireInvestmentOr404 } from '@/lib/queries/investments'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { SheetIframeView } from '@/components/sheets/iframe-view'
import { SyncButton } from '@/components/sheets/sync-button'

// The legacy Google Sheet ("arkusz") view. The in-app editor lives at its own
// /kosztorys_v2 route now — this page is sheet-only.
export default async function InvestmentKosztorysPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // The sheet lookup keys off the parsed id, not off the guard's result, so it has no reason to wait
  // for it. Safe to run beside a guard that redirects, unlike the kosztorys_v2 fan-out: this lookup
  // reads with overrideAccess and never throws, so nothing here can beat the redirect to the answer.
  const investmentId = parseInvestmentId(id)
  // Sheet id lives on the kosztoryses collection, not on investments.
  const sheetIdPromise = getPayload({ config }).then((payload) =>
    getInvestmentSheetId(payload, investmentId),
  )
  const [{ investment }, sheetId] = await Promise.all([requireInvestmentOr404(id), sheetIdPromise])

  if (sheetId) {
    return (
      <SheetIframeView
        sheetId={sheetId}
        investmentName={investment.name}
        toolbar={<SyncButton investmentId={investmentId} />}
      />
    )
  }

  // Reached without a linked sheet: offer the same setup entry point as the listing.
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-muted-foreground text-sm">
        Inwestycja <strong>{investment.name}</strong> nie ma jeszcze arkusza.
      </p>
      <SheetButton investmentId={investmentId} hasSheet={false} />
    </div>
  )
}
