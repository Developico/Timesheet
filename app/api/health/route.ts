import { NextResponse } from 'next/server'
import { appLog } from '@/lib/app-logger'
import { DataverseDataSource } from '@/data/dataverse'
import { MockDataSource } from '@/data/mock'
import { type IDataSource } from '@/data/interfaces'

function checkDataverse(): { enabled: boolean; reason?: string } {
  if (process.env.DATAVERSE_ENABLED !== 'true') {
    return { enabled: false, reason: 'DATAVERSE_ENABLED not true' }
  }
  if (!process.env.DATAVERSE_URL) {
    return { enabled: false, reason: 'DATAVERSE_URL missing' }
  }
  return { enabled: true }
}

export async function GET() {
  const started = Date.now()
  const dv = checkDataverse()
  let dsName: string = 'unknown'
  let ok = false
  let sample: any = null
  let error: string | undefined
  let version: string | undefined
  let tokenAcquired = false
  try {
    let ds: IDataSource
    if (dv.enabled) {
      ds = new DataverseDataSource()
      dsName = 'dataverse'
      try {
        const projects = await ds.getProjects(undefined)
        sample = { projects: projects.slice(0, 1) }
        ok = true
      } catch (e: any) {
        error = e.message
      }
    } else {
      ds = new MockDataSource()
      dsName = 'mock'
      const projects = await ds.getProjects(undefined)
      sample = { projects: projects.slice(0, 1) }
      ok = true
    }
  } catch (e: any) {
    error = e.message
  }
  const body = {
    ok,
    ds: dsName,
    dataverse: dv,
    baseUrl: process.env.DATAVERSE_URL || null,
    sample,
    error,
    ms: Date.now() - started,
  }
  appLog('info','health',{ ds: dsName, ok, ms: body.ms, reason: dv.reason })
  return NextResponse.json(body)
}
