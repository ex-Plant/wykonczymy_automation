'use client'

import { SheetAccessBlock } from '@/components/kosztorys/editor/dialogs/sheet-access-block'
import { SheetRatesBlock } from '@/components/kosztorys/editor/dialogs/sheet-rates-block'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import { SheetReportDialog } from '@/components/kosztorys/editor/dialogs/sheet-report-dialog'
import {
  ComparisonRow,
  ComparisonTable,
  ItemList,
  ReportFold,
} from '@/components/kosztorys/editor/dialogs/sheet-report-parts'
import {
  itemHasPhrase,
  itemNoun,
  itemNounLocative,
} from '@/components/kosztorys/editor/dialogs/sheet-report-words'
import type { SheetCompareResultT } from '@/lib/actions/kosztorys-import'
import type {
  ComparedItemT,
  ExecutedDiffT,
  SheetComparisonT,
} from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import type { FormulaSampleT } from '@/lib/kosztorys/sheet-import/formula-health'
import { formatQty } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: SheetCompareResultT | null
  loaded: boolean
}

const MATCHES = 0.005

/**
 * „Porównaj z arkuszem" — a live read of the sheet against the stored kosztorys, which also pulls the
 * sheet's Pomiar onto the stored reference figure. Renders a record it does not compute: everything
 * here comes from the action, fetched by the parent on the click (a programmatically-opened Radix
 * dialog never fires `onOpenChange`, so it cannot fetch itself).
 *
 * Answers three questions in order — do the two sides agree on the money, do they hold the same
 * prace, and where did our reading of the sheet have to differ from what it shows. It closes on what
 * the refresh wrote: this window is the only thing that touches the stored Pomiar, so a read-shaped
 * dialog that writes in silence would leave the owner no way to tell it apart from one that doesn't.
 */
export function SheetCompareDialog({ open, onOpenChange, result, loaded }: PropsT) {
  return (
    <SheetReportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Porównaj z arkuszem Google"
      description="Czy arkusz Google i ta aplikacja liczą to samo — i gdzie się rozjeżdżają."
      loaded={loaded}
      data={result}
    >
      {({ comparison, refresh, failure }) =>
        failure ? (
          <SheetAccessBlock failure={failure} />
        ) : !comparison || !refresh ? null : (
          <>
            <MoneyBlock comparison={comparison} />
            <ItemsBlock comparison={comparison} />
            <SheetRatesBlock
              decisions={comparison.rates.decisions}
              stale={comparison.rates.stale}
            />
            <ReadingBlock comparison={comparison} />
            <RefreshLine refresh={refresh} />
          </>
        )
      }
    </SheetReportDialog>
  )
}

/**
 * Only the executed work is compared. The offered scope reads the same column on both sides, so it
 * can disagree only when a praca is missing altogether — which the „Prace" block already says,
 * and the sheet never totals that column anyway.
 */
function MoneyBlock({ comparison }: { comparison: SheetComparisonT }) {
  const { totals, footer } = comparison
  const executed = totals.executedNetFromSheet - totals.executedNetFromApp
  const agree = Math.abs(executed) < MATCHES

  // The sheet sums its prace twice: once off Pomiar z natury („wartość netto") and once off the
  // etapy („R netto"). The gap between the two is its own „pozostało do rozliczenia" — work measured
  // but not yet assigned to an etap, a state this app cannot hold, which is why the same subtraction
  // against our executed total is the honest counterpart rather than a second comparison.
  // Only when the row turned out to hold the measured total. `matchedAgainst` exists because the
  // same „wartość netto" row totals the OFFER on some clients' sheets — reading it as measured work
  // there would print the whole unexecuted scope under a label calling it work already done.
  const netValueRow = footer.find((total) => total.key === 'plannedNet')
  const sheetMeasured =
    netValueRow?.matchedAgainst === 'measuredNet' ? netValueRow.sheetValue : null
  const sheetExecuted = footer.find((total) => total.key === 'executedNet')?.sheetValue ?? null
  const footerDelta = sheetExecuted === null ? null : sheetExecuted - totals.executedNetFromSheet
  const unassignedInSheet =
    sheetMeasured === null || sheetExecuted === null ? null : sheetMeasured - sheetExecuted
  const unassignedHere = sheetMeasured === null ? null : sheetMeasured - totals.executedNetFromApp

  return (
    <SheetReportBlock
      title="Kwoty"
      status={agree ? 'ok' : 'warn'}
      verdict={executedVerdict(executed)}
    >
      <ComparisonTable>
        <ComparisonRow
          label="Wartość prac wykonanych"
          sheet={formatPLN(totals.executedNetFromSheet)}
          app={formatPLN(totals.executedNetFromApp)}
          delta={agree ? null : formatPLN(executed)}
        />
        {unassignedInSheet !== null && unassignedHere !== null && (
          <ComparisonRow
            label="Pozostało do rozliczenia"
            sheet={formatPLN(unassignedInSheet)}
            app={formatPLN(unassignedHere)}
            delta={agree ? null : formatPLN(unassignedInSheet - unassignedHere)}
          />
        )}
      </ComparisonTable>

      <ExecutedDiffList diffs={comparison.executedDiffs} link={comparison.sheetLink} />

      {unassignedInSheet !== null && (
        <p className="text-muted-foreground text-xs">
          „Pozostało do rozliczenia" to praca zmierzona w arkuszu Google, której nie rozpisano
          jeszcze na żaden etap.
        </p>
      )}
      {footerDelta !== null && Math.abs(footerDelta) >= MATCHES && (
        <p className="text-xs text-amber-600">
          Podsumowanie na dole arkusza Google, „R netto - suma prac wykonannych", wychodzi{' '}
          {formatPLN(sheetExecuted ?? 0)} — o {formatPLN(footerDelta)} inaczej niż suma jego
          własnych prac.
        </p>
      )}
    </SheetReportBlock>
  )
}

