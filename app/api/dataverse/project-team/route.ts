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
        const oid = (token as any)?.oid || (token as any)?.OID || (token as any)?.sub || null
        if (oid) {
          const mapped = await mapAadOidToConsultantId(oid)
          appLog('debug','project-team caller',{ mapped: !!mapped })
        }
      } catch (e:any) {
        appLog('warn','project-team token map fail',{ message: e.message })
      }
    }
    const ids = await ds.getProjectTeam(projectId)
    appLog('info','project-team ok',{ ms: Date.now()-started, count: ids.length })
    return NextResponse.json({ value: ids, projectId })
  } catch (e:any) {
    appLog('error','project-team error',{ message: e.message })
    return NextResponse.json({ error: e.message || 'Project team error' }, { status: 500 })
  }
}
