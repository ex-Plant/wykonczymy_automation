'use client'

import { DecimalField } from '@/components/ui/decimal-field'
import { Description } from '@/components/ui/description'
import { planeIcon, PLANE_LABELS } from '@/components/kosztorys/editor/plane-icons'

const COEFF_DESCRIPTION = [
  'Cena wykonawcy = cena klienta × mnożnik.',
  '0,65 = wykonawca dostaje 65% ceny klienta.',
  'Dziedziczą go pozycje ze źródłem ceny „auto".',
].join('\n')

type PropsT = {
  globalCoeffs: { wTools: number; ownTools: number }
  onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void
}

export function KosztorysGlobalSettings({ globalCoeffs, onGlobalCoeffChange }: PropsT) {
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs font-medium">Mnożnik ceny:</p>
        <DecimalField
          label={
            <span className="inline-flex items-center gap-1">
              {planeIcon('w_tools', 'size-3.5')}
              {PLANE_LABELS.w_tools}
            </span>
          }
          value={globalCoeffs.wTools}
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
          onCommit={(n) => onGlobalCoeffChange({ ownToolsCoeff: n })}
        />
      </div>
      <Description size="xs" className="w-fit whitespace-pre-line">
        {COEFF_DESCRIPTION}
      </Description>
    </div>
  )
}
