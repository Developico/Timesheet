import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limiter'

const IS_DEV = process.env.NODE_ENV === 'development'

// Security headers applied to all responses
// In production, unsafe-eval is removed from script-src (only needed for Next.js dev HMR)
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    IS_DEV
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"                  // Dev: HMR requires unsafe-eval
      : "script-src 'self' 'unsafe-inline'",                               // Prod: no unsafe-eval
    "style-src 'self' 'unsafe-inline'",                                     // Tailwind injects inline styles
    "img-src 'self' blob: data: https://graph.microsoft.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com",
    "frame-ancestors 'none'",
  ].join('; '),
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.ip ||
    '127.0.0.1'
  )
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rate limiting on API routes
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(req)
    const isAuthRoute = pathname.startsWith('/api/auth/')
    const result = checkRateLimit(ip, isAuthRoute)

    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests', retryAfter: result.retryAfterSeconds }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.retryAfterSeconds ?? 60),
            ...SECURITY_HEADERS,
          },
        },
      )
    }
  }

  // Apply security headers to all responses
  const response = NextResponse.next()
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
