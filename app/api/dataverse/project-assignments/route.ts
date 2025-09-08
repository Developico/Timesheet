import { NextResponse, type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { getToken } from 'next-auth/jwt'
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'

export const revalidate = 0

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || ''

export async function GET(req: NextRequest) {
  try {
    // Derive consultantId based on authenticated Entra user
    let consultantId: string | null = null
    if (NEXTAUTH_SECRET) {
      try {
        const token = await getToken({ req, secret: NEXTAUTH_SECRET })
        const oid = token?.sub
        if (oid) consultantId = await mapAadOidToConsultantId(oid)
      } catch {/* ignore */}
    }
    if (!consultantId) {
      return NextResponse.json({ value: [] })
    }
    const ds = getDataSource()
    if (!ds.getProjectAssignments) {
      return NextResponse.json({ error: "Assignments not supported" }, { status: 501 })
    }
    const ids = await ds.getProjectAssignments(consultantId)
    return NextResponse.json({ value: ids })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Assignments error" }, { status: 500 })
  }
}
