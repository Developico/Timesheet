import { ensureDataverseBaseUrl } from "./dataverse-config"
import { getDataverseToken } from "./dataverse-auth"

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "OData-Version": "4.0",
  "OData-MaxVersion": "4.0",
}

export interface DataverseRequestOptions {
  method?: string
  query?: string
  body?: any
  headers?: Record<string, string>
  retry?: number
}

export class DataverseClient {
  private base = ensureDataverseBaseUrl()

  async request(path: string, opts: DataverseRequestOptions = {}): Promise<any> {
    if (!this.base) {
      throw new Error("Dataverse disabled: base URL not configured (DATAVERSE_URL)")
    }
    const token = await getDataverseToken()
    const method = (opts.method || "GET").toUpperCase()
    const url = `${this.base}/api/data/v9.2${path.startsWith("/") ? path : "/" + path}${opts.query ? (path.includes("?") ? "&" + opts.query : "?" + opts.query) : ""}`
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
      throw new Error(`Dataverse ${res.status} ${res.statusText} ${text.slice(0, 500)}`)
    }

    if (res.status === 204) return undefined
    const ct = res.headers.get("Content-Type") || ""
    if (ct.includes("application/json")) return res.json()
    return res.text()
  }

  list(entitySet: string, query?: string) {
    return this.request(`/${entitySet}`, { query })
  }

  getById(entitySet: string, id: string, query?: string) {
    return this.request(`/${entitySet}(${id})`, { query })
  }
}

export const dataverseClient = new DataverseClient()
