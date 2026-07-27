import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PropsT = {
  investmentId: number
}

// Settings (settlement mode, materiały netto pricing, VAT, rabat globalny) are edited in the
// kosztorys editor only — this is a link there, not a control: the investment page never persists
// these writes itself.
export function InvestmentSettingsLink({ investmentId }: PropsT) {
  return (
    <Button size="sm" variant="outline" asChild>
      <Link href={`/inwestycje/${investmentId}/kosztorys_v2?ustawienia=1`}>
        <Settings2 />
        Opcje rozliczenia
      </Link>
    </Button>
  )
}
