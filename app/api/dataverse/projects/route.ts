import { NextResponse, type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { getToken } from 'next-auth/jwt'
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'
import { appLog, withCorrelation } from '@/lib/app-logger'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || ''

export const revalidate = 0

export async function GET(req: NextRequest) {
  return withCorrelation('proj', async (cid) => {
    const started = Date.now()
    try {
      const ds = getDataSource()
      let consultantId: string | undefined
      if (NEXTAUTH_SECRET) {
        try {
          const token = await getToken({ req, secret: NEXTAUTH_SECRET })
          const rawOid = (token as Record<string, unknown> | null)?.['oid'] || (token as Record<string, unknown> | null)?.['OID'] || (token as Record<string, unknown> | null)?.['sub'] || null
          const oid = typeof rawOid === 'string' ? rawOid : null
          if (oid) {
            const mapped = await mapAadOidToConsultantId(oid)
            if (mapped) consultantId = mapped
            appLog('debug','projects oid map',{ cid, hasOid: !!oid, mapped: !!mapped })
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown'
          appLog('warn','projects oid map failed',{ cid, msg })
        }
      }
      const projects = await ds.getProjects(consultantId)
      appLog('info','projects ok',{ cid, ms: Date.now()-started, count: projects.length })
      return NextResponse.json({ value: projects, cid })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      appLog('error','projects error',{ cid, ms: Date.now()-started, message: msg })
      return NextResponse.json({ error: 'Dataverse projects error', cid }, { status: 500 })
    }
  })
}
