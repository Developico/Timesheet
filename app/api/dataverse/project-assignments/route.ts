import { NextResponse } from "next/server"
import { getDataSource } from "@/data/source"
import { z } from "zod"

export const revalidate = 0

const Schema = z.object({ consultantId: z.string() })

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const consultantId = url.searchParams.get("consultantId") || ""
    const parsed = Schema.safeParse({ consultantId })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid consultantId" }, { status: 400 })
    }
    const ds = getDataSource()
    if (!ds.getProjectAssignments) {
      return NextResponse.json({ error: "Assignments not supported" }, { status: 501 })
    }
    const ids = await ds.getProjectAssignments(parsed.data.consultantId)
    return NextResponse.json({ value: ids })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Assignments error" }, { status: 500 })
  }
}
