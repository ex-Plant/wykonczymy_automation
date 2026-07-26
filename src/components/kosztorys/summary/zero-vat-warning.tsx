import { WarningBanner } from '@/components/ui/warning-banner'

// A 0% investment makes the whole netto/brutto axis a no-op — every figure grosses to itself, so the
// Netto/Brutto/Mieszane pick silently does nothing and the panel reads as broken rather than as
// VAT-free. Loud on purpose: this is the one state where "nothing happens" is correct behaviour, and
// it has already cost a bug hunt. It sits beside the axis select — the pinned control the reader is
// actually clicking when nothing moves — rather than by the VAT field, which is one tab deep.
export function ZeroVatWarning() {
  return (
    <WarningBanner>
      VAT 0% — brutto = netto. Przełącznik netto/brutto nic nie zmieni, dopóki nie ustawisz stawki
      VAT.
    </WarningBanner>
  )
}
