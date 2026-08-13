'use client'

import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import type {
  ComparedItemT,
  SheetComparisonT,
} from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import { formatPLN } from '@/lib/utils/format-currency'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  comparison: SheetComparisonT | null
  loaded: boolean
}

// A rozpiska runs to hundreds of prace, and an unmatched list that long is a wall, not an answer —
// enough rows to recognise the pattern, then a count.
const LIST_CAP = 12

/**
 * „Porównaj z arkuszem" — a live read of the sheet against the stored kosztorys. Renders a record it
 * does not compute: everything here comes from `buildSheetComparison`, fetched by the parent on the
 * click (a programmatically-opened Radix dialog never fires `onOpenChange`, so it cannot fetch itself).
 */
export function SheetCompareDialog({ open, onOpenChange, comparison, loaded }: PropsT) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader
          title="Porównaj z arkuszem"
          description="Odczyt arkusza na żywo. Nic nie jest zapisywane — to tylko rachunek obu stron."
        />

        {!loaded ? (
          <p className="text-muted-foreground text-sm">Czytam arkusz…</p>
        ) : !comparison ? (
          <p className="text-destructive text-sm">Nie udało się odczytać arkusza.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <SheetReportBlock title="Rachunek obu stron">
              <TotalsRow
                label="Wartość netto przedmiar"
                sheet={comparison.totals.plannedNetFromSheet}
                app={comparison.totals.plannedNetFromApp}
              />
              <TotalsRow
                label="Wartość prac wykonanych"
                sheet={comparison.totals.executedNetFromSheet}
                app={comparison.totals.executedNetFromApp}
              />
              <p className="text-muted-foreground text-xs">
                Arkusz: {comparison.counts.sheetItems} prac · aplikacja {comparison.counts.appItems}{' '}
                prac · wspólnych {comparison.counts.matched}
              </p>
            </SheetReportBlock>

            <SheetReportBlock title="Pomiar z natury a „Rozjazd”">
              <p
                className={
                  comparison.health.measuredCopiedFromPlanned > 0
                    ? 'text-amber-600'
                    : 'text-muted-foreground'
                }
              >
                {comparison.health.measuredCopiedFromPlanned > 0
                  ? `Na ${comparison.health.measuredCopiedFromPlanned} z ${comparison.health.totalRows} pozycji arkusza Pomiar z natury jest przepisany z Przedmiaru — to nie jest pomiar, więc kolumna „Rozjazd” nic o nich nie powie.`
                  : 'Żadna pozycja arkusza nie ma Pomiaru przepisanego z Przedmiaru.'}
              </p>
              <p className="text-muted-foreground text-xs">
                Odniesienie zapisane w aplikacji ma {comparison.referenceQty.withValue} z{' '}
                {comparison.referenceQty.matched} wspólnych pozycji.
              </p>
              {comparison.health.plannedReadFromStage > 0 && (
                <p className="text-xs text-amber-600">
                  {comparison.health.plannedReadFromStage} pozycji ma Przedmiar liczony z etapu —
                  oferta staje się pochodną wykonania, a pusty etap daje ofertę zerową.
                </p>
              )}
              {comparison.health.errorValues > 0 && (
                <p className="text-destructive text-xs">
                  {comparison.health.errorValues} pozycji ma w arkuszu wartość błędu (#REF!,
                  #DIV/0!) — czytamy je jako zero.
                </p>
              )}
              {comparison.health.samples.map((sample) => (
                <p key={`${sample.row}-${sample.klass}`} className="text-muted-foreground text-xs">
                  wiersz {sample.row} · {sample.description}
                </p>
              ))}
            </SheetReportBlock>

            <SheetReportBlock title="Sumy w samym arkuszu">
              {comparison.footer.map((total) => (
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

            {(comparison.onlyInSheet.length > 0 || comparison.onlyInApp.length > 0) && (
              <SheetReportBlock title="Pozycje tylko po jednej stronie">
                <p className="text-muted-foreground text-xs">
                  Pozycje rozpoznajemy po nazwie sekcji i opisie — arkusz nie ma identyfikatorów. Po
                  zmianie nazwy ta sama praca pojawi się na obu listach.
                </p>
                <CappedList label="Tylko w arkuszu" items={comparison.onlyInSheet} />
                <CappedList label="Tylko w aplikacji" items={comparison.onlyInApp} />
              </SheetReportBlock>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
