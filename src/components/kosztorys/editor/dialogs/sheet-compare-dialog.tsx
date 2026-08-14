'use client'

import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import type { SheetCompareResultT } from '@/lib/actions/kosztorys-import'
import type {
  ComparedItemT,
  SheetComparisonT,
} from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import type { FormulaSampleT } from '@/lib/kosztorys/sheet-import/formula-health'
import { formatPLN } from '@/lib/utils/format-currency'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: SheetCompareResultT | null
  loaded: boolean
}

// A rozpiska runs to hundreds of prace, and an unmatched list that long is a wall, not an answer —
// enough rows to recognise the pattern, then a count.
const LIST_CAP = 12

/**
 * „Porównaj z arkuszem" — a live read of the sheet against the stored kosztorys, which also pulls the
 * sheet's Pomiar onto the stored reference figure. Renders a record it does not compute: everything
 * here comes from the action, fetched by the parent on the click (a programmatically-opened Radix
 * dialog never fires `onOpenChange`, so it cannot fetch itself).
 */
export function SheetCompareDialog({ open, onOpenChange, result, loaded }: PropsT) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader
          title="Porównaj z arkuszem"
          description="Odczyt arkusza na żywo. Zapisane Pomiary z natury są przy okazji odświeżane — reszta kosztorysu zostaje nietknięta."
        />

        {!loaded ? (
          <p className="text-muted-foreground text-sm">Czytam arkusz…</p>
        ) : !result ? (
          <p className="text-destructive text-sm">Nie udało się odczytać arkusza.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <SheetReportBlock title="Rachunek obu stron">
              <TotalsRow
                label="Wartość netto przedmiar"
                sheet={result.comparison.totals.plannedNetFromSheet}
                app={result.comparison.totals.plannedNetFromApp}
              />
              <TotalsRow
                label="Wartość prac wykonanych"
                sheet={result.comparison.totals.executedNetFromSheet}
                app={result.comparison.totals.executedNetFromApp}
              />
              <p className="text-muted-foreground text-xs">
                Arkusz: {result.comparison.counts.sheetItems} prac · aplikacja{' '}
                {result.comparison.counts.appItems} prac · wspólnych{' '}
                {result.comparison.counts.matched}
              </p>
            </SheetReportBlock>

            <SheetReportBlock title="Pomiar z natury a „Rozjazd”">
              <RefreshLine refresh={result.refresh} />
              <p
                className={
                  result.comparison.health.measuredCopiedFromPlanned > 0
                    ? 'text-amber-600'
                    : 'text-muted-foreground'
                }
              >
                {result.comparison.health.measuredCopiedFromPlanned > 0
                  ? `Na ${result.comparison.health.measuredCopiedFromPlanned} z ${result.comparison.health.totalRows} pozycji arkusza Pomiar z natury jest przepisany z Przedmiaru — to nie jest pomiar, więc kolumna „Rozjazd” nic o nich nie powie.`
                  : 'Żadna pozycja arkusza nie ma Pomiaru przepisanego z Przedmiaru.'}
              </p>
              <p className="text-muted-foreground text-xs">
                Odniesienie zapisane w aplikacji ma {result.comparison.referenceQty.withValue} z{' '}
                {result.comparison.referenceQty.matched} wspólnych pozycji.
              </p>

              <SampleList
                count={result.comparison.health.plannedReadFromStage}
                note="Przedmiar liczony z etapu — oferta staje się pochodną wykonania, a pusty etap daje ofertę zerową."
                samples={result.comparison.health.samples.plannedReadFromStage}
                link={result.comparison.sheetLink}
              />
              <SampleList
                count={result.comparison.health.errorValues}
                note="wartość błędu w arkuszu (#REF!, #DIV/0!) — czytamy ją jako zero."
                samples={result.comparison.health.samples.errorValue}
                link={result.comparison.sheetLink}
                tone="text-destructive"
              />
            </SheetReportBlock>

            <SheetReportBlock title="Sumy w samym arkuszu">
              {result.comparison.footer.map((total) => (
                <p
                  key={total.key}
                  className={
                    total.sheetValue !== null && !total.matches
                      ? 'text-xs text-amber-600'
                      : 'text-muted-foreground text-xs'
                  }
                >
                  {total.label}: podsumowanie{' '}
                  {total.sheetValue === null ? 'nie znaleziono' : formatPLN(total.sheetValue)} ·
                  pozycje {formatPLN(total.appValue)}
                  {total.delta === null ? '' : ` · różnica ${formatPLN(total.delta)}`}
                </p>
              ))}
            </SheetReportBlock>

            {(result.comparison.onlyInSheet.length > 0 ||
              result.comparison.onlyInApp.length > 0) && (
              <SheetReportBlock title="Pozycje tylko po jednej stronie">
                <p className="text-muted-foreground text-xs">
                  Pozycje rozpoznajemy po nazwie sekcji i opisie — arkusz nie ma identyfikatorów. Po
                  zmianie nazwy ta sama praca pojawi się na obu listach.
                </p>
                <CappedList label="Tylko w arkuszu" items={result.comparison.onlyInSheet} />
                <CappedList label="Tylko w aplikacji" items={result.comparison.onlyInApp} />
              </SheetReportBlock>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RefreshLine({ refresh }: { refresh: SheetCompareResultT['refresh'] }) {
  const { updated, cleared, unmatched } = refresh
  const skipped = unmatched > 0 ? ` · pominięto ${unmatched} bez odpowiednika w arkuszu` : ''
  return (
    <p className="text-muted-foreground text-xs">
      {updated === 0 && cleared === 0
        ? `Zapisane Pomiary były już zgodne z arkuszem${skipped}.`
        : `Zaciągnięto Pomiary: ${updated} pozycji · wyczyszczono ${cleared}${skipped}.`}
    </p>
  )
}

function SampleList({
  count,
  note,
  samples,
  link,
  tone = 'text-amber-600',
}: {
  count: number
  note: string
  samples: FormulaSampleT[]
  link: SheetComparisonT['sheetLink']
  tone?: string
}) {
  if (count === 0) return null
  return (
    <div className="space-y-0.5">
      <p className={`text-xs ${tone}`}>
        {count} {count === 1 ? 'pozycja ma' : 'pozycji ma'} {note}
      </p>
      {samples.map((sample) => (
        <p key={sample.cell} className="text-muted-foreground text-xs">
          <SheetCellLink cell={sample.cell} link={link} /> · {sample.description}
        </p>
      ))}
      {count > samples.length && (
        <p className="text-muted-foreground text-xs">…i {count - samples.length} więcej</p>
      )}
    </div>
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

function TotalsRow({ label, sheet, app }: { label: string; sheet: number; app: number }) {
  const delta = sheet - app
  return (
    <p className={Math.abs(delta) < 0.005 ? 'text-muted-foreground' : 'text-amber-600'}>
      {label}: arkusz {formatPLN(sheet)} · aplikacja {formatPLN(app)} · różnica {formatPLN(delta)}
    </p>
  )
}

function CappedList({ label, items }: { label: string; items: ComparedItemT[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs font-medium">
        {label} ({items.length})
      </p>
      {items.slice(0, LIST_CAP).map((item, index) => (
        <p key={`${index}-${item.description}`} className="text-muted-foreground text-xs">
          {item.section} · {item.description}
        </p>
      ))}
      {items.length > LIST_CAP && (
        <p className="text-muted-foreground text-xs">…i {items.length - LIST_CAP} więcej</p>
      )}
    </div>
  )
}
