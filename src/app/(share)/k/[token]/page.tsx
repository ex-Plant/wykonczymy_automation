import { notFound } from 'next/navigation'
import { getPreviewKosztorysByToken } from '@/lib/queries/preview-kosztorys'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'

// The public entrance. A revoked token and a token that never existed both land on the same 404, so
// the page never reveals which investments exist.
export default async function SharedKosztorysPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getPreviewKosztorysByToken(token)
  if (!data) notFound()

  return <KosztorysEditorBody preview {...data} />
}
