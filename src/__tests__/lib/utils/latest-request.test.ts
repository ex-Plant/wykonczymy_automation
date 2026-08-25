import { describe, expect, it } from 'vitest'
import { createLatestRequest } from '@/lib/utils/latest-request'

describe('createLatestRequest', () => {
  it('keeps a lone request current', () => {
    const isCurrent = createLatestRequest().start()
    expect(isCurrent()).toBe(true)
  })

  it('retires the older request when a newer one starts', () => {
    const request = createLatestRequest()

    const first = request.start()
    const second = request.start()

    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  it('retires everything in flight on disown', () => {
    const request = createLatestRequest()
    const inFlight = request.start()

    request.disown()

    expect(inFlight()).toBe(false)
  })

  it('lets the next request start after a disown', () => {
    const request = createLatestRequest()
    request.disown()

    expect(request.start()()).toBe(true)
  })

  it('scopes the counter per instance', () => {
    const one = createLatestRequest()
    const two = createLatestRequest()

    const inFlight = one.start()
    two.start()

    expect(inFlight()).toBe(true)
  })
})
