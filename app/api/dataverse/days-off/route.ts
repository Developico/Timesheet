import { type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { z } from "zod"
import { requireAuth, isAuthError } from '@/lib/api-auth-guard'
import { apiSuccess, apiError } from '@/lib/api-response'

export const revalidate = 0

const Schema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth
  try {
    const url = new URL(req.url)
    const params = { from: url.searchParams.get('from') || '', to: url.searchParams.get('to') || '' }
    const parsed = Schema.safeParse(params)
    if (!parsed.success) {
      return apiError(400, 'Invalid range', { code: 'VALIDATION_FAILED' })
    }
    const ds = getDataSource()
    if (!ds.getDaysOff) return apiSuccess([])
    const value = await ds.getDaysOff(parsed.data.from, parsed.data.to)
    return apiSuccess(value)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'DaysOff error'
    return apiError(500, msg)
  }
}