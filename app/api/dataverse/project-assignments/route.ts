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
  const qpConsultant = url.searchParams.get('consultantId') || undefined
  try {
    let consultantId: string | null = qpConsultant || null
    // If no consultantId in query, map from token OID
    if (!consultantId && NEXTAUTH_SECRET) {
      try {
        const token = await getToken({ req, secret: NEXTAUTH_SECRET })
        const rawOid = (token as Record<string, unknown> | null)?.['oid'] || (token as Record<string, unknown> | null)?.['OID'] || (token as Record<string, unknown> | null)?.['sub'] || null
        const oid = typeof rawOid === 'string' ? rawOid : null
        if (oid) {
          const mapped = await mapAadOidToConsultantId(oid)
          consultantId = mapped
          appLog('debug','assignments oid map',{ hasOid: !!oid, mapped: !!mapped })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        appLog('warn','assignments token map fail',{ msg })
      }
    }
    if (!consultantId) {
      appLog('info','assignments none',{ ms: Date.now()-started })
      return NextResponse.json({ value: [] })
    }
    const ds = getDataSource()
    if (!ds.getProjectAssignments) {
      appLog('error','assignments unsupported')
      return NextResponse.json({ error: "Assignments not supported" }, { status: 501 })
    }
    const ids = await ds.getProjectAssignments(consultantId)
    appLog('info','assignments ok',{ ms: Date.now()-started, count: ids.length })
    return NextResponse.json({ value: ids, consultantId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Assignments error'
    appLog('error','assignments error',{ message: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
