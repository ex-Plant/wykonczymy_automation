'use client'

import { useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { evaluateImportGate } from '@/components/kosztorys/editor/dialogs/sheet-import-gate'
import { applyKosztorysImport, type ImportPreviewT } from '@/lib/actions/kosztorys-import'
import type { ReportedRateKindT } from '@/lib/kosztorys/sheet-import/resolve-rates'
import { formatPLN } from '@/lib/utils/format-currency'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: ImportPreviewT | null
  loaded: boolean
  onImported: () => void
}

const RATE_DECISION_LABELS: Record<ReportedRateKindT, string> = {
  single: 'tylko w jednym cenniku',
  auto: 'rozbieżność — wzięto wpisaną ręcznie',
  conflict: 'rozbieżność do sprawdzenia',
}

// „Pobierz z arkusza Google…" — what the import would do, before it does it. The confirm re-derives
// everything server-side, so nothing rendered here is trusted on the way back.
export function SheetImportDialog({
  investmentId,
  open,
  onOpenChange,
  preview,
  loaded,
  onImported,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader
          title="Pobierz kosztorys z arkusza Google"
          description="Kosztorys zostanie zastąpiony danymi z arkusza. Stan sprzed pobrania zapisze się automatycznie — wrócisz do niego przez „Wczytaj”."
        />

        {!loaded ? (
          <p className="text-muted-foreground text-sm">Czytam arkusz…</p>
        ) : !preview ? (
          <p className="text-destructive text-sm">Nie udało się odczytać arkusza.</p>
        ) : (
          <div className="space-y-4 text-sm">
            {preview.problems.length > 0 && (
              <Block title="Nie mogę odczytać arkusza">
                {preview.problems.map((problem) => (
                  <p key={problem} className="text-destructive">
                    {problem}
                  </p>
                ))}
              </Block>
            )}

            {preview.report.warnings.map((warning, index) => (
              <p key={`${index}-${warning}`} className="text-amber-600">
                {warning}
              </p>
            ))}

            {preview.problems.length === 0 && (
              <>
                <Block title="Rozpoznane kolumny">
                  {preview.report.columns.map((column, index) => (
                    <p key={index} className="text-muted-foreground text-xs">
                      {column.field} → kolumna {column.column} („{column.header}”) w zakładce{' '}
                      {column.tab}
                    </p>
                  ))}
                </Block>

                <Block title="Co wejdzie">
                  <p className="text-muted-foreground">
                    {preview.report.counts.sections} sekcji · {preview.report.counts.items} prac ·{' '}
                    {preview.report.counts.stages} etapów
                  </p>
                </Block>

                {preview.report.rateDecisions.length > 0 && (
                  // Listed one by one, never collapsed to a count: each line is a price the two
                  // cenniki disagreed about, and the owner is the only one who can say which is right.
                  <Block title={`Rozstrzygnięcia stawek (${preview.report.rateDecisions.length})`}>
                    {preview.report.rateDecisions.map((rate, index) => (
                      <p
                        key={`${index}-${rate.description}`}
                        className="text-muted-foreground text-xs"
                      >
                        {rate.description} — {formatPLN(rate.wToolsRate)} /{' '}
                        {formatPLN(rate.ownToolsRate)} · {RATE_DECISION_LABELS[rate.kind]}
                        {rate.rejected
                          ? ` (pominięto ${formatPLN(rate.rejected.wToolsRate)} z „${rate.rejected.tab}”)`
                          : ''}
                      </p>
                    ))}
                  </Block>
                )}

                {preview.report.retained.length > 0 && (
                  <Block
                    title={`Prace, których nie ma w arkuszu (${preview.report.retained.length})`}
                  >
                    <p className="text-muted-foreground text-xs">
                      Zostaną zachowane — nic nie jest usuwane. Jeśli jest ich nieoczekiwanie dużo,
                      sprawdź, czy w arkuszu nie zmieniła się nazwa sekcji.
                    </p>
                    {preview.report.retained.map((item, index) => (
                      <p key={index} className="text-muted-foreground text-xs">
                        {item.section} · {item.description}
                      </p>
                    ))}
                  </Block>
                )}

                <Block title="Porównanie sum">
                  {preview.report.totals.map((total) => (
                    <p
                      key={total.key}
                      className={
                        total.sheetValue !== null && !total.matches
                          ? 'text-xs text-amber-600'
                          : 'text-muted-foreground text-xs'
                      }
                    >
                      {total.label}: arkusz{' '}
                      {total.sheetValue === null ? 'nie znaleziono' : formatPLN(total.sheetValue)} ·
                      aplikacja {formatPLN(total.appValue)}
                      {total.delta === null ? '' : ` · różnica ${formatPLN(total.delta)}`}
                    </p>
                  ))}
                  {mismatchedTotals.length > 0 && (
                    // A stale SUM in the owner's own footer is common enough that blocking on it
                    // would make the button useless exactly where it is needed.
                    <p className="text-amber-600">
                      Sumy się nie zgadzają — sprawdź arkusz. Pobranie jest nadal możliwe.
                    </p>
                  )}
                </Block>
              </>
            )}
          </div>
        )}

        <DialogActions
          confirmLabel="Pobierz i zastąp"
          pending={pending}
          pendingLabel="Pobieram…"
          onConfirm={handleConfirm}
          onCancel={() => onOpenChange(false)}
          confirmDisabled={confirmDisabled}
        />
      </DialogContent>
    </Dialog>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  )
}
