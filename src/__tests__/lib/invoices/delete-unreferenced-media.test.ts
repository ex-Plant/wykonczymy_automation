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

  // The deployed database loses all but one of a set of concurrent Payload writes, and reports
  // success for every one of them — which left every page but one of a deleted multi-page invoice
  // in storage with nothing pointing at it. Overlapping calls are the defect, so that is what this
  // asserts; a mock cannot show the lost row itself.
  it('never has two deletes in flight at once', async () => {
    const { payload, deleted } = fakePayload({})
    let inFlight = 0
    let maxInFlight = 0
    vi.mocked(payload.delete).mockImplementation((async ({ id }: { id: number }) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      deleted.push(id)
    }) as unknown as Payload['delete'])

    await deleteUnreferencedMedia(payload, [1, 2, 3, 4])

    expect(maxInFlight).toBe(1)
    expect(deleted).toEqual([1, 2, 3, 4])
  })
})
