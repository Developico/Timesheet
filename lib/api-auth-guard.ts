import { type NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || ''

export interface AuthResult {
  token: Record<string, unknown>
  oid: string | null
}

/**
 * Require a valid NextAuth session for the given request.
 * Returns the JWT payload (with extracted oid) on success, or a 401 NextResponse on failure.
 */
export async function requireAuth(
  req: NextRequest,
): Promise<AuthResult | NextResponse> {
  if (!NEXTAUTH_SECRET) {
    return NextResponse.json(
      { error: 'server_misconfig', message: 'NEXTAUTH_SECRET missing' },
      { status: 500 },
    )
  }

  const token = await getToken({ req, secret: NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rec = token as Record<string, unknown>
  const rawOid = rec['oid'] || rec['OID'] || rec['sub'] || null
  const oid = typeof rawOid === 'string' ? rawOid : null

  return { token: rec, oid }
}

/** Type guard: returns true when requireAuth returned an error response */
export function isAuthError(
  result: AuthResult | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse
}
