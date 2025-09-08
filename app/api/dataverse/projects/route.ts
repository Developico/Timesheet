import { NextResponse } from "next/server"
import { getDataSource } from "@/data/source"

export const revalidate = 0

export async function GET() {
  try {
    const ds = getDataSource()
    const projects = await ds.getProjects()
    return NextResponse.json({ value: projects })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Dataverse projects error" }, { status: 500 })
  }
}
