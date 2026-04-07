/**
 * Seed demo TimeEntry data into Dataverse for "Test User 01".
 *
 * Usage:
 *   pnpm seed:demo           # create records in Dataverse
 *   pnpm seed:demo:dry       # preview without writing
 *
 * Requires .env.local with DATAVERSE_* variables.
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
    // resolve ${VAR} references
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
const TR_START = process.env.DATAVERSE_FIELD_TR_START || 'tt_startdatetime'
const TR_DURATION = process.env.DATAVERSE_FIELD_TR_DURATION || 'tt_duration'
const TR_PROJECT_BIND = 'tt_ProjectID@odata.bind'
const TR_USER_BIND = 'tt_UserID@odata.bind'
const TR_NOTE = process.env.DATAVERSE_FIELD_TR_NOTE || 'tt_note'
const TR_TASK = process.env.DATAVERSE_FIELD_TR_TASK || 'tt_task'

const PROJECT_ENTITY_SET = process.env.DATAVERSE_ENTITY_PROJECT || 'tt_projects'
const PROJECT_ID = process.env.DATAVERSE_FIELD_PROJECT_ID || 'tt_projectid'
const PROJECT_CODE = process.env.DATAVERSE_FIELD_PROJECT_CODE || 'tt_code'
const PROJECT_NAME = process.env.DATAVERSE_FIELD_PROJECT_NAME || 'tt_name'

const USER_ENTITY_SET = process.env.DATAVERSE_ENTITY_CONSULTANT || 'systemusers'

const DEMO_NOTE_PREFIX = '[DEMO-SEED]'
const USER_NAME = 'Test User1'
const USER_UPN = 'TestUser1@developico.com'

const DATE_FROM = '2026-01-01'
const DATE_TO = '2026-04-30'

// Polish public holidays in the range
const HOLIDAYS = new Set([
  '2026-01-01', // New Year
  '2026-01-06', // Epiphany
  '2026-04-05', // Easter Sunday
  '2026-04-06', // Easter Monday
])

// ── Project distribution config ────────────────────────────────────────
// Codes as they appear in Dataverse tt_code field
const PROJECT_DISTRIBUTION: {
  code: string
  targetPct: number
  tasks: string[]
  blockDays?: { min: number; max: number; perQuarter: number }
}[] = [
  {
    code: 'AA.General',
    targetPct: 0.20,
    tasks: ['Admin tasks', 'Client support', 'Internal coordination', 'Email management', 'Reporting'],
  },
  {
    code: 'D.P',
    targetPct: 0.20,
    tasks: ['Sprint planning', 'Feature development', 'Testing', 'Code review', 'Documentation', 'Client demo'],
  },
  {
    code: 'D.Q',
    targetPct: 0.15,
    tasks: ['Quality assurance', 'Test automation', 'Performance testing', 'Regression testing'],
  },
  {
    code: 'D.N',
    targetPct: 0.15,
    tasks: ['Backend development', 'API design', 'Database optimization', 'Integration work'],
  },
  {
    code: 'Office.Meetings',
    targetPct: 0.10,
    tasks: ['Team standup', 'Sprint review', 'Retrospective', 'All-hands meeting', '1-on-1', 'Cross-team sync'],
  },
  {
    code: 'Office.Trainings',
    targetPct: 0.10,
    tasks: ['Azure certification prep', 'React advanced patterns', 'Workshop', 'Knowledge sharing session'],
    blockDays: { min: 2, max: 3, perQuarter: 3 },
  },
  {
    code: 'Office.Absences',
    targetPct: 0.10,
    tasks: ['Annual leave', 'Personal day'],
    blockDays: { min: 2, max: 4, perQuarter: 3 },
  },
]

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

async function dvPost(entitySet: string, body: Record<string, unknown>): Promise<void> {
  const token = await getToken()
  const url = `${DATAVERSE_URL}/api/data/v9.2/${entitySet}`
  const res = await fetch(url, {
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
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST ${entitySet} failed: ${res.status} ${text.slice(0, 300)}`)
  }
}

// ── Lookup helpers ──────────────────────────────────────────────────────
async function findUserId(name: string, upn: string): Promise<string> {
  // Try by fullname first
  let data = await dvGet<{ value: any[] }>(
    USER_ENTITY_SET,
    `$select=systemuserid,fullname&$filter=fullname eq '${name.replace(/'/g, "''")}'&$top=1`
  )
  // Fallback: search by UPN (internalemailaddress)
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

async function findProjectsByCode(codes: string[]): Promise<Map<string, { id: string; name: string }>> {
  const orExpr = codes.map(c => `${PROJECT_CODE} eq '${c.replace(/'/g, "''")}'`).join(' or ')
  const data = await dvGet<{ value: any[] }>(
    PROJECT_ENTITY_SET,
    `$select=${PROJECT_ID},${PROJECT_CODE},${PROJECT_NAME}&$filter=${encodeURIComponent(orExpr)}`
  )
  const map = new Map<string, { id: string; name: string }>()
  for (const p of data.value || []) {
    map.set(p[PROJECT_CODE], { id: p[PROJECT_ID], name: p[PROJECT_NAME] })
    console.log(`  Project: ${p[PROJECT_CODE]} => ${p[PROJECT_NAME]} (${p[PROJECT_ID]})`)
  }
  return map
}

// ── Date utilities ──────────────────────────────────────────────────────
function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6
}

function isHoliday(dateStr: string): boolean {
  return HOLIDAYS.has(dateStr)
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getWorkingDays(from: string, to: string): string[] {
  const days: string[] = []
  const d = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  while (d <= end) {
    const ds = toDateStr(d)
    if (!isWeekend(d) && !isHoliday(ds)) {
      days.push(ds)
    }
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

// ── Random helpers ──────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2
}

function shuffleSlice<T>(arr: T[], count: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

// ── Block scheduling ────────────────────────────────────────────────────
interface BlockSchedule {
  code: string
  days: Set<string>
}

function scheduleBlocks(
  workingDays: string[],
  config: typeof PROJECT_DISTRIBUTION,
  alreadyBlocked: Set<string>,
): BlockSchedule[] {
  const blocks: BlockSchedule[] = []

  for (const proj of config) {
    if (!proj.blockDays) continue
    const schedule: BlockSchedule = { code: proj.code, days: new Set() }

    // Distribute blocks across the quarter
    const blocksToPlace = proj.blockDays.perQuarter
    const chunkSize = Math.floor(workingDays.length / blocksToPlace)

    for (let b = 0; b < blocksToPlace; b++) {
      const blockLen = Math.floor(randBetween(proj.blockDays.min, proj.blockDays.max + 1))
      const chunkStart = b * chunkSize
      const chunkEnd = Math.min((b + 1) * chunkSize - blockLen, workingDays.length - blockLen)
      if (chunkStart >= chunkEnd) continue

      const startIdx = Math.floor(randBetween(chunkStart, chunkEnd))

      let placed = 0
      for (let i = startIdx; i < workingDays.length && placed < blockLen; i++) {
        if (!alreadyBlocked.has(workingDays[i])) {
          schedule.days.add(workingDays[i])
          alreadyBlocked.add(workingDays[i])
          placed++
        }
      }
    }
    blocks.push(schedule)
  }
  return blocks
}

// ── Entry generation ────────────────────────────────────────────────────
interface PlannedEntry {
  date: string
  projectCode: string
  hours: number
  task: string
  note: string
}

function generateEntries(workingDays: string[]): PlannedEntry[] {
  const entries: PlannedEntry[] = []
  const blocked = new Set<string>()

  // 1. Schedule block-based projects (Absences, Trainings)
  const blocks = scheduleBlocks(workingDays, PROJECT_DISTRIBUTION, blocked)
  const blockMap = new Map<string, string>() // date => project code (block owner)
  for (const b of blocks) {
    for (const d of b.days) {
      blockMap.set(d, b.code)
    }
  }

  // 2. Generate entries for each working day
  for (const day of workingDays) {
    const blockCode = blockMap.get(day)

    if (blockCode) {
      // Full-day block entry
      const proj = PROJECT_DISTRIBUTION.find(p => p.code === blockCode)!
      entries.push({
        date: day,
        projectCode: blockCode,
        hours: 8,
        task: pick(proj.tasks),
        note: `${DEMO_NOTE_PREFIX} ${pick(proj.tasks)}`,
      })
      continue
    }

    // Regular day: distribute 8h across non-block projects
    const dailyProjects = PROJECT_DISTRIBUTION.filter(p => !p.blockDays)
    const DAILY_HOURS = 8

    // Calculate base hours proportionally (excluding block projects)
    const totalNonBlockPct = dailyProjects.reduce((s, p) => s + p.targetPct, 0)
    let remaining = DAILY_HOURS
    const dayEntries: PlannedEntry[] = []

    // Occasionally skip 1 project for variability (30% chance)
    const skipOne = Math.random() < 0.3
    const activeProjects = skipOne
      ? shuffleSlice(dailyProjects, dailyProjects.length - 1)
      : dailyProjects

    const activeTotalPct = activeProjects.reduce((s, p) => s + p.targetPct, 0)

    for (let i = 0; i < activeProjects.length; i++) {
      const proj = activeProjects[i]
      const isLast = i === activeProjects.length - 1

      if (isLast) {
        // Last project gets whatever remains
        const hours = roundToHalf(Math.max(0.5, remaining))
        if (hours > 0) {
          dayEntries.push({
            date: day,
            projectCode: proj.code,
            hours,
            task: pick(proj.tasks),
            note: `${DEMO_NOTE_PREFIX} ${pick(proj.tasks)}`,
          })
        }
      } else {
        // Proportional with randomization ±0.5h
        const basePct = proj.targetPct / activeTotalPct
        let hours = roundToHalf(basePct * DAILY_HOURS + randBetween(-0.5, 0.5))
        hours = Math.max(0.5, Math.min(hours, remaining - (activeProjects.length - i - 1) * 0.5))
        hours = roundToHalf(hours)
        remaining -= hours
        dayEntries.push({
          date: day,
          projectCode: proj.code,
          hours,
          task: pick(proj.tasks),
          note: `${DEMO_NOTE_PREFIX} ${pick(proj.tasks)}`,
        })
      }
    }

    entries.push(...dayEntries)
  }

  return entries
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Seed Demo Data ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log(`Period: ${DATE_FROM} – ${DATE_TO}`)
  console.log(`User: ${USER_NAME}`)
  console.log()

  // 1. Resolve IDs from Dataverse
  console.log('Resolving entities from Dataverse...')
  const userId = await findUserId(USER_NAME, USER_UPN)
  const codes = PROJECT_DISTRIBUTION.map(p => p.code)
  const projectMap = await findProjectsByCode(codes)

  // Validate all projects found
  const missing = codes.filter(c => !projectMap.has(c))
  if (missing.length > 0) {
    throw new Error(`Projects not found in Dataverse: ${missing.join(', ')}`)
  }

  // 2. Generate entries
  console.log('\nGenerating time entries...')
  const workingDays = getWorkingDays(DATE_FROM, DATE_TO)
  const entries = generateEntries(workingDays)

  // 3. Summary
  const summary = new Map<string, { count: number; hours: number }>()
  for (const e of entries) {
    const s = summary.get(e.projectCode) || { count: 0, hours: 0 }
    s.count++
    s.hours += e.hours
    summary.set(e.projectCode, s)
  }

  const totalHours = entries.reduce((s, e) => s + e.hours, 0)
  console.log(`\nSummary (${workingDays.length} working days, ${entries.length} entries, ${totalHours}h total):`)
  console.log('─'.repeat(55))
  for (const [code, s] of summary) {
    const pct = ((s.hours / totalHours) * 100).toFixed(1)
    console.log(`  ${code.padEnd(20)} ${s.count.toString().padStart(4)} entries  ${s.hours.toString().padStart(6)}h  (${pct}%)`)
  }
  console.log('─'.repeat(55))

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No records created. Remove --dry-run to write to Dataverse.')
    // Print first 10 entries as sample
    console.log('\nSample entries (first 10):')
    for (const e of entries.slice(0, 10)) {
      console.log(`  ${e.date}  ${e.projectCode.padEnd(20)} ${e.hours}h  "${e.task}"`)
    }
    return
  }

  // 4. Create records in Dataverse
  console.log(`\nCreating ${entries.length} records in Dataverse...`)
  let created = 0
  let failed = 0

  for (const entry of entries) {
    const proj = projectMap.get(entry.projectCode)!
    const body: Record<string, unknown> = {
      [TR_START]: `${entry.date}T09:00:00Z`,
      [TR_DURATION]: entry.hours * 60, // minutes
      [TR_PROJECT_BIND]: `/${PROJECT_ENTITY_SET}(${proj.id})`,
      [TR_USER_BIND]: `/${USER_ENTITY_SET}(${userId})`,
      [TR_NOTE]: entry.note,
    }
    if (TR_TASK) {
      body[TR_TASK] = entry.task
    }

    try {
      await dvPost(TR_ENTITY_SET, body)
      created++
      if (created % 50 === 0) {
        console.log(`  ...${created}/${entries.length} created`)
      }
    } catch (err: any) {
      failed++
      console.error(`  FAIL [${entry.date} ${entry.projectCode}]: ${err.message?.slice(0, 120)}`)
      if (failed > 10) {
        console.error('Too many failures, aborting.')
        break
      }
    }
  }

  console.log(`\nDone! Created: ${created}, Failed: ${failed}`)
}

main().catch((err) => {
  console.error('Fatal:', err.message || err)
  process.exit(1)
})
