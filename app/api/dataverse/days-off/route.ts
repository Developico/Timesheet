import { NextResponse } from "next/server"
import { getDataSource } from "@/data/source"
import { z } from "zod"

export const revalidate = 0

const Schema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const params = { from: url.searchParams.get('from') || '', to: url.searchParams.get('to') || '' }
    const parsed = Schema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
    }
    const ds = getDataSource()
    if (!ds.getDaysOff) return NextResponse.json({ value: [] })
    const value = await ds.getDaysOff(parsed.data.from, parsed.data.to)
    return NextResponse.json({ value })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'DaysOff error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}