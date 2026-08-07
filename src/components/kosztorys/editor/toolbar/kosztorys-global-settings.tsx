'use client'

import { DecimalField } from '@/components/ui/decimal-field'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import { MAX_CLIENT_SHARE } from '@/lib/kosztorys/subcontractor-price-guard'

// Sourced from the constant rather than typed as „0,8": a hardcoded ceiling here would drift from
// the rule the cells enforce, and the field would promise a limit it no longer has.
const COEFF_DESCRIPTION = [
  'Cena wykonawcy = cena klienta × mnożnik.',
  '0,65 = wykonawca dostaje 65% ceny klienta.',
  'Dziedziczą go pozycje ze źródłem ceny „auto".',
  `Maksymalnie ${MAX_CLIENT_SHARE.toLocaleString('pl-PL')} — wyżej wykonawca zjada marżę.`,
].join('\n')

type PropsT = {
  globalCoeffs: { wTools: number; ownTools: number }
  onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void
}

export function KosztorysGlobalSettings({ globalCoeffs, onGlobalCoeffChange }: PropsT) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        Mnożnik ceny:
        <InfoTooltip content={COEFF_DESCRIPTION} label="Więcej o: mnożnik ceny" />
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <DecimalField
          label={
            <span className="inline-flex items-center gap-1">
              {planeIcon('w_tools', 'size-3.5')}
              {PLANE_LABELS.w_tools}
            </span>
          }
          value={globalCoeffs.wTools}
          min={0}
          max={MAX_CLIENT_SHARE}
          onCommit={(n) => onGlobalCoeffChange({ wToolsCoeff: n })}
        />
        <DecimalField
          label={
            <span className="inline-flex items-center gap-1">
              {planeIcon('own_tools', 'size-3.5')}
              {PLANE_LABELS.own_tools}
            </span>
          }
          value={globalCoeffs.ownTools}
          min={0}
          max={MAX_CLIENT_SHARE}
          onCommit={(n) => onGlobalCoeffChange({ ownToolsCoeff: n })}
        />
      </div>
    </div>
  )
}
