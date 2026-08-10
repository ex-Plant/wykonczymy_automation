import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'

/** Send one invoice's pages (in order) to the scan route and return the extracted fields. */
export async function scanReceiptClient(
  files: File[],
  otherCategoryNames: string[],
): Promise<ReceiptFillResultT> {
  const formData = new FormData()
  for (const file of files) formData.append('files', file)
  formData.set('otherCategoryNames', JSON.stringify(otherCategoryNames))

  const res = await fetch('/api/extract-receipt', { method: 'POST', body: formData })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Błąd odczytu paragonu' }))
    throw new Error(body.error ?? `Scan failed (${res.status})`)
  }

  const body: { data: ReceiptFillResultT } = await res.json()
  return body.data
}
