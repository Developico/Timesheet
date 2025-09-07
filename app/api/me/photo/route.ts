import { NextRequest, NextResponse } from 'next/server';
import { getUserAadAccessToken } from '@/lib/server-auth';

// Fetch user photo from Microsoft Graph. Falls back to 204 if no photo.
export async function GET(req: NextRequest) {
  try {
    const at = await getUserAadAccessToken(req);
    const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { Authorization: `Bearer ${at}` }
    });
    if (res.status === 404) return new NextResponse(null, { status: 204 });
    if (!res.ok) return NextResponse.json({ error: 'graph_error', status: res.status }, { status: 502 });
  const ab = await res.arrayBuffer();
  const blob = new Blob([ab], { type: res.headers.get('content-type') || 'image/jpeg' });
  return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'private, max-age=300'
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'unauthorized', message: e?.message }, { status: 401 });
  }
}
