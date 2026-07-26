'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { DecimalField } from '@/components/ui/decimal-field'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PercentRabatTool } from '@/components/kosztorys/summary/percent-rabat-tool'
import { Description } from '@/components/ui/description'
import { HintTooltip } from '@/components/ui/tooltip'

const VAT_TIP = [
  'Stawka VAT dla całej inwestycji.',
  'Ceny wpisujesz netto — Brutto i Suma brutto liczą się z tej stawki.',
].join('\n')

const DISCOUNT_TIP = [
  'Kwotowy: odejmuje się raz od sumy wykonanych prac (kwota netto), nadpisuje rabaty per pozycja — ich kolumny znikają.',
  '%: jednorazowo wpisuje ten sam % w rabat KAŻDEJ pozycji (nadpisuje istniejące).',
].join('\n')

type ModeT = 'amount' | 'percent'

const MODE_OPTIONS: OptionT<ModeT>[] = [
  { value: 'amount', label: 'Kwotowy' },
  { value: 'percent', label: '%' },
]

const MODE_DESCRIPTION: Record<ModeT, string> = {
  amount:
    'Kwota netto odejmowana raz od sumy wykonanych prac. Nie łączy się z rabatami per pozycja - zastępuje je.',
  percent: 'Jednorazowo wpisuje ten sam % w rabat każdej pozycji, nadpisując istniejące.',
}

// Rabat is a client concession only (calc.ts netForQtyForView) — it never reaches the subcontractor
// views, so their prices stay whatever the plane sets.
const RABAT_SUBCONTRACTOR_NOTE = 'Rabat nie wpływa na ceny podwykonawców.'

// VAT + rabat, lifted out of the toolbar to sit at the top of the Podsumowanie tab. Reads the setters
// straight from the editor context (the panel renders inside the provider), so no props thread through
// KosztorysTotalsPanel.
export function SummarySettingsBar() {
  const {
    tree,
    globalDiscount,
    handleVatChange,
    handleGlobalDiscountChange,
    handleApplyPercentRabat,
  } = useKosztorysEditorContext()

  const [enabled, setEnabled] = useState(globalDiscount.type != null)
  // Percent leaves no stored footprint, so the selected mode can't be derived from globalDiscount —
  // it lives in local state. A stored amount discount seeds the group onto „Kwotowy".
  const [mode, setMode] = useState<ModeT>('amount')

  function toggleEnabled(on: boolean) {
    setEnabled(on)
    // Turning the panel off clears any stored amount discount; percent has nothing to clear.
    if (!on && globalDiscount.type != null) handleGlobalDiscountChange({ type: null, value: 0 })
  }

  function changeMode(next: ModeT) {
    setMode(next)
    // Amount is the only stored mode; leaving it (→ „%") clears the stored discount so the two never
    // coexist. That mutual exclusion is what keeps the percent one-shot always effective.
    if (next === 'percent' && globalDiscount.type != null)
      handleGlobalDiscountChange({ type: null, value: 0 })
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {/* VAT is stored as a fraction but entered as a percent: show ×100, commit ÷100. */}
      <DecimalField
        label="VAT %"
        hint={VAT_TIP}
        value={tree.vatRate * 100}
        valueClassName="text-foreground"
        min={0}
        max={100}
        onCommit={(n) => handleVatChange(n / 100)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2">
          <Checkbox checked={enabled} onCheckedChange={(c) => toggleEnabled(c === true)} />
          <HintTooltip content={DISCOUNT_TIP} className="text-muted-foreground text-xs">
            Zastosuj rabat globalny
          </HintTooltip>
        </label>
        {enabled && (
          <>
            <ToggleGroup
              options={MODE_OPTIONS}
              value={mode}
              onChange={changeMode}
              aria-label="Tryb rabatu globalnego"
            />
            {mode === 'amount' ? (
              <DecimalField
                label=""
                value={globalDiscount.value}
                valueClassName="text-chart-green"
                min={0}
                onCommit={(n) => handleGlobalDiscountChange({ type: 'amount', value: n })}
              />
            ) : (
              <PercentRabatTool onApply={handleApplyPercentRabat} />
            )}
          </>
        )}
      </div>
      {enabled && (
        <Description size="xs" className="max-w-md">
          {MODE_DESCRIPTION[mode]} {RABAT_SUBCONTRACTOR_NOTE}
        </Description>
      )}
    </div>
  )
}
