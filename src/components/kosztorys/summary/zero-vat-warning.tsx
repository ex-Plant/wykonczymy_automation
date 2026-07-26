import { TriangleAlert } from 'lucide-react'

// A 0% investment makes the whole netto/brutto axis a no-op — every figure grosses to itself, so the
// Netto/Brutto/Mieszane pick silently does nothing and the panel reads as broken rather than as
// VAT-free. Loud on purpose: this is the one state where "nothing happens" is correct behaviour, and
// it has already cost a bug hunt. It sits beside the axis select — the pinned control the reader is
// actually clicking when nothing moves — rather than by the VAT field, which is one tab deep.
export function ZeroVatWarning() {
  return (
    <p
      role="alert"
      className="border-destructive text-destructive flex items-start gap-2 rounded border-2 px-2 py-1.5 text-xs font-semibold"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span>
        VAT 0% — brutto = netto. Przełącznik netto/brutto nic nie zmieni, dopóki nie ustawisz stawki
        VAT.
      </span>
    </p>
  )
}
