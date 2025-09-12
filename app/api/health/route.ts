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
  let sample: { projects: unknown[] } | null = null
  let error: string | undefined
  try {
    let ds: IDataSource
    if (dv.enabled) {
      ds = new DataverseDataSource()
      dsName = 'dataverse'
      try {
        const projects = await ds.getProjects(undefined)
        sample = { projects: projects.slice(0, 1) }
        ok = true
      } catch (e) {
        error = e instanceof Error ? e.message : 'unknown'
      }
    } else {
      ds = new MockDataSource()
      dsName = 'mock'
      try {
        const projects = await ds.getProjects(undefined)
        sample = { projects: projects.slice(0, 1) }
        ok = true
      } catch (e) {
        error = e instanceof Error ? e.message : 'unknown'
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'unknown'
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
