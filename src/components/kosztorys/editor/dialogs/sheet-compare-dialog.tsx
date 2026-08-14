'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import type { SheetCompareResultT } from '@/lib/actions/kosztorys-import'
import type {
  ComparedItemT,
  ExecutedDiffT,
  SheetComparisonT,
} from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import type { FormulaSampleT } from '@/lib/kosztorys/sheet-import/formula-health'
import { formatPLN } from '@/lib/utils/format-currency'
import { pluralize } from '@/lib/utils/polish-plural'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: SheetCompareResultT | null
  loaded: boolean
}

const SHEET_SIDE = 'Arkusz Google'
const APP_SIDE = 'Ta aplikacja'

const prace = (count: number) => pluralize(count, ['pozycja', 'pozycje', 'pozycji'])
const pozycjeMa = (count: number) => pluralize(count, ['pozycja ma', 'pozycje mają', 'pozycji ma'])
// Locative — „w 1 pozycji", „w 2 pozycjach", „w 5 pozycjach". The nominative forms above read wrong
// after „w".
const pozycjachW = (count: number) => pluralize(count, ['pozycji', 'pozycjach', 'pozycjach'])

const MATCHES = 0.005

/**
 * „Porównaj z arkuszem" — a live read of the sheet against the stored kosztorys, which also pulls the
 * sheet's Pomiar onto the stored reference figure. Renders a record it does not compute: everything
 * here comes from the action, fetched by the parent on the click (a programmatically-opened Radix
 * dialog never fires `onOpenChange`, so it cannot fetch itself).
 *
 * Answers three questions in order — do the two sides agree on the money, do they hold the same
 * prace, and where did our reading of the sheet have to differ from what it shows. The refresh it
 * performs on the way is deliberately not reported: nobody opens this to learn what got written.
 */
export function SheetCompareDialog({ open, onOpenChange, result, loaded }: PropsT) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader
          title="Porównaj z arkuszem Google"
          description="Czy arkusz Google i ta aplikacja liczą to samo — i gdzie się rozjeżdżają."
        />

        {!loaded ? (
          <p className="text-muted-foreground text-sm">Czytam arkusz Google…</p>
        ) : !result ? (
          <p className="text-destructive text-sm">Nie udało się odczytać arkusza Google.</p>
        ) : (
          <div className="space-y-5 text-sm">
            <MoneyBlock comparison={result.comparison} />
            <ItemsBlock comparison={result.comparison} />
            <ReadingBlock comparison={result.comparison} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Only the executed work is compared. The offered scope reads the same column on both sides, so it
 * can disagree only when a praca is missing altogether — which the „Pozycje" block already says,
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
  const sheetMeasured = footer.find((total) => total.key === 'plannedNet')?.sheetValue ?? null
  const sheetExecuted = footer.find((total) => total.key === 'executedNet')?.sheetValue ?? null
  const footerDelta = sheetExecuted === null ? null : sheetExecuted - totals.executedNetFromSheet
  const unassignedInSheet =
    sheetMeasured === null || sheetExecuted === null ? null : sheetMeasured - sheetExecuted
  const unassignedHere = sheetMeasured === null ? null : sheetMeasured - totals.executedNetFromApp

  return (
    <SheetReportBlock
      title="Kwoty"
      status={agree ? 'ok' : 'warn'}
      verdict={
        agree
          ? 'Obie strony policzyły tyle samo prac wykonanych.'
          : executed < 0
            ? `Tutaj rozpisano na etapy o ${formatPLN(-executed)} więcej pracy niż w arkuszu Google.`
            : `W arkuszu Google rozpisano na etapy o ${formatPLN(executed)} więcej pracy niż tutaj.`
      }
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
          własnych pozycji.
        </p>
      )}
    </SheetReportBlock>
  )
}