// The sign says which side is ahead, so it is named rather than left as a bare `< 0` in the middle
// of a ternary — reading it backwards would tell the owner the wrong side is behind on its etapy.
function executedVerdict(executed: number): string {
  if (Math.abs(executed) < MATCHES) return 'Obie strony policzyły tyle samo prac wykonanych.'
  if (executed < 0)
    return `Tutaj rozpisano na etapy o ${formatPLN(-executed)} więcej pracy niż w arkuszu Google.`
  return `W arkuszu Google rozpisano na etapy o ${formatPLN(executed)} więcej pracy niż tutaj.`
}

function ItemsBlock({ comparison }: { comparison: SheetComparisonT }) {
  const { counts, onlyInSheet, onlyInApp } = comparison
  const agree = onlyInSheet.length === 0 && onlyInApp.length === 0

  return (
    <SheetReportBlock
      title="Prace"
      status={agree ? 'ok' : 'warn'}
      verdict={
        agree
          ? `Obie strony mają te same ${counts.matched} ${itemNoun(counts.matched)}.`
          : `${counts.matched} ${itemNoun(counts.matched)} jest po obu stronach. Reszta istnieje tylko po jednej — a skoro kwoty liczą się z prac, to zwykle tu leży różnica.`
      }
    >
      {!agree && (
        <>
          <ComparisonTable>
            <ComparisonRow
              label="Ile prac w ogóle"
              sheet={`${counts.sheetItems}`}
              app={`${counts.appItems}`}
              delta={null}
            />
          </ComparisonTable>
          <SideOnlyList
            label="Tylko w arkuszu Google — nie ma ich w aplikacji"
            items={onlyInSheet}
          />
          <SideOnlyList label="Tylko w aplikacji — nie ma ich w arkuszu Google" items={onlyInApp} />
          <p className="text-muted-foreground text-xs">
            Prace kojarzymy po nazwie sekcji i opisie, bo arkusz Google nie ma identyfikatorów.
            Poprawiona literówka w opisie wystarczy, żeby ta sama praca trafiła na obie listy.
          </p>
        </>
      )}
    </SheetReportBlock>
  )
}

/**
 * These sheets belong to the clients, have worked for years, and none of them are built the same
 * way — so this block judges our reading, never their sheet. It reports where the two models differ
 * and what that costs the comparison above; a line here is never a defect anyone is asked to fix.
 */
