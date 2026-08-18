'use client'

import { useTransition } from 'react'
import { DialogActions } from '@/components/ui/dialog-actions'
import { SheetAccessBlock } from '@/components/kosztorys/editor/dialogs/sheet-access-block'
import { SheetColumnPicker } from '@/components/kosztorys/editor/dialogs/sheet-column-picker'
import { evaluateImportGate } from '@/components/kosztorys/editor/dialogs/sheet-import-gate'
import { SheetProblemsBlock } from '@/components/kosztorys/editor/dialogs/sheet-problems-block'
import { SheetRatesBlock } from '@/components/kosztorys/editor/dialogs/sheet-rates-block'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import { SheetReportDialog } from '@/components/kosztorys/editor/dialogs/sheet-report-dialog'
import {
  ComparisonRow,
  ComparisonTable,
  ItemList,
  ReportFold,
  ReportRow,
  ReportTable,
} from '@/components/kosztorys/editor/dialogs/sheet-report-parts'
import { columnNoun, itemNoun } from '@/components/kosztorys/editor/dialogs/sheet-report-words'
import { applyKosztorysImport, type ImportPreviewT } from '@/lib/actions/kosztorys-import'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import { formatCoeff } from '@/lib/kosztorys/format'
import type { ImportReportT } from '@/lib/kosztorys/sheet-import/build-import-plan'
import type { FooterComparisonT } from '@/lib/kosztorys/sheet-import/footer-totals'
import type {
  UnresolvedColumnsT,
  UnresolvedReasonT,
} from '@/lib/kosztorys/sheet-import/resolve-columns'
import { formatPLN } from '@/lib/utils/format-currency'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: ImportPreviewT | null
  error: string | null
  loaded: boolean
  onImported: () => void
  // Re-reads the sheet with the new pointing in place, so the window answers in place instead of
  // asking the owner to close it and try again.
  onMappingSaved: () => void
}

const MISSING_COLUMN_REASONS: Record<UnresolvedReasonT, string> = {
  absent: 'nie ma jej w arkuszu',
  ambiguous: 'pasuje do kilku kolumn — zmień nazwę tej drugiej',
}

// „Pobierz z arkusza Google…" — what the import would do, before it does it. The confirm re-derives
// everything server-side, so nothing rendered here is trusted on the way back. Built from the same
// blocks as „Porównaj z arkuszem": a verdict per question, and every long list folded behind it.
export function SheetImportDialog({
  investmentId,
  open,
  onOpenChange,
  preview,
  error,
  loaded,
  onImported,
  onMappingSaved,
}: PropsT) {
  const [pending, startTransition] = useTransition()

  const { confirmDisabled, mismatchedTotals } = evaluateImportGate(preview, loaded, pending)

  function handleConfirm() {
    startTransition(async () => {
      const result = await applyKosztorysImport(investmentId)
      if (!result.success) {
        toastMessage(result.error, 'error', 6000)
        return
      }
      const { sections, items, stages } = result.data
      toastMessage(`Wczytano: ${sections} sekcji · ${items} prac · ${stages} etapów`, 'success')
      onOpenChange(false)
      onImported()
    })
  }

  return (
    <SheetReportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pobierz kosztorys z arkusza Google"
      description="Kosztorys zostanie zastąpiony danymi z arkusza. Stan sprzed pobrania zapisze się automatycznie — wrócisz do niego przez „Wczytaj”."
      loaded={loaded}
      data={preview}
      error={error}
      actions={
        <DialogActions
          confirmLabel="Pobierz i zastąp"
          pending={pending}
          pendingLabel="Pobieram…"
          onConfirm={handleConfirm}
          onCancel={() => onOpenChange(false)}
          confirmDisabled={confirmDisabled}
        />
      }
    >
      {({ problems, report, columns, failure }) =>
        failure ? (
          <SheetAccessBlock failure={failure} />
        ) : problems.length > 0 ? (
          <SheetProblemsBlock
            investmentId={investmentId}
            problems={problems}
            columns={columns}
            consequence="nic nie zostanie nadpisane"
            onMappingSaved={onMappingSaved}
          />
        ) : (
          <>
            <ScopeBlock report={report} />
            <ColumnsBlock
              investmentId={investmentId}
              missing={report.missingColumns}
              columns={columns}
              onMappingSaved={onMappingSaved}
            />
            <SheetRatesBlock mode="import" decisions={report.rateDecisions} />
            <RetainedBlock retained={report.retained} />
            <TotalsBlock totals={report.totals} mismatched={mismatchedTotals} />
          </>
        )
      }
    </SheetReportDialog>
  )
}

// The warnings ride here rather than at the top of the dialog: every one of them („N prac bez
// cennika", „pominięto wiersze nad pierwszą sekcją") is a caveat about the very count beside it.
function ScopeBlock({ report }: { report: ImportReportT }) {
  const { counts, warnings, coeffs } = report
  const adopted = [
    coeffs.wTools === null
      ? null
      : `${PLANE_LABELS.w_tools.toLowerCase()} ${formatCoeff(coeffs.wTools)}`,
    coeffs.ownTools === null
      ? null
      : `${PLANE_LABELS.own_tools.toLowerCase()} ${formatCoeff(coeffs.ownTools)}`,
  ].filter(Boolean)

  return (
    <SheetReportBlock
      title="Co wejdzie"
      status={warnings.length === 0 ? 'ok' : 'warn'}
      verdict={`${counts.sections} sekcji · ${counts.items} prac · ${counts.stages} etapów`}
    >
      {adopted.length > 0 && (
        <p>{`Mnożnik ceny z cennika: ${adopted.join(' · ')} — zastąpi ustawienie inwestycji.`}</p>
      )}
      {warnings.map((warning, index) => (
        <p key={`${index}-${warning}`} className="text-amber-600">
          {warning}
        </p>
      ))}
    </SheetReportBlock>
  )
}