function ItemsBlock({ comparison }: { comparison: SheetComparisonT }) {
  const { counts, onlyInSheet, onlyInApp } = comparison
  const agree = onlyInSheet.length === 0 && onlyInApp.length === 0

  return (
    <SheetReportBlock
      title="Pozycje"
      status={agree ? 'ok' : 'warn'}
      verdict={
        agree
          ? `Obie strony mają te same ${counts.matched} ${prace(counts.matched)}.`
          : `${counts.matched} ${prace(counts.matched)} jest po obu stronach. Reszta istnieje tylko po jednej — a skoro kwoty liczą się z pozycji, to zwykle tu leży różnica.`
      }
    >
      {!agree && (
        <>
          <ComparisonTable>
            <ComparisonRow
              label="Ile pozycji w ogóle"
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
            Pozycje kojarzymy po nazwie sekcji i opisie, bo arkusz Google nie ma identyfikatorów.
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
            summary={`${health.errorValues} ${pozycjeMa(health.errorValues)} w miejscu kwoty wartość błędu (#REF!, #DIV/0!) — nie ma tam liczby, więc czytamy zero.`}
            samples={health.samples.errorValue}
            link={sheetLink}
            tone="text-destructive"
          />
          <SampleList
            summary={`${health.plannedReadFromStage} ${pozycjeMa(health.plannedReadFromStage)} Przedmiar policzony z etapu. U nas Przedmiar to osobna liczba, wpisywana ręcznie — nie zmieni się, kiedy zmienisz etap.`}
            samples={health.samples.plannedReadFromStage}
            link={sheetLink}
          />
          <SampleList
            summary={`W ${health.measuredCopiedFromPlanned} z ${health.totalRows} pozycji Pomiar z natury wskazuje na Przedmiar. U nas pomiar to zawsze suma etapów.`}
            samples={health.samples.measuredCopiedFromPlanned}
            link={sheetLink}
          />
        </>
      )}
    </SheetReportBlock>
  )
}

// Which side said what is the one thing the reader must never have to infer — hence named columns
// rather than a sentence with two numbers in it.
function ComparisonTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-xs">
            <th className="py-1 text-left font-normal" />
            <th className="py-1 pl-3 text-right font-normal">{SHEET_SIDE}</th>
            <th className="py-1 pl-3 text-right font-normal">{APP_SIDE}</th>
            <th className="py-1 pl-3 text-right font-normal">Różnica</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function ComparisonRow({
  label,
  sheet,
  app,
  delta,
}: {
  label: React.ReactNode
  sheet: string
  app: string
  delta: string | null
}) {
  return (
    <tr className="border-border/60 border-t">
      <td className="py-1">{label}</td>
      <td className="py-1 pl-3 text-right tabular-nums">{sheet}</td>
      <td className="py-1 pl-3 text-right tabular-nums">{app}</td>
      <td
        className={`py-1 pl-3 text-right tabular-nums ${delta === null ? 'text-muted-foreground' : 'text-amber-600'}`}
      >
        {delta ?? 'zgadza się'}
      </td>
    </tr>
  )
}

// The count belongs in the summary line, the rows behind a click: a class can run to hundreds of
// prace, and unfolded it would bury every other line in the block.
function SampleList({
  summary,
  samples,
  link,
  tone = 'text-amber-600',
}: {
  summary: string
  samples: FormulaSampleT[]
  link: SheetComparisonT['sheetLink']
  tone?: string
}) {
  const [open, setOpen] = useState(false)
  if (samples.length === 0) return null
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="space-y-0.5">
      <Collapsible.Trigger className="flex w-full cursor-pointer items-start gap-1 text-left">
        <ChevronDown
          className={`mt-1 size-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${tone}`}
        />
        <span className={tone}>{summary}</span>
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        <div className="space-y-0.5 pl-4.5">
          {samples.map((sample) => (
            <p key={sample.cell} className="text-muted-foreground text-xs">
              <SheetCellLink cell={sample.cell} link={link} /> · {sample.description}
            </p>
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
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
  const [open, setOpen] = useState(false)
  if (diffs.length === 0) return null
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="space-y-0.5">
      <Collapsible.Trigger className="flex w-full cursor-pointer items-start gap-1 text-left">
        <ChevronDown
          className={`mt-1 size-3.5 shrink-0 text-amber-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
        <span className="text-amber-600">
          Różnica siedzi w {diffs.length} {pozycjachW(diffs.length)} — zobacz w których.
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        <div className="pl-4.5">
          <ComparisonTable>
            {diffs.map((diff) => (
              <ComparisonRow
                key={diff.cell}
                label={
                  <>
                    <SheetCellLink cell={diff.cell} link={link} /> · {diff.section} ·{' '}
                    {diff.description}
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
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

const formatQty = (qty: number) => qty.toLocaleString('pl-PL', { maximumFractionDigits: 3 })

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
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="space-y-0.5">
      <Collapsible.Trigger className="flex w-full cursor-pointer items-start gap-1 text-left">
        <ChevronDown
          className={`text-muted-foreground mt-0.5 size-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
        <span className="text-xs font-medium">
          {label} ({items.length})
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        <div className="space-y-0.5 pl-4.5">
          {items.map((item, index) => (
            <p key={`${index}-${item.description}`} className="text-muted-foreground text-xs">
              {item.section} · {item.description}
            </p>
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
