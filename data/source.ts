import type { IDataSource } from "./interfaces"
import { MockDataSource } from "./mock"
import { DataverseDataSource } from "./dataverse"
import { appLog } from '@/lib/app-logger'

// New flag: if DATAVERSE_ENABLED === 'true' then use Dataverse, else mock fallback
let warned = false
let firstEvalDone = false
function isDataverseEnabled() {
  const server = typeof window === 'undefined'
  if (server) {
    const flag = process.env.DATAVERSE_ENABLED
    const url = process.env.DATAVERSE_URL
    const enabled = flag === 'true' && !!url
    if (!firstEvalDone) {
      appLog('info','datasource eval',{ flag, hasUrl: !!url, enabled })
      firstEvalDone = true
      if (flag === 'true' && !url && !warned) {
        console.warn('[dataverse] DATAVERSE_ENABLED=true but DATAVERSE_URL missing; using mock data')
        warned = true
      }
    }
    return enabled
  }
  // Client side override (dev helper only)
  const override = localStorage.getItem('dataverse-enabled')
  if (override === 'true') return true
  if (override === 'false') return false
  return false
}

export const dataSource: IDataSource = isDataverseEnabled()
  ? new DataverseDataSource()
  : new MockDataSource()

export const getDataSource = (): IDataSource => (isDataverseEnabled() ? new DataverseDataSource() : new MockDataSource())
