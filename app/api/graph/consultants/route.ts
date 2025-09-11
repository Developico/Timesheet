import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(req: NextRequest) {
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
    const session = await getServerSession(authOptions as any)
    if(!session){
      return NextResponse.json({ error: 'unauthorized', cid, reason: 'no-session' }, { status: 401 })
    }
    const at = await getAppGraphToken()

    // Restrict to user objects only (exclude devices, groups, etc.)
    let url = `https://graph.microsoft.com/v1.0/groups/${GROUP_ID}/members/microsoft.graph.user?$select=id,displayName,mail,userPrincipalName`
    const members: Array<{ aadObjectId: string; name: string; email?: string; upn?: string }> = []
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
            const parsed = JSON.parse(text)
            message = parsed?.error?.message || parsed?.message
          } catch {}
          const diag = res.headers.get('x-ms-ags-diagnostic') || null
          return { ok: false as const, status: res.status, message, body: text, diag }
        }
        const json = await res.json()
        const value = Array.isArray(json.value) ? json.value : []
        for (const m of value) {
          if (!m || !m.id) continue
          members.push({ aadObjectId: m.id, name: m.displayName || '(no name)', email: m.mail || undefined, upn: m.userPrincipalName || undefined })
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
    const out: Array<{ aadObjectId: string; name: string; email?: string; upn?: string; consultantId?: string }> = []
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
  } catch (e: any) {
  appLog('error', 'graph_consultants err', { cid, msg: e?.message })
  // Distinguish config vs auth vs generic
  const msg = e?.message || 'internal error'
  const status = msg.includes('Missing AZURE_AD_') ? 500 : 502
  return NextResponse.json({ error: 'graph_failure', cid, message: msg }, { status })
  }
}
