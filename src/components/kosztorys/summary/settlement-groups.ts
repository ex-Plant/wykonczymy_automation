import {
  faceValue,
  type MixedSettlementT,
  type MoneyPairT,
} from '@/lib/kosztorys/summary-economics'
import { ratePercentText } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { SettlementRowT } from '@/components/kosztorys/summary/tables/summary-totals-table'

// A settlement tor rendered as one table. `axis` is the table's own — the steps run on one plane
// („Kwota"), while the closing „Do zapłaty" runs on both, because the same debt genuinely reads two
// ways and the reader is meant to compare them side by side rather than down a column.
export type SettlementGroupT = { caption?: string; axis: MoneyAxisT; rows: SettlementRowT[] }

type ArgsT = {
  mixed: MixedSettlementT | null
  doZaplaty: MoneyPairT
  wplatyNet: number
  vatRate: number
  filtersActive: boolean
}

// The settlement steps under the breakdown, as one group per tor. Their sequence IS the tryb
// rozliczenia, which is why this is a view-model rather than table props: mieszany resolves through a
// reszta the other tryby don't have, so the two shapes share no row.
//
// Both tory open with their wpłaty, so the two read the same way down the page rather than mirroring
// each other. Wpłaty render negative — they are the deduction steps down to „Do zapłaty", and a
// positive figure in a subtracted row reads as if it were being added.
export function buildSettlementGroups({
  mixed,
  doZaplaty,
  wplatyNet,
  vatRate,
  filtersActive,
}: ArgsT): SettlementGroupT[] {
  // One pool of wpłaty, one debt — one table. Wpłaty span both money tracks as a single centred cell
  // (they carry no VAT, so they come off both axes at the same złoty) and „Pozostało do zapłaty"
  // resolves underneath on each plane. Stacked as two labelled rows in one column, the same debt read
  // twice used to look like two separate debts.
  if (!mixed) {
    return [
      {
        axis: 'both',
        rows: [
          {
            label: 'Wpłaty',
            line: faceValue(-wplatyNet),
            discount: true,
            linkToDeposits: true,
            span: true,
          },
          {
            label: 'Pozostało do zapłaty',
            line: doZaplaty,
            bold: true,
            // Per cell: netto and brutto cross zero independently, so a slightly overpaid netto can
            // sit beside a real outstanding brutto.
            danger: { net: doZaplaty.net > 0, gross: doZaplaty.gross > 0 },
            scopeMarked: filtersActive,
          },
        ],
      },
    ]
  }

  // Mieszany resolves through a reszta: the cash part closes on the netto plane, only what is left
  // crosses onto the invoice, and „Do zapłaty netto" is that same debt read back without a faktura.
  // Each tor closes on ONE plane here, so neither gets the two-column treatment — a second column
  // would print a figure that tor never settles.
  const vatPercent = ratePercentText(vatRate)
  return [
    {
      caption: 'Rozliczenie netto',
      axis: 'net',
      rows: [
        {
          label: 'Wpłaty netto',
          line: faceValue(-mixed.paidNet),
          discount: true,
          linkToDeposits: true,
        },
        {
          label: 'Pozostało netto',
          hint: '*Łącznie netto minus wpłaty netto',
          line: faceValue(mixed.doRozliczeniaNet),
          scopeMarked: filtersActive,
        },
        {
          label: 'Do zapłaty netto',
          hint: '*Pozostało netto minus wpłaty brutto — tyle zostaje do zapłaty w przypadku rozliczenia reszty netto',
          line: faceValue(mixed.doZaplatyNet),
          bold: true,
          // Deliberately not `danger`, unlike its brutto twin (owner, 2026-08-07): this is the same
          // debt read back without a faktura, not a second one owed on top. Two red closing figures
          // one under the other read as two debts — and this one deducts the OTHER tor's wpłaty, so
          // it can't be reconciled against the rows above it either.
          scopeMarked: filtersActive,
        },
      ],
    },
    {
      caption: 'Rozliczenie fakturą',
      axis: 'net',
      rows: [
        {
          label: 'Wpłaty brutto',
          line: faceValue(-mixed.paidGross),
          discount: true,
          linkToDeposits: true,
        },
        {
          label: 'Pozostało brutto',
          hint: `*Łącznie brutto (VAT ${vatPercent}% na robociznę) minus wpłaty netto`,
          line: faceValue(mixed.resztaGross),
          scopeMarked: filtersActive,
        },
        {
          label: 'Do zapłaty brutto',
          hint: '*Pozostało brutto minus wpłaty brutto — tyle zostaje do zapłaty w przypadku rozliczenia reszty brutto',
          line: faceValue(mixed.doZaplatyGross),
          bold: true,
          danger: mixed.doZaplatyGross > 0,
          scopeMarked: filtersActive,
        },
      ],
    },
  ]
}
