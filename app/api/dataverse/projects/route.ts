import { NextResponse, type NextRequest } from "next/server"
import { getDataSource } from "@/data/source"
import { getToken } from 'next-auth/jwt'
import { mapAadOidToConsultantId } from '@/lib/dataverse-user-map'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || ''

export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const ds = getDataSource()
    let consultantId: string | undefined
    // Map Entra OID (token.sub) => Dataverse systemuserid if possible
    if (NEXTAUTH_SECRET) {
      try {
        const token = await getToken({ req, secret: NEXTAUTH_SECRET })
        const oid = token?.sub // Azure AD object id usually in sub
        if (oid) {
          const mapped = await mapAadOidToConsultantId(oid)
          if (mapped) consultantId = mapped
        }
      } catch {/* ignore */}
    }
    const projects = await ds.getProjects(consultantId)
    return NextResponse.json({ value: projects })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Dataverse projects error" }, { status: 500 })
  }
}
