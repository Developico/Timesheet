import { type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'
import { appLog, withCorrelation } from '@/lib/app-logger'
import { requireAuth, isAuthError } from '@/lib/api-auth-guard'
import { apiSuccess, apiError } from '@/lib/api-response'

export const revalidate = 0

export async function GET(req: NextRequest) {
  return withCorrelation('proj', async (cid) => {
    const auth = await requireAuth(req)
    if (isAuthError(auth)) return auth
    const started = Date.now()
    try {
      const ds = getDataSource()
      let consultantId: string | undefined
      if (auth.oid) {
        try {
          const mapped = await mapAadOidToConsultantId(auth.oid)
          if (mapped) consultantId = mapped
          appLog('debug','projects oid map',{ cid, hasOid: true, mapped: !!mapped })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown'
          appLog('warn','projects oid map failed',{ cid, msg })
        }
      }
      const projects = await ds.getProjects(consultantId)
      appLog('info','projects ok',{ cid, ms: Date.now()-started, count: projects.length })
      return apiSuccess(projects, { cid })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      appLog('error','projects error',{ cid, ms: Date.now()-started, message: msg })
      return apiError(500, 'Dataverse projects error', { cid })
    }
  })
}
