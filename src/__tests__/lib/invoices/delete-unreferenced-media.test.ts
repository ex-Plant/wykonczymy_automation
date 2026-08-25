import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { deleteUnreferencedMedia } from '@/lib/invoices/delete-unreferenced-media'

type ReferencedByT = { transactions?: number[]; inspections?: number[] }

function fakePayload(referencedBy: ReferencedByT) {
  const deleted: number[] = []
  const payload = {
    count: vi.fn(async ({ collection, where }) => {
      const id = where.invoice?.equals ?? where.attachments?.equals
      const ids =
        collection === 'transactions' ? referencedBy.transactions : referencedBy.inspections
      return { totalDocs: ids?.includes(id) ? 1 : 0 }
    }),
    delete: vi.fn(async ({ id }: { id: number }) => {
      deleted.push(id)
    }),
  }
  return { payload: payload as unknown as Payload, deleted }
}

describe('deleteUnreferencedMedia', () => {
  it('deletes a media row nothing points at', async () => {
    const { payload, deleted } = fakePayload({})
    await deleteUnreferencedMedia(payload, [7])
    expect(deleted).toEqual([7])
  })

  it('spares a page still attached to a transaction', async () => {
    const { payload, deleted } = fakePayload({ transactions: [7] })
    await deleteUnreferencedMedia(payload, [7])
    expect(deleted).toEqual([])
  })

  it('spares an attachment still held by a vehicle inspection', async () => {
    const { payload, deleted } = fakePayload({ inspections: [7] })
    await deleteUnreferencedMedia(payload, [7])
    expect(deleted).toEqual([])
  })

  it('leaks rather than throws when a delete fails', async () => {
    const { payload } = fakePayload({})
    vi.mocked(payload.delete).mockRejectedValueOnce(new Error('blob down'))
    await expect(deleteUnreferencedMedia(payload, [7])).resolves.toBeUndefined()
  })
})
