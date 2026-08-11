import { postFormData } from '@/lib/utils/post-form-data'
import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'

export async function scanReceiptClient(
  files: File[],
  otherCategoryNames: string[],
): Promise<ReceiptFillResultT> {
  const formData = new FormData()
  for (const file of files) formData.append('files', file)
  formData.set('otherCategoryNames', JSON.stringify(otherCategoryNames))

  const body = await postFormData<{ data: ReceiptFillResultT }>(
    '/api/extract-receipt',
    formData,
    'Błąd odczytu paragonu',
  )
  return body.data
}
