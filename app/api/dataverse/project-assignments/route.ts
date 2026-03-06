import { type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'
import { appLog } from '@/lib/app-logger'
import { requireAuth, isAuthError } from '@/lib/api-auth-guard'
import { apiSuccess, apiError } from '@/lib/api-response'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth
  const started = Date.now()
  const url = new URL(req.url)
  const qpConsultant = url.searchParams.get('consultantId') || undefined
  try {
    let consultantId: string | null = qpConsultant || null
    // If no consultantId in query, map from token OID
    if (!consultantId && auth.oid) {
      try {
        const mapped = await mapAadOidToConsultantId(auth.oid)
        consultantId = mapped
        appLog('debug','assignments oid map',{ hasOid: true, mapped: !!mapped })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        appLog('warn','assignments token map fail',{ msg })
      }
    }
    if (!consultantId) {
      appLog('info','assignments none',{ ms: Date.now()-started })
      return apiSuccess([])
    }
    const ds = getDataSource()
    if (!ds.getProjectAssignments) {
      appLog('error','assignments unsupported')
      return apiError(501, 'Assignments not supported')
    }
    const ids = await ds.getProjectAssignments(consultantId)
    appLog('info','assignments ok',{ ms: Date.now()-started, count: ids.length })
    return apiSuccess(ids, { consultantId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Assignments error'
    appLog('error','assignments error',{ message: msg })
    return apiError(500, msg)
  }
}
