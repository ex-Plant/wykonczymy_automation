import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'

// The single home for the fail-closed rule both crons rely on. Their own specs
// assert that they reject — this one owns *when* rejection happens.
describe('isAuthorizedCronRequest', () => {
  const previous = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
  })

  afterEach(() => {
    process.env.CRON_SECRET = previous
  })

  const request = (headers: Record<string, string> = {}) =>
    new NextRequest('http://localhost/api/cron/whatever', { headers })

  it('accepts the matching bearer token', () => {
    expect(isAuthorizedCronRequest(request({ authorization: 'Bearer test-secret' }))).toBe(true)
  })

  it('rejects a missing Authorization header', () => {
    expect(isAuthorizedCronRequest(request())).toBe(false)
  })

  it('rejects a wrong secret', () => {
    expect(isAuthorizedCronRequest(request({ authorization: 'Bearer wrong' }))).toBe(false)
  })

  it('rejects the bare secret without the Bearer scheme', () => {
    expect(isAuthorizedCronRequest(request({ authorization: 'test-secret' }))).toBe(false)
  })

  // Fail closed: an unset secret must never make every request look authorized.
  it('rejects everything when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET
    expect(isAuthorizedCronRequest(request({ authorization: 'Bearer test-secret' }))).toBe(false)
    expect(isAuthorizedCronRequest(request({ authorization: 'Bearer ' }))).toBe(false)
  })
})