/**
 * Only the columns we could NOT read: a required column is either resolved or the import is refused
 * outright, so the recognised ones say nothing. An absent optional column is the opposite — it is
 * data quietly missing from the kosztorys, and this is the only place it is ever stated.
 */
function ColumnsBlock({
  investmentId,
  missing,
  columns,
  onMappingSaved,
}: {
  investmentId: number
  missing: ImportReportT['missingColumns']
  columns: UnresolvedColumnsT
  onMappingSaved: () => void
}) {
  // A column the owner pointed at is not a shortfall — it renders as a note inside this block, so it
  // must not turn a complete read yellow.
  const clean = missing.length === 0
  if (clean) {
    return null
  }
  return (
    <SheetReportBlock
      title="Czego nie odczytaliśmy z arkusza Google"
      status="warn"
      verdict={`Brakuje ${missing.length} ${columnNoun(missing.length)}. Pobranie jest nadal możliwe — poniżej, czego zabraknie w kosztorysie.`}
    >
      <ReportTable headers={['Kolumna', 'Dlaczego', 'Skutek']}>
        {missing.map((column) => (
          <ReportRow
            key={column.label}
            label={`„${column.label}"`}
            cells={[
              { content: MISSING_COLUMN_REASONS[column.reason], tone: 'text-muted-foreground' },
              { content: column.consequence, tone: 'text-amber-600' },
            ]}
          />
        ))}
      </ReportTable>
      <SheetColumnPicker
        investmentId={investmentId}
        missing={missing.map((column) => column.field)}
        pointed={columns.pointedFields}
        candidates={columns.candidates}
        onSaved={onMappingSaved}
      />
    </SheetReportBlock>
  )
}

function RetainedBlock({ retained }: { retained: ImportReportT['retained'] }) {
  const clean = retained.length === 0
  return (
    <SheetReportBlock
      title="Prace, których nie ma w arkuszu Google"
      status={clean ? 'ok' : 'warn'}
      verdict={
        clean
          ? 'Każda praca z kosztorysu jest też w arkuszu.'
          : `${retained.length} ${itemNoun(retained.length)} zostanie zachowanych — nic nie jest usuwane. Jeśli jest ich nieoczekiwanie dużo, sprawdź, czy w arkuszu nie zmieniła się nazwa sekcji.`
      }
    >
      {!clean && (
        <ReportFold summary={`Zobacz, które prace zostaną (${retained.length})`}>
          <ItemList items={retained} />
        </ReportFold>
      )}
    </SheetReportBlock>
  )
}

/**
 * Two summary rows, two different meanings when one of them disagrees — and only the first is a
 * doubt about the read. „wartość netto" faces our own pricing of the same column, so a difference
 * there says we misread a cena or a rabat. „R netto" faces the etapy, which the import is about to
 * replace: a difference there is the two sides holding different progress, not a fault in either.
 */
function TotalsBlock({
  totals,
  mismatched,
}: {
  totals: ImportReportT['totals']
  mismatched: FooterComparisonT[]
}) {
  return (
    <SheetReportBlock
      title="Porównanie sum"
      status={mismatched.length === 0 ? 'ok' : 'warn'}
      verdict={totalsVerdict(mismatched)}
    >
      <ComparisonTable>
        {totals.map((total) => (
          <ComparisonRow
            key={total.key}
            label={total.label}
            sheet={
              total.sheetValue === null ? (
                <span className="text-muted-foreground">nie znaleziono</span>
              ) : (
                formatPLN(total.sheetValue)
              )
            }
            app={formatPLN(total.appValue)}
            delta={total.delta === null || total.matches ? null : formatPLN(total.delta)}
          />
        ))}
      </ComparisonTable>
    </SheetReportBlock>
  )
}

/**
 * „wartość netto" first: it is the only one of the two that doubts the read itself, and a wrong cena
 * makes every other figure in the dialog wrong too. A difference on „R netto" is not a fault at all —
 * it is the two sides holding different etapy, which is precisely what the import replaces. A stale
 * SUM in the owner's own footer is common enough that blocking on any of this would make the button
 * useless exactly where it is needed, so neither line stops the import.
 */
function totalsVerdict(mismatched: FooterComparisonT[]): string {
  if (mismatched.some((total) => total.key === 'plannedNet'))
    return 'Nasz odczyt prac nie daje sumy, którą arkusz Google ma w podsumowaniu — sprawdź ceny i rabaty. Pobranie jest nadal możliwe.'
  if (mismatched.some((total) => total.key === 'executedNet'))
    return 'Arkusz Google i ta aplikacja mają rozpisane różne etapy — to właśnie tę różnicę pobranie zastąpi danymi z arkusza.'
  return 'Podsumowanie arkusza Google zgadza się z tym, co policzyliśmy z jego prac.'
}
