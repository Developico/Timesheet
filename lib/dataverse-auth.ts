import { ConfidentialClientApplication } from "@azure/msal-node"
import { appLog } from './app-logger'

let cca: ConfidentialClientApplication | null = null

function getCCA() {
  if (cca) return cca
  const { DATAVERSE_TENANT_ID, DATAVERSE_CLIENT_ID, DATAVERSE_CLIENT_SECRET } = process.env
  if (!DATAVERSE_TENANT_ID || !DATAVERSE_CLIENT_ID || !DATAVERSE_CLIENT_SECRET) {
    throw new Error("Missing Dataverse auth env vars (TENANT / CLIENT / SECRET)")
  }
  cca = new ConfidentialClientApplication({
    auth: {
      authority: `https://login.microsoftonline.com/${DATAVERSE_TENANT_ID}`,
      clientId: DATAVERSE_CLIENT_ID,
      clientSecret: DATAVERSE_CLIENT_SECRET,
    },
  })
  return cca
}

export async function getDataverseToken(): Promise<string> {
  const scopeBase = process.env.DATAVERSE_URL?.replace(/\/$/, "")
  if (!scopeBase) throw new Error("DATAVERSE_URL not set for token scope")
  const scopes = [`${scopeBase}/.default`]
  try {
    const res = await getCCA().acquireTokenByClientCredential({ scopes })
    if (!res?.accessToken) throw new Error("Failed to acquire Dataverse token")
    appLog('debug','dataverse token acquired',{ expiresOn: res.expiresOn?.toISOString?.(), tenant: process.env.DATAVERSE_TENANT_ID?.slice(0,8) })
    return res.accessToken
  } catch(e: unknown) {
    const err = e as { message?: string; name?: string; code?: unknown }
    appLog('error','dataverse token error',{ message: err.message, name: err.name, code: err.code })
    throw e
  }
}
