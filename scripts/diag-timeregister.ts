/**
 * Diagnostic: inspect tt_timeregister entity metadata and test a single POST.
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

async function dvFetch(path: string) {
  const token = await getToken()
  const res = await fetch(`${DATAVERSE_URL}/api/data/v9.2${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'OData-Version': '4.0' },
  })
  return res.json() as any
}

async function dvPost(entitySet: string, body: Record<string, unknown>) {
  const token = await getToken()
  const res = await fetch(`${DATAVERSE_URL}/api/data/v9.2/${entitySet}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'OData-Version': '4.0',
      'OData-MaxVersion': '4.0',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`POST status: ${res.status}`)
  if (text) console.log(`Response: ${text.slice(0, 500)}`)
  return res.status
}

async function main() {
  // 1. Get navigation properties for tt_timeregister
  console.log('=== Navigation Properties ===')
  const navData = await dvFetch(
    `/EntityDefinitions(LogicalName='tt_timeregister')?$select=LogicalName&$expand=ManyToOneRelationships($select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntityNavigationPropertyName)`
  )
  const rels = navData.ManyToOneRelationships || []
  for (const r of rels) {
    console.log(`  ${r.ReferencingAttribute} -> ${r.ReferencedEntity} (nav: ${r.ReferencingEntityNavigationPropertyName}, schema: ${r.SchemaName})`)
  }

  // 2. Try a single POST with navigation property bind
  console.log('\n=== Test POST ===')
  const projectNav = rels.find((r: any) => r.ReferencingAttribute === 'tt_projectid')
  const userNav = rels.find((r: any) => r.ReferencingAttribute === 'tt_userid')
  console.log(`Project nav property: ${projectNav?.ReferencingEntityNavigationPropertyName}`)
  console.log(`User nav property: ${userNav?.ReferencingEntityNavigationPropertyName}`)

  const userId = '271810ab-c6e2-ee11-904c-000d3a66a755'
  const projectId = '5e2c84ba-021c-ee11-8f6d-0022489d0546' // D.D

  // Test with navigation property binding
  const body: Record<string, unknown> = {
    tt_startdatetime: '2026-01-02T09:00:00Z',
    tt_duration: 60,
    tt_note: '[DEMO-SEED-TEST] diagnostic entry - delete me',
    tt_task: 'Test',
  }

  if (projectNav) {
    body[`${projectNav.ReferencingEntityNavigationPropertyName}@odata.bind`] = `/tt_projects(${projectId})`
  }
  if (userNav) {
    body[`${userNav.ReferencingEntityNavigationPropertyName}@odata.bind`] = `/systemusers(${userId})`
  }

  console.log('Body:', JSON.stringify(body, null, 2))
  await dvPost('tt_timeregisters', body)
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1) })
