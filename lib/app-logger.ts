import fs from 'fs'
import path from 'path'

type Level = 'debug'|'info'|'warn'|'error'

const LOG_MODE = (process.env.LOG_MODE || 'console').toLowerCase()
const logFilePath = path.join(process.cwd(), 'app-debug.log')

function redact(v: any): any {
  if (!v) return v
  if (typeof v === 'string') {
    if (v.length > 60 && /^(eyJ|[A-Za-z0-9-_]+=*\.)/.test(v)) return v.slice(0,12) + '...redacted'
    return v
  }
  if (Array.isArray(v)) return v.map(redact)
  if (typeof v === 'object') {
    const out: any = {}
    for (const k of Object.keys(v)) {
      if (/token|secret|password|authorization/i.test(k)) {
        const val = (v as any)[k]
        out[k] = typeof val === 'string' ? (val.slice(0,8)+'...redacted') : '[redacted]'
      } else out[k] = redact((v as any)[k])
    }
    return out
  }
  return v
}

export function appLog(level: Level, msg: string, data?: any){
  try {
    const rec = { ts: new Date().toISOString(), lvl: level, msg, ...(data? { data: redact(data) }: {}) }
    const line = JSON.stringify(rec)
    if (LOG_MODE === 'file' && process.env.NODE_ENV !== 'production') {
      fs.appendFileSync(logFilePath, line+'\n')
    } else if (LOG_MODE !== 'silent') {
      // eslint-disable-next-line no-console
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line)
    }
  } catch {/* ignore */}
}

export function withCorrelation<T>(base: string, fn: (cid: string)=>Promise<T>): Promise<T>{
  const cid = `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
  return fn(cid)
}
