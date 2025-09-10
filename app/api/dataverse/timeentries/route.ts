import { NextResponse, type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { z } from "zod"
import { getToken } from 'next-auth/jwt'
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'
import { appLog } from '@/lib/app-logger'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || ''

export const revalidate = 0

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consultantId: z.string().optional(),
  billable: z.enum(["true", "false", "all"]).optional(),
  projectIds: z.string().optional(), // comma separated
})

export async function GET(req: NextRequest) {
  const cid = `time-${Math.random().toString(36).slice(2,10)}`
  const started = Date.now()
  try {
    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      appLog('error','timeentries invalid query',{ cid, issues: parsed.error.issues })
      return NextResponse.json({ error: "Invalid query", cid, details: parsed.error.flatten() }, { status: 400 })
    }

    let { from, to, consultantId, billable, projectIds } = parsed.data
    if (!consultantId && NEXTAUTH_SECRET) {
      try {
        const token = await getToken({ req, secret: NEXTAUTH_SECRET })
        const oid = (token as any)?.oid || (token as any)?.OID || null
        if (oid) {
          const mapped = await mapAadOidToConsultantId(oid)
          if (mapped) consultantId = mapped
        }
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
  let entries
    try {
      entries = await ds.getTimeEntries(params)
    } catch (e:any) {
      appLog('error','timeentries fetch error',{ cid, message: e.message })
      throw e
    }
    appLog('info','timeentries ok',{ cid, ms: Date.now()-started, count: entries.length })
    return NextResponse.json({ value: entries, cid })
  } catch (e: any) {
    appLog('error','timeentries unhandled',{ cid, message: e?.message, stack: e?.stack?.split('\n').slice(0,4).join(' | ') })
    return NextResponse.json({ error: e.message || "Dataverse time entries error", cid }, { status: 500 })
  }
}
