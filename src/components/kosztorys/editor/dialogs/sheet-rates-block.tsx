'use client'

import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import {
  ReportFold,
  ReportRow,
  ReportTable,
} from '@/components/kosztorys/editor/dialogs/sheet-report-parts'
import { rateNoun, rateNounDiffers } from '@/components/kosztorys/editor/dialogs/sheet-report-words'
import type { StaleRateT } from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import type { ReportedRateResolutionT } from '@/lib/kosztorys/sheet-import/resolve-rates'
import { formatPLN } from '@/lib/utils/format-currency'

const SOURCE_LABELS: Record<ReportedRateResolutionT['kind'], string> = {
  single: 'tylko w jednym cenniku',
  auto: 'wzięto wpisaną ręcznie',
  conflict: 'do sprawdzenia',
}

type PropsT = {
  // Every resolution that was not a plain agreement between the two cenniki. `null` says no cennik
  // could be read at all — a different statement from „the cenniki agreed", and the only honest one
  // on a sheet whose „zakres pracy" header is broken.
  decisions: ReportedRateResolutionT[] | null
  // „Porównaj z arkuszem" only: stawki the kosztorys holds that the cennik no longer says. The import
  // preview has no counterpart — it is about to overwrite every stawka anyway.
  stale?: StaleRateT[]
}

/**
 * „Stawki podwykonawców" in both sheet dialogs. Shared rather than written twice because the two
 * dialogs answer the same question from opposite ends: the import asks which stawka it is about to
 * write, the comparison asks whether the one already written still matches the cennik. A second
 * implementation would have drifted on the wording of the very column that decides a crew's bill.
 */
export function SheetRatesBlock({ decisions, stale = [] }: PropsT) {
  const conflicts = decisions?.filter((rate) => rate.kind === 'conflict').length ?? 0

  return (
    <SheetReportBlock
      title="Stawki podwykonawców"
      status={decisions === null || conflicts > 0 || stale.length > 0 ? 'warn' : 'ok'}
      verdict={ratesVerdict(decisions, stale, conflicts)}
    >
      {stale.length > 0 && (
        <ReportFold summary={`Stawki inne niż w cenniku (${stale.length}) — zobacz które`}>
          <ReportTable headers={['Praca', 'Z narzędziami', 'Bez narzędzi']}>
            {stale.map((rate, index) => (
              <ReportRow
                key={`${index}-${rate.description}`}
                label={
                  <>
                    <span>{rate.description}</span>
                    <span className="text-muted-foreground block text-xs">{rate.section}</span>
                  </>
                }
                cells={[
                  { content: <RatePair sheet={rate.sheetWTools} app={rate.appWTools} /> },
                  { content: <RatePair sheet={rate.sheetOwnTools} app={rate.appOwnTools} /> },
                ]}
              />
            ))}
          </ReportTable>
        </ReportFold>
      )}

      {decisions !== null && decisions.length > 0 && (
        <ReportFold
          tone={conflicts === 0 ? 'text-muted-foreground' : 'text-amber-600'}
          summary={`Rozstrzygnięcia stawek (${decisions.length}) — zobacz które`}
        >
          <ReportTable headers={['Praca', 'Z narzędziami', 'Bez narzędzi', 'Skąd']}>
            {decisions.map((rate, index) => (
              <ReportRow
                key={`${index}-${rate.description}`}
                label={
                  <>
                    <span>{rate.description}</span>
                    {rate.rejected && (
                      <span className="text-muted-foreground block text-xs">
                        pominięto {formatPLN(rate.rejected.wToolsRate)} z „{rate.rejected.tab}"
                      </span>
                    )}
                  </>
                }
                cells={[
                  { content: formatPLN(rate.wToolsRate) },
                  { content: formatPLN(rate.ownToolsRate) },
                  {
                    content: SOURCE_LABELS[rate.kind],
                    tone: rate.kind === 'conflict' ? 'text-amber-600' : 'text-muted-foreground',
                  },
                ]}
              />
            ))}
          </ReportTable>
        </ReportFold>
      )}
    </SheetReportBlock>
  )
}

/**
 * One line, and the order is the point: this is a precedence chain, not a list of things that are
 * true. „Żadnego cennika nie odczytaliśmy" outranks the rest because nothing below it is even
 * knowable; a stawka that has drifted from the cennik outranks one we merely had to choose between,
 * because the drifted one is already billing somebody. „Zgodne" is what is left when nothing above
 * fired.
 */
function ratesVerdict(
  decisions: ReportedRateResolutionT[] | null,
  stale: StaleRateT[],
  conflicts: number,
): string {
  if (decisions === null)
    return 'Nie odczytaliśmy żadnego cennika („zakres pracy") — o stawkach podwykonawców nic tu nie powiemy.'
  if (stale.length > 0)
    return `${stale.length} ${rateNounDiffers(stale.length)} od cennika w arkuszu Google — kosztorys trzyma to, co było przy pobraniu.`
  if (conflicts > 0)
    return `${conflicts} ${rateNoun(conflicts)} do sprawdzenia: cenniki podają różne kwoty i żadna nie jest wpisana ręcznie.`
  if (decisions.length === 0) return 'Oba cenniki podały te same stawki.'
  return `${decisions.length} ${rateNoun(decisions.length)} wzięliśmy z jednego cennika — reszta zgodna.`
}

// The cennik's figure over the kosztorys's, so a scan down the column reads as one pair per praca.
// An unchanged plane still prints both — otherwise the eye cannot tell „the same" from „not read".
function RatePair({ sheet, app }: { sheet: number; app: number }) {
  return (
    <>
      <span className={Math.abs(sheet - app) < 0.005 ? undefined : 'text-amber-600'}>
        {formatPLN(sheet)}
      </span>
      <span className="text-muted-foreground block text-xs">{formatPLN(app)} w kosztorysie</span>
    </>
  )
}
