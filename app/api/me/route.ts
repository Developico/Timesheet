import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'

const TokenClaimsSchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  email: z.string().default(''),
  role: z.string().optional(),
  roles: z.array(z.string()).optional().default([]),
  aad_obo_key: z.string().optional(),
}).passthrough()

// Returns basic current user info derived from NextAuth JWT.
// 200: { id,name,email,role,roles,hasPhoto }
// 401: no valid session
// 500: server misconfiguration
export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET
  if(!secret) return NextResponse.json({ error: 'server_misconfig', message: 'NEXTAUTH_SECRET missing' }, { status: 500 })

  const token = await getToken({ req, secret })
  if(!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = TokenClaimsSchema.safeParse(token)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_token', message: 'Token claims validation failed' }, { status: 500 })
  }
  const t = parsed.data
  const rawRoles = t.roles.filter(Boolean)
  const role = t.role || rawRoles[0] || 'Unauthorized'

  const payload = {
    id: t.id,
    name: t.name,
    email: t.email,
    role,
    roles: rawRoles.length ? rawRoles : [role],
    hasPhoto: Boolean(t.aad_obo_key),
  }

  return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
