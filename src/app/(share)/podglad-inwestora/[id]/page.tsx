import { requireInvestmentOr404 } from '@/lib/queries/investments'
import { getPreviewKosztorysById } from '@/lib/queries/preview-kosztorys'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'

// „Podgląd dla inwestora": the owner's faithful preview, rendered under the SAME bare (share) layout the
// public /k/<token> page uses — so the shell is byte-identical to what an investor gets, not the app's
// sidebar/nav. The (share) layout reads no session, so this page carries the whole auth gate itself:
// requireInvestmentOr404 redirects a dead session to /zaloguj and 404s a missing investment.
export default async function ClientPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { investmentId } = await requireInvestmentOr404(id)
  const data = await getPreviewKosztorysById(investmentId)

  return <KosztorysEditorBody preview {...data} />
}
