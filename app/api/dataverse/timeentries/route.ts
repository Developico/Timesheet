import { NextResponse } from "next/server"
import { getDataSource } from "@/data/source"
import { z } from "zod"

export const revalidate = 0

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consultantId: z.string().optional(),
  billable: z.enum(["true", "false", "all"]).optional(),
  projectIds: z.string().optional(), // comma separated
})

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 })
    }

    const { from, to, consultantId, billable, projectIds } = parsed.data
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
