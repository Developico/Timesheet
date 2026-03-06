import { NextResponse } from 'next/server'

export interface ApiError {
  error: string
  code?: string
  details?: unknown
  cid?: string
}

export function apiError(
  status: number,
  error: string,
  opts: { code?: string; details?: unknown; cid?: string } = {},
): NextResponse<ApiError> {
  return NextResponse.json(
    { error, ...opts },
    { status },
  )
}

export function apiSuccess<T>(data: T, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ value: data, ...extra })
}
