import { NextResponse } from 'next/server'
// Switched to application (client credentials) token to avoid per-user expiry errors
import { getAppGraphToken } from '@/lib/graph-app-token'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'
import { appLog } from '@/lib/app-logger'

export const revalidate = 0

// Allow several env var names. Prefer server-only names, but fall back to NEXT_PUBLIC_* if present.
const GROUP_ID =
  process.env.AZURE_AD_CONSULTANTS_GROUP_ID ||
  process.env.CONSULTANTS_GROUP_ID ||
  process.env.NEXT_PUBLIC_CONSULTANT_GROUP ||
  ''

interface RawGraphUser { id?: string; displayName?: string; mail?: string; userPrincipalName?: string }
interface GraphPage {
  value?: RawGraphUser[]
  '@odata.nextLink'?: string
  error?: { message?: string }
  message?: string
}
interface NormalizedMember { aadObjectId: string; name: string; email?: string; upn?: string; consultantId?: string }

export async function GET() {
  const cid = `graph-cons-${Math.random().toString(36).slice(2, 8)}`
  const started = Date.now()
  try {
    if (!GROUP_ID) {
      return NextResponse.json(
        {
          error: 'CONSULTANTS_GROUP_ID not configured',
          details:
            'Set AZURE_AD_CONSULTANTS_GROUP_ID (preferred) or NEXT_PUBLIC_CONSULTANT_GROUP to your Azure AD security group Object ID.',
          cid,
        },
        { status: 500 }
      )
    }
    // Require user session (so only authenticated users can list consultants) but do NOT rely on delegated access token
  // getServerSession expects NextAuthOptions; authOptions already typed but import path casting may confuse TS in edge runtime
  const session = await getServerSession(authOptions)
    if(!session){
      return NextResponse.json({ error: 'unauthorized', cid, reason: 'no-session' }, { status: 401 })
    }
    const at = await getAppGraphToken()

    // Restrict to user objects only (exclude devices, groups, etc.)
  const url = `https://graph.microsoft.com/v1.0/groups/${GROUP_ID}/members/microsoft.graph.user?$select=id,displayName,mail,userPrincipalName`
  const members: Array<Omit<NormalizedMember, 'consultantId'>> = []
    let triedTransitive = false
    let transitiveDenied = false
  async function pull(purl: string) {
      let next = purl
      while (next) {
        const res = await fetch(next, { headers: { Authorization: `Bearer ${at}` } })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          let message: string | undefined
          try {
      const parsed: GraphPage = JSON.parse(text) as GraphPage
      message = parsed?.error?.message || parsed?.message
          } catch {}
          const diag = res.headers.get('x-ms-ags-diagnostic') || null
          return { ok: false as const, status: res.status, message, body: text, diag }
        }
    const json: GraphPage = await res.json() as GraphPage
    const value = json.value
        if (Array.isArray(value)) {
          for (const m of value) {
            if (!m || !m.id) continue
            members.push({ aadObjectId: m.id, name: m.displayName || '(no name)', email: m.mail || undefined, upn: m.userPrincipalName || undefined })
          }
        }
    next = json['@odata.nextLink'] || ''
      }
      return { ok: true as const }
    }
    {
      const r = await pull(url)
      if (!r.ok) {
        return NextResponse.json({ error: 'graph_error', status: r.status, message: r.message, body: r.body, diag: r.diag, cid }, { status: 502 })
      }
    }
    if (members.length === 0) {
      // Some tenants keep only nested groups as direct members. Try transitiveMembers.
      triedTransitive = true
      const turl = `https://graph.microsoft.com/v1.0/groups/${GROUP_ID}/transitiveMembers/microsoft.graph.user?$select=id,displayName,mail,userPrincipalName`
      const r = await pull(turl)
      if (!r.ok) {
        // If transitive query is denied, keep silent but add a hint in response later.
        transitiveDenied = r.status === 403
      }
    }

    // Map to Dataverse consultant IDs where possible
  const out: NormalizedMember[] = []
    for (const m of members) {
      let consultantId: string | undefined = undefined
      try {
        const mapped = await mapAadOidToConsultantId(m.aadObjectId)
        if (mapped) consultantId = mapped
      } catch {}
      out.push({ ...m, consultantId })
    }

  appLog('info', 'graph_consultants ok', { cid, ms: Date.now() - started, count: out.length, transitiveTried: triedTransitive, transitiveDenied })
  const hint = out.length === 0 && transitiveDenied ? 'nested_members_denied' : undefined
  return NextResponse.json({ value: out, cid, transitiveTried: triedTransitive, transitiveDenied, hint })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    appLog('error', 'graph_consultants err', { cid, msg })
    const status = msg.includes('Missing AZURE_AD_') ? 500 : 502
    return NextResponse.json({ error: 'graph_failure', cid, message: msg }, { status })
  }
}
