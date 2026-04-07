/**
 * Cleanup demo TimeEntry data from Dataverse for "Test User 01".
 *
 * Deletes all tt_timeregisters records that:
 *   - belong to "Test User 01"
 *   - fall within 2026-01-01 – 2026-04-30
 *   - have tt_note starting with "[DEMO-SEED]"
 *
 * Usage:
 *   pnpm seed:cleanup           # delete demo records
 *   pnpm seed:cleanup:dry       # preview what would be deleted
 */

import { ConfidentialClientApplication } from '@azure/msal-node'
import fs from 'fs'
import path from 'path'

// ── Env loading ────────────────────────────────────────────────────────
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

// ── Config ─────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run')
const DATAVERSE_URL = process.env.DATAVERSE_URL?.replace(/\/$/, '')
const TENANT_ID = process.env.DATAVERSE_TENANT_ID
const CLIENT_ID = process.env.DATAVERSE_CLIENT_ID
const CLIENT_SECRET = process.env.DATAVERSE_CLIENT_SECRET

const TR_ENTITY_SET = process.env.DATAVERSE_ENTITY_TIMEREGISTER || 'tt_timeregisters'
const TR_ID = process.env.DATAVERSE_FIELD_TR_ID || 'tt_timeregisterid'
const TR_START = process.env.DATAVERSE_FIELD_TR_START || 'tt_startdatetime'
const TR_USER_LOOKUP = process.env.DATAVERSE_FIELD_TR_USER || '_tt_userid_value'
const TR_NOTE = process.env.DATAVERSE_FIELD_TR_NOTE || 'tt_note'

const USER_ENTITY_SET = process.env.DATAVERSE_ENTITY_CONSULTANT || 'systemusers'

const DEMO_NOTE_PREFIX = '[DEMO-SEED]'
const USER_NAME = 'Test User1'
const USER_UPN = 'TestUser1@developico.com'

const DATE_FROM = '2026-01-01'
const DATE_TO = '2026-04-30'

// ── Auth ────────────────────────────────────────────────────────────────
let cca: ConfidentialClientApplication | null = null

async function getToken(): Promise<string> {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !DATAVERSE_URL) {
    throw new Error('Missing DATAVERSE_* env vars. Check .env.local.')
  }
  if (!cca) {
    cca = new ConfidentialClientApplication({
      auth: {
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
      },
    })
  }
  const res = await cca.acquireTokenByClientCredential({
    scopes: [`${DATAVERSE_URL}/.default`],
  })
  if (!res?.accessToken) throw new Error('Failed to acquire Dataverse token')
  return res.accessToken
}

// ── HTTP helpers ────────────────────────────────────────────────────────
async function dvGet<T = any>(entitySet: string, query: string): Promise<T> {
  const token = await getToken()
  const url = `${DATAVERSE_URL}/api/data/v9.2/${entitySet}?${query}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-Version': '4.0',
      'OData-MaxVersion': '4.0',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GET ${entitySet} failed: ${res.status} ${text.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

async function dvGetAll<T = any>(entitySet: string, query: string): Promise<any[]> {
  const first = await dvGet<{ value: any[]; '@odata.nextLink'?: string }>(entitySet, query)
  const out: any[] = first.value || []
  let nextLink = first['@odata.nextLink']
  while (nextLink) {
    const token = await getToken()
    const res = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'OData-Version': '4.0',
        'OData-MaxVersion': '4.0',
      },
    })
    if (!res.ok) break
    const page = await res.json() as { value: any[]; '@odata.nextLink'?: string }
    out.push(...(page.value || []))
    nextLink = page['@odata.nextLink']
  }
  return out
}

async function dvDelete(entitySet: string, id: string): Promise<void> {
  const token = await getToken()
  const url = `${DATAVERSE_URL}/api/data/v9.2/${entitySet}(${id})`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'OData-Version': '4.0',
      'OData-MaxVersion': '4.0',
    },
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(`DELETE ${entitySet}(${id}) failed: ${res.status} ${text.slice(0, 200)}`)
  }
}

// ── Lookup ──────────────────────────────────────────────────────────────
async function findUserId(name: string, upn: string): Promise<string> {
  let data = await dvGet<{ value: any[] }>(
    USER_ENTITY_SET,
    `$select=systemuserid,fullname&$filter=fullname eq '${name.replace(/'/g, "''")}'&$top=1`
  )
  if (!data.value?.length) {
    data = await dvGet<{ value: any[] }>(
      USER_ENTITY_SET,
      `$select=systemuserid,fullname&$filter=internalemailaddress eq '${upn.replace(/'/g, "''")}'&$top=1`
    )
  }
  if (!data.value?.length) throw new Error(`User "${name}" (${upn}) not found in Dataverse`)
  console.log(`  User: ${data.value[0].fullname} (${data.value[0].systemuserid})`)
  return data.value[0].systemuserid as string
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Cleanup Demo Data ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no deletes)' : 'LIVE'}`)
  console.log(`Period: ${DATE_FROM} – ${DATE_TO}`)
  console.log(`User: ${USER_NAME}`)
  console.log(`Filter: ${TR_NOTE} starts with "${DEMO_NOTE_PREFIX}"`)
  console.log()

  // 1. Resolve user
  console.log('Resolving user...')
  const userId = await findUserId(USER_NAME, USER_UPN)

  // 2. Find matching records
  console.log('\nQuerying demo records...')
  const fromIso = `${DATE_FROM}T00:00:00Z`
  const toIso = `${DATE_TO}T23:59:59Z`
  const filter = [
    `${TR_USER_LOOKUP} eq ${userId}`,
    `${TR_START} ge ${fromIso}`,
    `${TR_START} le ${toIso}`,
    `startswith(${TR_NOTE},'${DEMO_NOTE_PREFIX}')`,
  ].join(' and ')

  const records = await dvGetAll(
    TR_ENTITY_SET,
    `$select=${TR_ID},${TR_START},${TR_NOTE}&$filter=${encodeURIComponent(filter)}&$orderby=${encodeURIComponent(TR_START + ' asc')}`
  )

  console.log(`Found ${records.length} demo records.`)

  if (records.length === 0) {
    console.log('Nothing to delete.')
    return
  }

  // Show sample
  console.log('\nSample (first 5):')
  for (const r of records.slice(0, 5)) {
    console.log(`  ${(r[TR_START] || '').slice(0, 10)}  ${r[TR_NOTE]?.slice(0, 60)}`)
  }
  if (records.length > 5) {
    console.log(`  ... and ${records.length - 5} more`)
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would delete ${records.length} records. Remove --dry-run to execute.`)
    return
  }

  // 3. Delete records
  console.log(`\nDeleting ${records.length} records...`)
  let deleted = 0
  let failed = 0

  for (const r of records) {
    try {
      await dvDelete(TR_ENTITY_SET, r[TR_ID])
      deleted++
      if (deleted % 50 === 0) {
        console.log(`  ...${deleted}/${records.length} deleted`)
      }
    } catch (err: any) {
      failed++
      console.error(`  FAIL [${r[TR_ID]}]: ${err.message?.slice(0, 120)}`)
      if (failed > 10) {
        console.error('Too many failures, aborting.')
        break
      }
    }
  }

  console.log(`\nDone! Deleted: ${deleted}, Failed: ${failed}`)
}

main().catch((err) => {
  console.error('Fatal:', err.message || err)
  process.exit(1)
})
