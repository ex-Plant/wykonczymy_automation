import { resolveId } from '@/lib/utils/resolve-id'
import type { MediaInfoT } from '@/lib/queries/media'
import type { InvoiceFileT } from '@/types/transfers'

// `invoice` is hasMany: a depth:0 read gives ids, a populated read gives media docs. The scalar
// forms stay accepted because a doc can reach here from either shape and a silent `typeof x ===
// 'number'` guard on the wrong one is exactly the bug this field's migration introduced.
type InvoiceRefT = number | { id: number }
export type InvoiceFieldT = InvoiceRefT | InvoiceRefT[] | null | undefined

/** Every page id of one doc's `invoice` field, in attachment order. */
export function invoiceIds(invoice: InvoiceFieldT): number[] {
  const refs = Array.isArray(invoice) ? invoice : [invoice]
  return refs.map(resolveId).filter((id): id is number => id !== undefined)
}

/** Resolves a doc's `invoice` field into its openable pages, in attachment order. */
export function resolveInvoiceFiles(
  invoice: InvoiceFieldT,
  media: Map<number, MediaInfoT>,
): InvoiceFileT[] {
  return invoiceIds(invoice)
    .map((id) => ({ id, info: media.get(id) }))
    .filter((page): page is { id: number; info: MediaInfoT & { url: string } } =>
      Boolean(page.info?.url),
    )
    .map(({ id, info }) => ({
      id,
      url: info.url,
      filename: info.filename,
      mimeType: info.mimeType,
    }))
}

export function extractInvoiceIds(docs: { invoice?: InvoiceFieldT }[]): number[] {
  const ids = new Set<number>()
  for (const doc of docs) {
    for (const id of invoiceIds(doc.invoice)) ids.add(id)
  }
  return [...ids]
}
