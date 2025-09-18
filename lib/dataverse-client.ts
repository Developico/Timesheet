import { ensureDataverseBaseUrl } from "./dataverse-config"
import { getDataverseToken } from "./dataverse-auth"
import { appLog } from './app-logger'

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "OData-Version": "4.0",
  "OData-MaxVersion": "4.0",
}

export interface DataverseRequestOptions<TBody = unknown> {
  method?: string
  query?: string
  body?: TBody
  headers?: Record<string, string>
  retry?: number
}

export class DataverseClient {
  private base = ensureDataverseBaseUrl()

  async request<TResponse = unknown, TBody = unknown>(path: string, opts: DataverseRequestOptions<TBody> = {}): Promise<TResponse | undefined> {
    if (!this.base) {
      throw new Error("Dataverse disabled: base URL not configured (DATAVERSE_URL)")
    }
  const token = await getDataverseToken()
    const method = (opts.method || "GET").toUpperCase()
    const url = `${this.base}/api/data/v9.2${path.startsWith("/") ? path : "/" + path}${opts.query ? (path.includes("?") ? "&" + opts.query : "?" + opts.query) : ""}`
  const started = Date.now()
  appLog('debug','dataverse request',{ method, path, query: opts.query, retry: opts.retry })
    const res = await fetch(url, {
      method,
      headers: {
        ...DEFAULT_HEADERS,
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })

    if (res.status === 429 || res.status === 503) {
      const retry = (opts.retry ?? 0) + 1
      if (retry <= 3) {
        const ra = Number(res.headers.get("Retry-After")) || Math.pow(2, retry) * 0.5
        await new Promise((r) => setTimeout(r, ra * 1000))
        return this.request(path, { ...opts, retry })
      }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      appLog('error','dataverse request error',{ status: res.status, statusText: res.statusText, snippet: text.slice(0,140) })
      throw new Error(`Dataverse ${res.status} ${res.statusText} ${text.slice(0, 500)}`)
    }
    appLog('debug','dataverse response',{ ms: Date.now()-started, status: res.status })

  if (res.status === 204) return undefined
    const ct = res.headers.get("Content-Type") || ""
  if (ct.includes("application/json")) return res.json() as Promise<TResponse>
  return res.text() as unknown as TResponse
  }

  list<T = unknown>(entitySet: string, query?: string) {
    return this.request<T>(`/${entitySet}`, { query })
  }

  // Fetch all pages by following @odata.nextLink. Returns a consolidated array in { value } shape.
  async listAll<T = unknown>(entitySet: string, query?: string): Promise<{ value: any[] }> {
    const first = (await this.request<{ value?: any[]; [k: string]: any }>(`/${entitySet}`, { query })) || { value: [] }
    const out: any[] = Array.isArray(first.value) ? [...first.value] : []
    let nextLink: string | null = (first as any)['@odata.nextLink'] || null
    let page = 1
    while (nextLink) {
      // nextLink is an absolute URL from Dataverse; fetch it directly reusing auth headers
      const pageRes = await this.requestAbsolute<{ value?: any[]; [k: string]: any }>(nextLink)
      const vals = Array.isArray(pageRes?.value) ? pageRes!.value! : []
      out.push(...vals)
      nextLink = (pageRes as any)['@odata.nextLink'] || null
      page += 1
    }
    return { value: out }
  }

  // Internal: request a full absolute URL (used for @odata.nextLink)
  private async requestAbsolute<TResponse = unknown>(absoluteUrl: string): Promise<TResponse> {
    if (!this.base) {
      throw new Error("Dataverse disabled: base URL not configured (DATAVERSE_URL)")
    }
    const token = await getDataverseToken()
    appLog('debug','dataverse request nextLink',{ url: absoluteUrl })
    const res = await fetch(absoluteUrl, {
      method: 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      appLog('error','dataverse request error',{ status: res.status, statusText: res.statusText, snippet: text.slice(0,140) })
      throw new Error(`Dataverse ${res.status} ${res.statusText} ${text.slice(0, 500)}`)
    }
    const ct = res.headers.get("Content-Type") || ""
    if (ct.includes("application/json")) return res.json() as Promise<TResponse>
    return res.text() as unknown as TResponse
  }

  getById<T = unknown>(entitySet: string, id: string, query?: string) {
    return this.request<T>(`/${entitySet}(${id})`, { query })
  }
}

export const dataverseClient = new DataverseClient()
