import type { ClientViewModeT } from '@/lib/kosztorys/client-view-settings'

// One title for every setting whose consequence lands on the investor's link, because the mistake it
// catches is the same each time: a misclick in a picker whose consequence isn't on the screen the
// picker sits on. Shared so the wording can't drift between the controls that raise it.
export const INVESTOR_IMPACT_TITLE = 'Uwaga — zmiana widoczna dla inwestora!'

export const SETTLEMENT_MODE_IMPACT =
  'Sposób rozliczenia robocizny zmienia kwoty, które inwestor widzi w podglądzie.'

export const MATERIALS_PRICING_IMPACT =
  'Sposób rozliczenia materiałów zmienia kwoty, które inwestor widzi w podglądzie.'

export const CLIENT_VIEW_MODE_IMPACT: Record<ClientViewModeT, string> = {
  OFFER: 'Inwestor zobaczy pod swoim linkiem ofertę zamiast rozliczenia.',
  SETTLEMENT: 'Inwestor zobaczy pod swoim linkiem rozliczenie zamiast oferty.',
}
