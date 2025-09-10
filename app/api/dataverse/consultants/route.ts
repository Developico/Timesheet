import { NextResponse } from 'next/server'
import { getDataSource } from '@/data/source'
import { appLog, withCorrelation } from '@/lib/app-logger'

export const revalidate = 0

export async function GET() {
  return withCorrelation('cons', async (cid)=>{
    const started = Date.now()
    try {
      const ds = getDataSource()
      const consultants = await ds.getConsultants()
      appLog('info','consultants ok',{ cid, ms: Date.now()-started, count: consultants.length })
      return NextResponse.json({ value: consultants, cid })
    } catch(e:any) {
      appLog('error','consultants error',{ cid, ms: Date.now()-started, message: e.message })
      return NextResponse.json({ error: 'Consultants error', cid }, { status: 500 })
    }
  })
}
