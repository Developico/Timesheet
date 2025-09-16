import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Returns basic current user info derived from NextAuth JWT.
// 200: { id,name,email,role,roles,hasPhoto }
// 401: no valid session
// 500: server misconfiguration
export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET
  if(!secret) return NextResponse.json({ error: 'server_misconfig', message: 'NEXTAUTH_SECRET missing' }, { status: 500 })

  const token = await getToken({ req, secret })
  if(!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const t = token as Record<string, any>
  const rawRoles = Array.isArray(t.roles) ? t.roles.filter((r:unknown)=> typeof r === 'string') : []
  const role = typeof t.role === 'string' ? t.role : (rawRoles[0] || 'Unauthorized')

  const payload = {
    id: typeof t.id === 'string' ? t.id : '',
    name: typeof t.name === 'string' ? t.name : '',
    email: typeof t.email === 'string' ? t.email : '',
    role,
    roles: rawRoles.length ? rawRoles : [role],
    hasPhoto: Boolean(t.aad_obo_key), // heuristic: if OBO key exists we can probably fetch /api/me/photo
  }

  return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
