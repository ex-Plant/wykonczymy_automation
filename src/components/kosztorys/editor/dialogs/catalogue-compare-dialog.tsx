'use client'

import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import { SheetReportDialog } from '@/components/kosztorys/editor/dialogs/sheet-report-dialog'
import {
  ComparisonRow,
  ComparisonTable,
  ItemList,
  ReportFold,
} from '@/components/kosztorys/editor/dialogs/sheet-report-parts'
import {
  diffsVerdict,
  matchingVerdict,
  missingVerdict,
} from '@/components/kosztorys/editor/dialogs/catalogue-compare-words'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { formatPLN } from '@/lib/utils/format-currency'

/**
 * „Porównaj z katalogiem" — the rozpiska read against the global cennik. Renders a record it does not
 * compute (the action does), and writes nothing: unlike the arkusz window this one has no refresh
 * side, so nothing here can change a figure the owner is looking at.
 */
export function CatalogueCompareDialog() {
  const {
    open,
    setOpen: onOpenChange,
    result,
    error,
    loaded,
  } = useKosztorysActions().catalogueCompare

  return (
    <SheetReportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Porównaj z katalogiem prac"
      description="Gdzie ceny i stawki tego kosztorysu odbiegają od katalogu — i czego w katalogu jeszcze nie ma."
      loadingText="Porównuję z katalogiem…"
      loaded={loaded}
      data={result}
      error={error}
    >
      {({ matching, diffs, missing }) => (
        <>
          <SheetReportBlock
            title="Zgodne z katalogiem"
            status={matching > 0 ? 'ok' : 'warn'}
            verdict={matchingVerdict(matching)}
          />

          <SheetReportBlock
            title="Inne liczby niż w katalogu"
            status={diffs.length === 0 ? 'ok' : 'warn'}
            verdict={diffsVerdict(diffs.length)}
          >
            {diffs.length > 0 && (
              <ReportFold summary={`Pokaż ${diffs.length} poz.`}>
                <ComparisonTable sides={['Kosztorys', 'Katalog']}>
                  {diffs.flatMap((diff) =>
                    diff.figures.map((figure) => (
                      <ComparisonRow
                        key={`${diff.itemId}-${figure.label}`}
                        label={`${diff.description} — ${figure.label}`}
                        sheet={formatPLN(figure.kosztorys)}
                        app={formatPLN(figure.catalogue)}
                        delta={formatPLN(figure.delta)}
                      />
                    )),
                  )}
                </ComparisonTable>
              </ReportFold>
            )}
          </SheetReportBlock>

          <SheetReportBlock
            title="Brak w katalogu"
            status={missing.length === 0 ? 'ok' : 'warn'}
            verdict={missingVerdict(missing.length)}
          >
            {missing.length > 0 && (
              <ReportFold summary={`Pokaż ${missing.length} poz.`}>
                <ItemList
                  items={missing.map((row) => ({
                    section: row.section,
                    description: `${row.description} (${row.unit || 'bez j.m.'})`,
                    // A guess about NAMES, offered as one — nothing here actually matched.
                    note: row.hint ? `może chodzi o „${row.hint}"` : undefined,
                  }))}
                />
              </ReportFold>
            )}
          </SheetReportBlock>
        </>
      )}
    </SheetReportDialog>
  )
}