function ReadingBlock({ comparison }: { comparison: SheetComparisonT }) {
  const { health, sheetLink } = comparison
  const clean =
    health.measuredCopiedFromPlanned === 0 &&
    health.plannedReadFromStage === 0 &&
    health.errorValues === 0

  return (
    <SheetReportBlock
      title="Jak odczytaliśmy arkusz Google"
      status={clean ? 'ok' : 'warn'}
      verdict={
        clean
          ? 'Wszystko wzięliśmy wprost — nic po drodze nie zgadywaliśmy.'
          : 'W tych miejscach aplikacja czyta arkusz Google inaczej, niż on wygląda na ekranie. Nic tu nie jest zepsute — tyle tylko umiemy stąd wziąć, i stąd mogą brać się różnice powyżej.'
      }
    >
      {clean ? null : (
        <>
          <SampleList
            summary={`${health.errorValues} ${itemHasPhrase(health.errorValues)} w miejscu kwoty wartość błędu (#REF!, #DIV/0!) — nie ma tam liczby, więc czytamy zero.`}
            samples={health.samples.errorValue}
            link={sheetLink}
            tone="text-destructive"
          />
          <SampleList
            summary={`${health.plannedReadFromStage} ${itemHasPhrase(health.plannedReadFromStage)} Przedmiar policzony z etapu. U nas Przedmiar to osobna liczba, wpisywana ręcznie — nie zmieni się, kiedy zmienisz etap.`}
            samples={health.samples.plannedReadFromStage}
            link={sheetLink}
          />
          {health.measuredCopiedFromPlanned > 0 && (
            // A count, never a list (owner, 2026-08-14): on a blank offer sheet this is the normal
            // state of every row, so a fold to open would send them hunting through hundreds of
            // prace that are not wrong.
            <p className="text-xs text-amber-600">
              W {health.measuredCopiedFromPlanned} z {health.totalRows} prac Pomiar z natury
              wskazuje na Przedmiar. U nas pomiar to zawsze suma etapów.
            </p>
          )}
        </>
      )}
    </SheetReportBlock>
  )
}

// The one line that says this window wrote something. „Już zgodne" is the answer that matters most:
// it is what tells the owner a second look changed nothing, rather than leaving them to wonder.
function RefreshLine({ refresh }: { refresh: NonNullable<SheetCompareResultT['refresh']> }) {
  const { updated, cleared, unmatched } = refresh
  const skipped =
    unmatched > 0
      ? ` Pominięto ${unmatched} ${itemNoun(unmatched)} bez odpowiednika w arkuszu Google.`
      : ''
  return (
    <p className="text-muted-foreground text-xs">
      {updated === 0 && cleared === 0
        ? `Zapisany Pomiar z natury był już zgodny z arkuszem Google.${skipped}`
        : `Zaciągnięto Pomiar z natury: zaktualizowano ${updated}, wyczyszczono ${cleared}.${skipped}`}
    </p>
  )
}

function SampleList({
  summary,
  samples,
  link,
  tone,
}: {
  summary: string
  samples: FormulaSampleT[]
  link: SheetComparisonT['sheetLink']
  tone?: string
}) {
  if (samples.length === 0) return null
  return (
    <ReportFold summary={summary} tone={tone}>
      {samples.map((sample) => (
        <p key={sample.cell} className="text-muted-foreground text-xs">
          <SheetCellLink cell={sample.cell} link={link} /> · {sample.description}
        </p>
      ))}
    </ReportFold>
  )
}

// Where the money block's difference actually sits. Every praca that contributes is listed — the sum
// of this list IS the number in the table, so a shortened list would be a lie about a total.
function ExecutedDiffList({
  diffs,
  link,
}: {
  diffs: ExecutedDiffT[]
  link: SheetComparisonT['sheetLink']
}) {
  if (diffs.length === 0) return null
  return (
    <ReportFold
      summary={`Różnica siedzi w ${diffs.length} ${itemNounLocative(diffs.length)} — zobacz w których.`}
    >
      <ComparisonTable>
        {diffs.map((diff) => (
          <ComparisonRow
            key={diff.cell}
            label={
              <>
                <SheetCellLink cell={diff.cell} link={link} /> · {diff.section} · {diff.description}
                {diff.sheetQty === diff.appQty && (
                  <span className="text-muted-foreground">
                    {' '}
                    — ta sama ilość, więc różni się cena albo rabat
                  </span>
                )}
              </>
            }
            sheet={`${formatPLN(diff.sheetNet)} (${formatQty(diff.sheetQty)})`}
            app={`${formatPLN(diff.appNet)} (${formatQty(diff.appQty)})`}
            delta={formatPLN(diff.sheetNet - diff.appNet)}
          />
        ))}
      </ComparisonTable>
    </ReportFold>
  )
}

function SheetCellLink({ cell, link }: { cell: string; link: SheetComparisonT['sheetLink'] }) {
  if (!link) return <>komórka {cell}</>
  return (
    <a
      href={`https://docs.google.com/spreadsheets/d/${link.spreadsheetId}/edit#gid=${link.gid}&range=${cell}`}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      komórka {cell}
    </a>
  )
}

function SideOnlyList({ label, items }: { label: string; items: ComparedItemT[] }) {
  if (items.length === 0) return null
  return (
    <ReportFold
      tone="text-muted-foreground"
      summary={
        <span className="text-foreground text-xs font-medium">
          {label} ({items.length})
        </span>
      }
    >
      <ItemList items={items} />
    </ReportFold>
  )
}
