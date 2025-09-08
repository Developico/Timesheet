import { NextResponse } from 'next/server'
import { getDataSource } from '@/data/source'

export const revalidate = 0

export async function GET() {
  try {
    const ds = getDataSource()
    const consultants = await ds.getConsultants()
    return NextResponse.json({ value: consultants })
  } catch(e:any) {
    return NextResponse.json({ error: e.message||'Consultants error' }, { status: 500 })
  }
}
