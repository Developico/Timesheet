import { type NextRequest } from 'next/server'
import { getDataSource } from '@/data/source'
import { appLog, withCorrelation } from '@/lib/app-logger'
import { requireAuth, isAuthError } from '@/lib/api-auth-guard'
import { apiSuccess, apiError } from '@/lib/api-response'

export const revalidate = 0

export async function GET(req: NextRequest) {
  return withCorrelation('cons', async (cid)=>{
    const auth = await requireAuth(req)
    if (isAuthError(auth)) return auth
    const started = Date.now()
    try {
      const ds = getDataSource()
      const consultants = await ds.getConsultants()
      appLog('info','consultants ok',{ cid, ms: Date.now()-started, count: consultants.length })
      return apiSuccess(consultants, { cid })
    } catch(e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      appLog('error','consultants error',{ cid, ms: Date.now()-started, message: msg })
      return apiError(500, 'Consultants error', { cid })
    }
  })
}
