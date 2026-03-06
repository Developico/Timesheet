import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limiter'

describe('checkRateLimit', () => {
  it('allows first request', () => {
    const result = checkRateLimit('test-ip-first', false)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(599)
  })

  it('allows requests within limit', () => {
    const ip = 'test-ip-within'
    for (let i = 0; i < 599; i++) {
      checkRateLimit(ip, false)
    }
    const result = checkRateLimit(ip, false)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('blocks when limit exceeded', () => {
    const ip = 'test-ip-blocked'
    for (let i = 0; i < 600; i++) {
      checkRateLimit(ip, false)
    }
    const result = checkRateLimit(ip, false)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('has stricter limit for auth routes', () => {
    const ip = 'test-ip-auth'
    for (let i = 0; i < 30; i++) {
      checkRateLimit(ip, true)
    }
    const result = checkRateLimit(ip, true)
    expect(result.allowed).toBe(false)
  })

  it('separates auth and api counters', () => {
    const ip = 'test-ip-separate'
    // Exhaust auth limit
    for (let i = 0; i < 30; i++) {
      checkRateLimit(ip, true)
    }
    // API should still work
    const apiResult = checkRateLimit(ip, false)
    expect(apiResult.allowed).toBe(true)
  })
})
