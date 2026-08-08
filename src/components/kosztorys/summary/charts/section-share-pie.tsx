'use client'

import { useState } from 'react'
import {
  sectionPieSlices,
  type SectionPieBaseT,
  type SectionSliceInputT,
} from '@/lib/kosztorys/chart-slices'
import { SlicePie } from '@/components/ui/slice-pie'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { formatNet } from '@/lib/kosztorys/format'

const BASES: OptionT<SectionPieBaseT>[] = [
  { value: 'przedmiar', label: 'Przedmiar' },
  { value: 'wykonane', label: 'Wykonane' },
]

// Sekcje as a share-of-whole pie, with a live Przedmiar ↔ Wykonane base toggle. Fed the client-priced,
// view-invariant subtotals so switching base is a source-selection, never a re-calculation.
export function SectionSharePie({ subtotals }: { subtotals: SectionSliceInputT[] }) {
  const [base, setBase] = useState<SectionPieBaseT>('przedmiar')

  return (
    <SlicePie
      caption="Udział sekcji w kosztach robocizny"
      action={
        <ToggleGroup
          options={BASES}
          value={base}
          onChange={setBase}
          aria-label="Podstawa udziału sekcji"
        />
      }
      slices={sectionPieSlices(subtotals, base)}
      formatValue={formatNet}
    />
  )
}
