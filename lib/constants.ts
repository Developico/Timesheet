// ── Rate limiting ──────────────────────────────────────────────────────
export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX_REQUESTS = 600
export const RATE_LIMIT_AUTH_MAX_REQUESTS = 30

// ── Client cache ──────────────────────────────────────────────────────
export const CACHE_TTL_MS = 15 * 60_000               // 15 min
export const CACHE_STALE_WINDOW_MS = 2 * 60 * 60_000  // 2h
export const CACHE_DAYS_OFF_TTL_MS = 12 * 60 * 60_000         // 12h
export const CACHE_DAYS_OFF_STALE_WINDOW_MS = 7 * 24 * 60 * 60_000 // 7d
