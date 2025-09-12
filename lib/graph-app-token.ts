// Helper to obtain and cache an application (client credentials) token for Microsoft Graph
// Uses AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET

interface CachedToken { accessToken: string; expiresAt: number }
let cached: CachedToken | null = null

async function requestNew(): Promise<CachedToken> {
  const tenant = process.env.AZURE_AD_TENANT_ID
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET
  if (!tenant || !clientId || !clientSecret) {
    throw new Error('Missing AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET')
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) {
    const txt = await res.text().catch(()=> '')
    throw new Error(`App token request failed ${res.status}: ${txt}`)
  }
  interface TokenResponse { access_token: string; expires_in: number }
  const json: unknown = await res.json()
  const tr = json as Partial<TokenResponse>
  const expiresIn = typeof tr.expires_in === 'number' ? tr.expires_in : 3600
  return { accessToken: tr.access_token || '', expiresAt: Date.now() + expiresIn * 1000 }
}

export async function getAppGraphToken(): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.accessToken
  cached = await requestNew()
  return cached.accessToken
}

export function _invalidateAppGraphTokenCache(){ cached = null }