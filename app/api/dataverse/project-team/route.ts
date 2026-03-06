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
  const projectId = url.searchParams.get('projectId') || undefined
  if (!projectId) {
    return apiError(400, 'projectId is required', { code: 'VALIDATION_FAILED' })
  }
  try {
    const ds = getDataSource()
    if (!ds.getProjectTeam) {
      appLog('error','project-team unsupported')
      return apiError(501, 'Project team not supported')
    }
    if (auth.oid) {
      try {
        const mapped = await mapAadOidToConsultantId(auth.oid)
        appLog('debug','project-team caller',{ hasOid: true, mapped: !!mapped })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        appLog('warn','project-team token map fail',{ msg })
      }
    }
    const ids = await ds.getProjectTeam(projectId)
    appLog('info','project-team ok',{ ms: Date.now()-started, count: ids.length })
    return apiSuccess(ids, { projectId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Project team error'
    appLog('error','project-team error',{ message: msg })
    return apiError(500, msg)
  }
}
