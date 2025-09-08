import { NextResponse, type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { z } from "zod"
import { getToken } from 'next-auth/jwt'
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'

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
  try {
    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 })
    }

    let { from, to, consultantId, billable, projectIds } = parsed.data
    if (!consultantId && NEXTAUTH_SECRET) {
      try {
        const token = await getToken({ req, secret: NEXTAUTH_SECRET })
        const oid = token?.sub
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
    const entries = await ds.getTimeEntries(params)
    return NextResponse.json({ value: entries })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Dataverse time entries error" }, { status: 500 })
  }
}
