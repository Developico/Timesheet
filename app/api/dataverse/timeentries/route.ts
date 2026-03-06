import { type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { z } from "zod"
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'
import { appLog } from '@/lib/app-logger'
import { requireAuth, isAuthError } from '@/lib/api-auth-guard'
import { apiSuccess, apiError } from '@/lib/api-response'

export const revalidate = 0

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consultantId: z.string().optional(),
  billable: z.enum(["true", "false", "all"]).optional(),
  projectIds: z.string().optional(), // comma separated
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth
  const cid = `time-${Math.random().toString(36).slice(2,10)}`
  const started = Date.now()
  try {
    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      appLog('error','timeentries invalid query',{ cid, issues: parsed.error.issues })
      return apiError(400, 'Invalid query', { code: 'VALIDATION_FAILED', cid, details: parsed.error.flatten() })
    }

  // Prefer const for immutable fields; consultantId may be inferred later
  const { from, to, billable, projectIds } = parsed.data
  let { consultantId } = parsed.data
    if (!consultantId && auth.oid) {
      try {
        const mapped = await mapAadOidToConsultantId(auth.oid)
        if (mapped) consultantId = mapped
      } catch {/* ignore */}
    }
    const ds = getDataSource()
    const params = {
      from,
      to,
      consultantId,
      billable: billable === undefined ? undefined : billable === "all" ? "all" : billable === "true",
      projectIds: projectIds ? projectIds.split(",").filter(Boolean) : undefined,
    } as const
    appLog('debug','timeentries params',{ cid, from, to, consultantId, billable, projectIds })
    let entries: unknown[]
    try {
      entries = await ds.getTimeEntries(params)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      appLog('error','timeentries fetch error',{ cid, message: msg })
      throw e
    }
    appLog('info','timeentries ok',{ cid, ms: Date.now()-started, count: entries.length })
    return apiSuccess(entries, { cid })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Dataverse time entries error'
    const stack = e instanceof Error && e.stack ? e.stack.split('\n').slice(0,4).join(' | ') : undefined
    appLog('error','timeentries unhandled',{ cid, message: errMsg, stack })
    return apiError(500, errMsg, { cid })
  }
}
