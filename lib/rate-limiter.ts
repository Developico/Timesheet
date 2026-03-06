// In-memory sliding window rate limiter.
// Designed for single-instance deployments (Azure App Service B1/S1).
// For horizontal scaling, swap to Redis-backed implementation.

import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_AUTH_MAX_REQUESTS,
} from './constants'

interface WindowEntry {
  count: number
  windowStart: number
}

const windows = new Map<string, WindowEntry>()

// Cleanup expired entries every 60 seconds
let cleanupScheduled = false
function scheduleCleanup() {
  if (cleanupScheduled) return
  cleanupScheduled = true
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of windows) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        windows.delete(key)
      }
    }
  }, RATE_LIMIT_WINDOW_MS)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds?: number
}

export function checkRateLimit(
  ip: string,
  isAuthRoute: boolean,
): RateLimitResult {
  scheduleCleanup()

  const maxRequests = isAuthRoute ? RATE_LIMIT_AUTH_MAX_REQUESTS : RATE_LIMIT_MAX_REQUESTS
  const key = isAuthRoute ? `auth:${ip}` : `api:${ip}`
  const now = Date.now()

  const entry = windows.get(key)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    windows.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  entry.count++
  if (entry.count > maxRequests) {
    const retryAfterSeconds = Math.ceil(
      (entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000,
    )
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  return { allowed: true, remaining: maxRequests - entry.count }
}
