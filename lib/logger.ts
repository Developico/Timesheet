import fs from 'fs'
import path from 'path'

// ── Types ──────────────────────────────────────────────────────────────
export type Level = 'debug' | 'info' | 'warn' | 'error'
export interface LogData { [k: string]: unknown }

export interface Logger {
  id: string
  debug: (msg: string, data?: LogData) => void
  info: (msg: string, data?: LogData) => void
  warn: (msg: string, data?: LogData) => void
  error: (msg: string, data?: LogData) => void
  child: (extra: LogData) => Logger
}

// ── Config ─────────────────────────────────────────────────────────────
const LOG_MODE = (process.env.LOG_MODE || 'console').toLowerCase()
const logFilePath = path.join(process.cwd(), 'app-debug.log')

// ── Redaction ──────────────────────────────────────────────────────────
function redact(v: unknown): unknown {
  if (!v) return v
  if (typeof v === 'string') {
    if (v.length > 60 && /^(eyJ|[A-Za-z0-9-_]+=*\.)/.test(v))
      return v.slice(0, 12) + '...redacted'
    return v
  }
  if (Array.isArray(v)) return v.map(redact)
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>)) {
      if (/token|secret|password|authorization/i.test(k)) {
        const val = (v as Record<string, unknown>)[k]
        out[k] = typeof val === 'string' ? val.slice(0, 8) + '...redacted' : '[redacted]'
      } else {
        out[k] = redact((v as Record<string, unknown>)[k])
      }
    }
    return out
  }
  return v
}

export function sanitizeError(e: unknown) {
  if (!e || typeof e !== 'object') return undefined
  const err = e as { name?: string; message?: string; stack?: unknown; code?: unknown }
  return {
    name: err.name,
    message: err.message,
    stack: typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 6).join('\n') : undefined,
    code: err.code,
  }
}

// ── Core write ─────────────────────────────────────────────────────────
function write(rec: Record<string, unknown>) {
  try {
    const line = JSON.stringify(rec)
    if (LOG_MODE === 'file' && process.env.NODE_ENV !== 'production') {
      fs.appendFileSync(logFilePath, line + '\n')
    } else if (LOG_MODE !== 'silent') {
      const lvl = (rec.lvl as string) || 'info'
      // eslint-disable-next-line no-console
      console[lvl === 'error' ? 'error' : lvl === 'warn' ? 'warn' : 'log'](line)
    }
  } catch {/* ignore */}
}

// ── Flat API (backward compat with appLog) ─────────────────────────────
export function appLog<T extends LogData>(level: Level, msg: string, data?: T) {
  write({ ts: new Date().toISOString(), lvl: level, msg, ...(data ? { data: redact(data) } : {}) })
}

export function withCorrelation<T>(base: string, fn: (cid: string) => Promise<T>): Promise<T> {
  const cid = `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return fn(cid)
}

// ── Structured Logger (child-capable) ──────────────────────────────────
export function createLogger(ctx: LogData = {}): Logger {
  const cid = (ctx.cid as string) || `cid-${Math.random().toString(36).slice(2, 8)}`
  const base = { ...ctx, cid }

  function log(level: Level, msg: string, data?: LogData) {
    write({
      ts: new Date().toISOString(),
      lvl: level,
      msg,
      ...base,
      ...(data ? { data: redact(data) } : {}),
    })
  }

  return {
    id: cid,
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
    child: (extra) => createLogger({ ...base, ...extra }),
  }
}
