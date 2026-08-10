import { describe, it, expect, vi } from 'vitest'

// compress-image pulls in compressorjs (browser-only) at import time; the resolver never
// calls it (upload is injected here), so stub the module to keep the import Node-safe.
vi.mock('@/lib/utils/compress-image', () => ({ compressImage: async (f: File) => f }))

import { resolveInvoiceMediaIds } from '@/lib/utils/upload-file-client'

const file = (name: string) => ({ name }) as File

describe('resolveInvoiceMediaIds', () => {
  it('uploads the File attached at a row', async () => {
    const upload = vi.fn(async () => 777)
    const files = new Map<number, File[]>([[0, [file('a.jpg')]]])

    const result = await resolveInvoiceMediaIds(1, files, upload)

    expect(result).toEqual([[777]])
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('returns an empty page list for a row with no File', async () => {
    const upload = vi.fn(async () => 1)
    const result = await resolveInvoiceMediaIds(1, new Map(), upload)

    expect(result).toEqual([[]])
    expect(upload).not.toHaveBeenCalled()
  })

  it('uploads each row independently across a sparse set, preserving positions', async () => {
    const upload = vi.fn(async (f: File) => (f.name === 'b.jpg' ? 500 : 600))
    const files = new Map<number, File[]>([
      [1, [file('b.jpg')]],
      [2, [file('c.jpg')]],
    ])

    const result = await resolveInvoiceMediaIds(3, files, upload)

    expect(result).toEqual([[], [500], [600]])
    expect(upload).toHaveBeenCalledTimes(2)
  })

  // Page order IS the invoice's reading order, and uploads run concurrently — so a slow page 1
  // must still land at index 0. This is the guard for that regrouping.
  it('keeps a row’s pages in attachment order even when a later page uploads first', async () => {
    const upload = vi.fn(async (f: File) => {
      if (f.name === 'p1.jpg') await new Promise((resolve) => setTimeout(resolve, 5))
      return Number(f.name.replace(/\D/g, ''))
    })
    const files = new Map<number, File[]>([
      [0, [file('p1.jpg'), file('p2.jpg'), file('p3.jpg')]],
      [1, [file('p4.jpg')]],
    ])

    const result = await resolveInvoiceMediaIds(2, files, upload)

    expect(result).toEqual([[1, 2, 3], [4]])
  })
})
