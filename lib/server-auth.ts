import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { vsGet, vsGetWithReload } from './volatile-store';

// Return raw user access token (assertion) stored behind aad_obo_key
export async function getUserAadAccessToken(req: NextRequest): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET not set');
  const token = await getToken({ req, secret });
  const key = (token as any)?.aad_obo_key as string | undefined;
  if (!key) throw new Error('No aad_obo_key on token');
  const assertion = vsGet(key) ?? vsGetWithReload(key);
  if (!assertion) throw new Error('Access token not found (expired)');
  return assertion;
}
