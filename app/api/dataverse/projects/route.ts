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
          const oid = (token as any)?.oid || (token as any)?.OID || (token as any)?.sub || null
          if (oid) {
            const mapped = await mapAadOidToConsultantId(oid)
            if (mapped) consultantId = mapped
            appLog('debug','projects oid map',{ cid, oid, mapped: !!mapped })
          }
        } catch (err:any) { appLog('warn','projects oid map failed',{ cid, err: err.message }) }
      }
      const projects = await ds.getProjects(consultantId)
      appLog('info','projects ok',{ cid, ms: Date.now()-started, count: projects.length })
      return NextResponse.json({ value: projects, cid })
    } catch (e:any) {
      appLog('error','projects error',{ cid, ms: Date.now()-started, message: e.message })
      return NextResponse.json({ error: 'Dataverse projects error', cid }, { status: 500 })
    }
  })
}
