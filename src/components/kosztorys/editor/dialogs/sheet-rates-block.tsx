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

// Why this kwota won, under the kwota itself rather than in a column of its own: the reason is only
// ever read about the figure that went into the kosztorys, and a whole column repeated it per row.
const TAKEN_NOTES: Record<'single' | 'auto', string> = {
  single: 'wzięto — jedyny cennik',
  auto: 'wzięto — wpisana ręcznie',
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
  const conflicts = decisions?.filter((rate) => rate.kind === 'conflict') ?? []
  const resolved =
    decisions?.filter(
      (rate): rate is ReportedRateResolutionT & { kind: 'single' | 'auto' } =>
        rate.kind !== 'conflict',
    ) ?? []

  return (
    <SheetReportBlock
      title="Stawki podwykonawców"
      status={decisions === null || conflicts.length > 0 || stale.length > 0 ? 'warn' : 'ok'}
      verdict={ratesVerdict(decisions, stale, conflicts.length)}
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

      {conflicts.length > 0 && (
        <ReportFold
          summary={`Stawki bez rozstrzygnięcia (${conflicts.length}) — wejdą puste, do uzupełnienia ręcznie`}
        >
          <RatesByTabTable rows={conflicts.map(conflictRow)} />
          {/* The one thing nobody guesses from the table: „zakres pracy z narzędziami" and „zakres
              pracy bez narzędzi" are two catalogues of the SAME prace, and each carries BOTH price
              columns. So the tab name in a row says which catalogue we read, never which column. */}
          <p className="text-muted-foreground text-xs">
            Obie zakładki „zakres pracy" mają obie kolumny — i „z narzędziami", i „bez narzędzi" —
            więc każda z nich sama w sobie wystarczy. Gdy podają różne kwoty, nie wybieramy za
            Ciebie: te prace wejdą bez stawki wykonawcy (0 zł) i czekają na uzupełnienie. Znajdziesz
            je w kosztorysie przez „Problemy → bez ceny wykonawcy". Pusta komórka w cenniku też
            liczy się jako rozbieżność — arkusz pokazuje ją jako 0 zł i nie da się jej odróżnić od
            pracy faktycznie za darmo.
          </p>
        </ReportFold>
      )}

      {resolved.length > 0 && (
        <ReportFold
          tone="text-muted-foreground"
          summary={`Stawki do sprawdzenia (${resolved.length}) — rozstrzygnięte, ale cenniki nie mówiły tego samego`}
        >
          <RatesByTabTable rows={resolved.map(resolvedRow)} />
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
  // Everything in the fold is worth a look — the sentence counts the whole list and then singles out
  // the hardest kind. A bare „7" read as a claim about the whole table, so a row labelled „wzięto
  // wpisaną ręcznie" contradicted the sentence above it.
  if (decisions.length === 0) return 'Oba cenniki podały te same stawki.'
  if (conflicts > 0)
    return `Bez stawki wykonawcy wejdzie ${conflicts} ${rateNoun(conflicts)} — cenniki podają różne kwoty, więc nie wybieramy za Ciebie. Do uzupełnienia ręcznie w kosztorysie.`
  return `${decisions.length} ${rateNoun(decisions.length)} do sprawdzenia — cenniki nie powiedziały tego samego, ale każdą dało się rozstrzygnąć.`
}

// One praca as the table renders it: what each zakładka said, keyed by the zakładka's own name. The
// note under a kwota answers a different question per fold — „wpisana ręcznie / z formuły" where the
// owner has to arbitrate, „wzięto / pominięto" where we already did. `taken` marks the pair that is
// now in the kosztorys, so the owner can read which figure won without reading a note at all.
type TabbedRateCellT = {
  wToolsRate: number
  ownToolsRate: number
  note: string
  taken: boolean
}

type TabbedRateRowT = {
  description: string
  byTab: Map<string, TabbedRateCellT>
}

const conflictRow = (rate: ReportedRateResolutionT): TabbedRateRowT => ({
  description: rate.description,
  byTab: new Map(
    (rate.candidates ?? []).map((candidate) => [
      candidate.tab,
      {
        wToolsRate: candidate.wToolsRate,
        ownToolsRate: candidate.ownToolsRate,
        // Both planes of one zakładka are read from one row, and in practice a row is typed or
        // computed as a whole — one note per pair rather than two identical ones per kwota.
        note: candidate.wToolsTyped || candidate.ownToolsTyped ? 'wpisana ręcznie' : 'z formuły',
        // Nothing is green here on purpose: the whole point of a conflict is that no kwota entered.
        taken: false,
      },
    ]),
  ),
})

const resolvedRow = (
  rate: ReportedRateResolutionT & { kind: 'single' | 'auto' },
): TabbedRateRowT => ({
  description: rate.description,
  byTab: new Map([
    ...(rate.sourceTab
      ? ([
          [
            rate.sourceTab,
            {
              wToolsRate: rate.wToolsRate,
              ownToolsRate: rate.ownToolsRate,
              note: TAKEN_NOTES[rate.kind],
              taken: true,
            },
          ],
        ] as const)
      : []),
    ...(rate.rejected
      ? ([
          [
            rate.rejected.tab,
            {
              wToolsRate: rate.rejected.wToolsRate,
              ownToolsRate: rate.rejected.ownToolsRate,
              note: 'pominięto',
              taken: false,
            },
          ],
        ] as const)
      : []),
  ]),
})

/**
 * Every kwota that was in play, one praca per row and one column pair per zakładka — so the four
 * figures the owner compares sit next to each other instead of in a nested table or in a prose
 * sub-line („pominięto 1625,00 zł / 1381,25 zł z …"), which is what both folds used to do and what
 * made them read as two unrelated reports.
 *
 * Columns come from the rows themselves: a praca listed in only one cennik leaves the other pair
 * empty rather than pretending it said 0 zł.
 */
function RatesByTabTable({ rows }: { rows: TabbedRateRowT[] }) {
  const tabs = [...new Set(rows.flatMap((row) => [...row.byTab.keys()]))]

  return (
    <ReportTable
      headers={[
        'Praca',
        ...tabs.flatMap((tab) => [
          <TabHeader key={`${tab}-w`} tab={tab} plane="Z narzędziami" />,
          <TabHeader key={`${tab}-own`} tab={tab} plane="Bez narzędzi" />,
        ]),
      ]}
    >
      {rows.map((row, index) => (
        <ReportRow
          key={`${index}-${row.description}`}
          label={row.description}
          cells={tabs.flatMap((tab) => {
            const cell = row.byTab.get(tab)
            return [
              {
                content: <RateCell rate={cell?.wToolsRate} note={cell?.note} taken={cell?.taken} />,
              },
              {
                content: (
                  <RateCell rate={cell?.ownToolsRate} note={cell?.note} taken={cell?.taken} />
                ),
              },
            ]
          })}
        />
      ))}
    </ReportTable>
  )
}

// The zakładka above the plane, both in the header: repeating „z zakładki …" on every row is what
// pushed the kwoty apart in the first place.
// „zakres pracy" opens every cennik tab, so in a header repeated four times it is pure width — what
// tells the two apart is the tail. Kept as a fallback if a tab is ever named something else.
const shortTab = (tab: string): string =>
  tab.trim().replace(/^zakres\s+pracy\s*/i, '') || tab.trim()

function TabHeader({ tab, plane }: { tab: string; plane: string }) {
  // The plane never wraps — broken over two lines it reads as two headings. The cennik name below it
  // may wrap; it is the qualifier, not the column's identity.
  return (
    <>
      <span className="block whitespace-nowrap">{plane}</span>
      <span className="block font-normal">cennik „{shortTab(tab)}"</span>
    </>
  )
}

// Green says „this is the kwota the kosztorys now holds" — the question the owner opens this fold
// with, answered by the figure itself instead of by a column pointing at it.
function RateCell({ rate, note, taken }: { rate?: number; note?: string; taken?: boolean }) {
  if (rate === undefined) return <span className="text-muted-foreground">—</span>
  return (
    <>
      <span className={`whitespace-nowrap ${taken ? 'text-green-600' : ''}`}>
        {formatPLN(rate)}
      </span>
      <span
        className={`block text-xs whitespace-nowrap ${taken ? 'text-green-600' : 'text-muted-foreground'}`}
      >
        {note}
      </span>
    </>
  )
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
