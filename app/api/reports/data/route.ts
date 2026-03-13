import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth, isAuthError } from '@/lib/api-auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { getDataSource } from '@/data/source'
import { aggregateReport } from '@/lib/report-engine'

const ReportParamsSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD'),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD'),
  groupBy: z.enum(['consultant', 'project', 'client']),
  projectIds: z.string().optional(),
  consultantIds: z.string().optional(),
  billable: z.enum(['all', 'billable', 'non-billable']).default('all'),
  includeTasks: z.enum(['true', 'false']).optional(),
})

export async function GET(req: NextRequest) {
  // 1. Auth
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth

  // 2. Admin guard
  const role = typeof auth.token['role'] === 'string' ? auth.token['role'] : ''
  if (role !== 'Administrator') {
    return apiError(403, 'Forbidden', { code: 'ADMIN_REQUIRED' })
  }

  // 3. Validate params
  const url = new URL(req.url)
  const raw = Object.fromEntries(url.searchParams)
  const parsed = ReportParamsSchema.safeParse(raw)
  if (!parsed.success) {
    return apiError(400, 'Invalid parameters', {
      code: 'VALIDATION_FAILED',
      details: parsed.error.flatten().fieldErrors,
    })
  }
  const p = parsed.data

  // 4. Fetch data
  const ds = getDataSource()
  const [entries, projects, consultants] = await Promise.all([
    ds.getTimeEntries({ from: p.dateFrom, to: p.dateTo, billable: 'all' }),
    ds.getProjects(),
    ds.getConsultants(),
  ])

  // 5. Aggregate
  const result = aggregateReport(entries, projects, consultants, {
    dateFrom: p.dateFrom,
    dateTo: p.dateTo,
    groupBy: p.groupBy,
    projectIds: p.projectIds ? p.projectIds.split(',').filter(Boolean) : undefined,
    consultantIds: p.consultantIds ? p.consultantIds.split(',').filter(Boolean) : undefined,
    billable: p.billable,
    includeTasks: p.includeTasks === 'true',
  })

  return apiSuccess(result)
}
