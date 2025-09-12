import { NextResponse, type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { getToken } from 'next-auth/jwt'
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'
import { appLog } from '@/lib/app-logger'

export const revalidate = 0

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || ''

export async function GET(req: NextRequest) {
  const started = Date.now()
  const url = new URL(req.url)
  const projectId = url.searchParams.get('projectId') || undefined
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }
  try {
    const ds = getDataSource()
    if (!ds.getProjectTeam) {
      appLog('error','project-team unsupported')
      return NextResponse.json({ error: "Project team not supported" }, { status: 501 })
    }
    // Optional: if caller passes consultantId, we can validate permissions by mapping caller OID (best-effort)
    if (NEXTAUTH_SECRET) {
      try {
        const token = await getToken({ req, secret: NEXTAUTH_SECRET })
        const rawOid = (token as Record<string, unknown> | null)?.['oid'] || (token as Record<string, unknown> | null)?.['OID'] || (token as Record<string, unknown> | null)?.['sub'] || null
        const oid = typeof rawOid === 'string' ? rawOid : null
        if (oid) {
          const mapped = await mapAadOidToConsultantId(oid)
          appLog('debug','project-team caller',{ hasOid: !!oid, mapped: !!mapped })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        appLog('warn','project-team token map fail',{ msg })
      }
    }
    const ids = await ds.getProjectTeam(projectId)
    appLog('info','project-team ok',{ ms: Date.now()-started, count: ids.length })
    return NextResponse.json({ value: ids, projectId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Project team error'
    appLog('error','project-team error',{ message: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
