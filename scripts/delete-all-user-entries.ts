/**
 * One-off: delete ALL tt_timeregisters for Test User1 in 2026-01-01 – 2026-04-30.
 * No note filter — removes everything for that user in range.
 */
import { ConfidentialClientApplication } from '@azure/msal-node'
import fs from 'fs'
import path from 'path'

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx < 1) continue
    const key = line.slice(0, eqIdx).trim()
    let val = line.slice(eqIdx + 1).trim()
    val = val.replace(/\$\{(\w+)\}/g, (_, ref) => process.env[ref] || '')
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

const DRY_RUN = process.argv.includes('--dry-run')
const DATAVERSE_URL = process.env.DATAVERSE_URL?.replace(/\/$/, '')
const cca = new ConfidentialClientApplication({
  auth: {
    authority: `https://login.microsoftonline.com/${process.env.DATAVERSE_TENANT_ID}`,
    clientId: process.env.DATAVERSE_CLIENT_ID!,
    clientSecret: process.env.DATAVERSE_CLIENT_SECRET!,
  },
})

async function getToken() {
  const res = await cca.acquireTokenByClientCredential({ scopes: [`${DATAVERSE_URL}/.default`] })
  return res!.accessToken
}

async function dvGetAll(entitySet: string, query: string): Promise<any[]> {
  const token = await getToken()
  let url = `${DATAVERSE_URL}/api/data/v9.2/${entitySet}?${query}`
  const out: any[] = []
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'OData-Version': '4.0', 'OData-MaxVersion': '4.0' },
    })
    if (!res.ok) { const t = await res.text(); throw new Error(`GET failed: ${res.status} ${t.slice(0, 300)}`) }
    const data = await res.json() as any
    out.push(...(data.value || []))
    url = data['@odata.nextLink'] || ''
  }
  return out
}

async function dvDelete(entitySet: string, id: string) {
  const token = await getToken()
  const res = await fetch(`${DATAVERSE_URL}/api/data/v9.2/${entitySet}(${id})`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'OData-Version': '4.0', 'OData-MaxVersion': '4.0' },
  })
  if (!res.ok && res.status !== 404) {
    const t = await res.text(); throw new Error(`DELETE failed: ${res.status} ${t.slice(0, 200)}`)
  }
}

async function main() {
  const userId = '271810ab-c6e2-ee11-904c-000d3a66a755'
  const filter = encodeURIComponent(
    `_tt_userid_value eq ${userId} and tt_startdatetime ge 2026-01-01T00:00:00Z and tt_startdatetime le 2026-04-30T23:59:59Z`
  )
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('Querying all entries for Test User1 (2026-01–04)...')
  const records = await dvGetAll('tt_timeregisters', `$select=tt_timeregisterid,tt_startdatetime,tt_note&$filter=${filter}`)
  console.log(`Found ${records.length} records.`)

  if (records.length === 0) return
  if (DRY_RUN) { console.log('[DRY RUN] Would delete', records.length, 'records.'); return }

  console.log(`Deleting ${records.length} records...`)
  let ok = 0, fail = 0
  for (const r of records) {
    try { await dvDelete('tt_timeregisters', r.tt_timeregisterid); ok++; if (ok % 50 === 0) console.log(`  ...${ok}/${records.length}`) }
    catch (e: any) { fail++; console.error(`  FAIL: ${e.message?.slice(0, 100)}`); if (fail > 10) break }
  }
  console.log(`Done! Deleted: ${ok}, Failed: ${fail}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
