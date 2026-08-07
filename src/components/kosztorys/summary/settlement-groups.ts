import type { MixedSettlementT, MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { SettlementRowT } from '@/components/kosztorys/summary/tables/summary-totals-table'

// A settlement tor rendered as one table (see `SettlementRowT` for why a tor is single-plane).
// Mieszany has two: the cash side and the invoice side.
export type SettlementGroupT = { caption?: string; rows: SettlementRowT[] }

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
// Wpłaty render negative — they are the deduction steps down to „Do zapłaty", and a positive figure in
// a subtracted row reads as if it were being added.
export function buildSettlementGroups({
  mixed,
  doZaplaty,
  wplatyNet,
  vatRate,
  filtersActive,
}: ArgsT): SettlementGroupT[] {
  // One pool of wpłaty, one debt, shown on both planes.
  if (!mixed) {
    return [
      {
        rows: [
          { label: 'Wpłaty', amount: -wplatyNet, discount: true, linkToDeposits: true },
          {
            label: 'Do zapłaty netto',
            amount: doZaplaty.net,
            bold: true,
            danger: doZaplaty.net > 0,
            scopeMarked: filtersActive,
          },
          {
            label: 'Do zapłaty brutto',
            amount: doZaplaty.gross,
            bold: true,
            danger: doZaplaty.gross > 0,
            scopeMarked: filtersActive,
          },
        ],
      },
    ]
  }

  // Mieszany resolves through a reszta: the cash part closes on the netto plane, only what is left
  // crosses onto the invoice, and „Do zapłaty netto" is that same debt read back without a faktura.
  const vatPercent = Math.round(vatRate * 100)
  return [
    {
      caption: 'Rozliczenie netto',
      rows: [
        { label: 'Wpłaty netto', amount: -mixed.paidNet, discount: true, linkToDeposits: true },
        {
          label: 'Pozostało netto',
          hint: 'Łącznie netto − wpłaty netto',
          amount: mixed.doRozliczeniaNet,
          scopeMarked: filtersActive,
        },
        {
          label: 'Do zapłaty netto',
          hint: 'Pozostało netto − wpłaty brutto bez VAT — kwota zamykająca rozliczenie bez faktury',
          amount: mixed.doZaplatyNet,
          bold: true,
          danger: mixed.doZaplatyNet > 0,
          scopeMarked: filtersActive,
        },
      ],
    },
    {
      caption: 'Rozliczenie fakturą',
      rows: [
        {
          label: 'Pozostało brutto',
          hint: `Pozostało netto + VAT ${vatPercent}%`,
          amount: mixed.resztaGross,
          scopeMarked: filtersActive,
        },
        { label: 'Wpłaty brutto', amount: -mixed.paidGross, discount: true, linkToDeposits: true },
        {
          label: 'Do zapłaty brutto',
          hint: 'Pozostało brutto − wpłaty brutto',
          amount: mixed.doZaplatyGross,
          bold: true,
          danger: mixed.doZaplatyGross > 0,
          scopeMarked: filtersActive,
        },
      ],
    },
  ]
}
