import { NextRequest, NextResponse } from 'next/server'
import { getUserAadAccessToken } from '@/lib/server-auth'

export const revalidate = 0

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
    const at = await getUserAadAccessToken(req)
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(id)}/photo/$value`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${at}` } })
    if (res.status === 404) return new NextResponse(null, { status: 204 })
    if (!res.ok) return NextResponse.json({ error: 'graph_error', status: res.status }, { status: 502 })
    const ab = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    return new NextResponse(new Blob([ab], { type: contentType }), {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' }
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'unauthorized', message: e?.message }, { status: 401 })
  }
}
