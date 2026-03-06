import type { TimeEntry, TimeEntryFilters } from '@/types'
import { DV } from '@/lib/dataverse-config'
import { dataverseClient } from '@/lib/dataverse-client'
import { appLog } from '@/lib/app-logger'
import { odataGuid } from '@/lib/odata-sanitizer'
import { ensureEnabled } from './dataverse-common'

export async function getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]> {
  ensureEnabled()
  const tr = DV.timeRegister
  const fields = [tr.id, tr.startDateTime]
  if (tr.durationMin) fields.push(tr.durationMin)
  fields.push(tr.projectLookup, tr.userLookup)
  if (tr.billable) fields.push(tr.billable)
  fields.push(tr.note)
  if (tr.task) fields.push(tr.task)
  const selects = fields.filter(Boolean).join(',')
  const filters: string[] = []
  const fromIso = `${params.from}T00:00:00Z`
  const toIso = `${params.to}T23:59:59Z`
  filters.push(`${tr.startDateTime} ge ${fromIso} and ${tr.startDateTime} le ${toIso}`)
  if (params.consultantId) {
    const cid = odataGuid(params.consultantId)
    filters.push(`${tr.userLookup} eq ${cid}`)
  }
  if (params.projectIds && params.projectIds.length > 0) {
    const orExpr = params.projectIds.map(id => `${tr.projectLookup} eq ${odataGuid(id)}`).join(' or ')
    filters.push(`(${orExpr})`)
  }
  if (params.billable !== undefined && params.billable !== 'all') {
    filters.push(`${tr.billable} eq ${params.billable ? 1 : 0}`)
  }
  const filter = encodeURIComponent(filters.join(' and '))
  const orderby = `${tr.startDateTime} asc`
  appLog('debug', 'timeentries build', { select: selects, filter: decodeURIComponent(filter), orderby })
  let records: any[] = []
  try {
    const data = await dataverseClient.listAll(tr.entitySet, `$select=${selects}&$filter=${filter}&$orderby=${encodeURIComponent(orderby)}`) as { value?: any[] }
    records = Array.isArray(data.value) ? data.value : []
  } catch (e: any) {
    const msg = e.message || ''
    if (tr.durationMin && msg.includes(tr.durationMin)) {
      return handleDurationFallback(tr, fields, filter, orderby)
    }
    throw e
  }
  const projectBillableMap = await fetchProjectBillable(records.map(r => r[tr.projectLookup]))
  return records.map(r => {
    const projectId = r[tr.projectLookup]
    const rawBillable = tr.billable ? !!r[tr.billable] : !!projectBillableMap[projectId]
    const enforcedBillable = projectBillableMap[projectId] === false ? false : rawBillable
    return {
      id: r[tr.id],
      date: (r[tr.startDateTime] || '').substring(0, 10),
      consultantId: r[tr.userLookup],
      projectId,
      hours: (() => { const raw = r[tr.durationMin] || 0; return /mh$/i.test(tr.durationMin) ? raw : raw / 60 })(),
      billable: enforcedBillable,
      note: r[tr.note] || undefined,
      task: tr.task ? (r[tr.task] || undefined) : undefined,
    }
  })
}

async function handleDurationFallback(
  tr: typeof DV.timeRegister,
  _fields: string[],
  filter: string,
  orderby: string,
): Promise<TimeEntry[]> {
  appLog('warn', 'timeentries duration column missing – attempting fallbacks', { missing: tr.durationMin })
  const baseFields = [tr.id, tr.startDateTime, tr.projectLookup, tr.userLookup]
  if (tr.billable) baseFields.push(tr.billable)
  baseFields.push(tr.note)
  if (tr.task) baseFields.push(tr.task)
  const candidateList = (process.env.DATAVERSE_FIELD_TR_DURATION_CANDIDATES || 'tt_duration,tt_durationmh,tt_minutes,tt_min').split(',').map(s => s.trim()).filter(Boolean)
  let chosen: string | null = null
  let candidateRecords: any[] | null = null
  for (const cand of candidateList) {
    try {
      const sel = [...baseFields, cand].join(',')
      const d2 = await dataverseClient.listAll(tr.entitySet, `$select=${sel}&$filter=${filter}&$orderby=${encodeURIComponent(orderby)}`) as { value?: any[] }
      candidateRecords = Array.isArray(d2.value) ? d2.value : []
      chosen = cand
      appLog('info', 'timeentries duration fallback selected', { column: cand })
      break
    } catch (ee: any) {
      if (ee.message && ee.message.includes(cand)) {
        appLog('debug', 'timeentries duration fallback not found', { cand })
        continue
      }
      throw ee
    }
  }
  if (!candidateRecords) {
    const sel = baseFields.join(',')
    const d3 = await dataverseClient.listAll(tr.entitySet, `$select=${sel}&$filter=${filter}&$orderby=${encodeURIComponent(orderby)}`) as { value?: any[] }
    candidateRecords = Array.isArray(d3.value) ? d3.value : []
    appLog('warn', 'timeentries no duration candidates matched returning zero hours')
  }
  return (candidateRecords || []).map(r => {
    const raw = chosen ? (r[chosen] || 0) : 0
    const hrs = chosen && /mh$/i.test(chosen) ? raw : raw / 60
    return {
      id: r[tr.id],
      date: (r[tr.startDateTime] || '').substring(0, 10),
      consultantId: r[tr.userLookup],
      projectId: r[tr.projectLookup],
      hours: hrs,
      billable: tr.billable ? !!r[tr.billable] : true,
      note: r[tr.note] || undefined,
      task: tr.task ? (r[tr.task] || undefined) : undefined,
    }
  })
}

async function fetchProjectBillable(projectIds: (string | undefined)[]): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {}
  const unique = [...new Set(projectIds.filter(Boolean))] as string[]
  if (!unique.length) return map
  const p = DV.project
  const size = 20
  for (let i = 0; i < unique.length; i += size) {
    const chunk = unique.slice(i, i + size)
    const orExpr = chunk.map(id => `${p.id} eq ${id}`).join(' or ')
    try {
      const projData = await dataverseClient.list(p.entitySet, `$select=${p.id},${p.billable}&$filter=${encodeURIComponent('(' + orExpr + ')')}`) as { value?: any[] }
      for (const pr of (Array.isArray(projData.value) ? projData.value : [])) {
        map[pr[p.id]] = !!pr[p.billable]
      }
    } catch (e: any) {
      appLog('warn', 'timeentries project billable fetch error', { message: e.message })
    }
  }
  return map
}

export async function getProjectAssignments(consultantId: string): Promise<string[]> {
  ensureEnabled()
  const pu = DV.projectUser
  const filter = encodeURIComponent(`${pu.userLookup} eq ${odataGuid(consultantId)}`)
  const select = pu.projectLookup
  appLog('debug', 'assignments query', { entity: pu.entitySet, filter: decodeURIComponent(filter) })
  const data = await dataverseClient.list(pu.entitySet, `$select=${select}&$filter=${filter}`) as { value?: any[] }
  const records: any[] = Array.isArray(data.value) ? data.value : []
  const ids = new Set<string>()
  for (const r of records) {
    const pid = r[pu.projectLookup]
    if (pid) ids.add(pid)
  }
  appLog('debug', 'assignments result', { count: ids.size })
  return [...ids]
}

export async function getProjectTeam(projectId: string): Promise<string[]> {
  ensureEnabled()
  const pu = DV.projectUser
  const filter = encodeURIComponent(`${pu.projectLookup} eq ${odataGuid(projectId)}`)
  const select = pu.userLookup
  appLog('debug', 'project team query', { entity: pu.entitySet, filter: decodeURIComponent(filter) })
  const data = await dataverseClient.list(pu.entitySet, `$select=${select}&$filter=${filter}`) as { value?: any[] }
  const records: any[] = Array.isArray(data.value) ? data.value : []
  const ids = new Set<string>()
  for (const r of records) {
    const uid = r[pu.userLookup]
    if (uid) ids.add(uid)
  }
  appLog('debug', 'project team result', { count: ids.size })
  return [...ids]
}

export async function getDaysOff(from: string, to: string): Promise<{ date: string; name?: string }[]> {
  ensureEnabled()
  const d = DV.daysOff
  const dateField = d.date
  const filter = encodeURIComponent(`${dateField} ge ${from} and ${dateField} le ${to}`)
  const select = [d.id, d.date, d.name].join(',')
  const data = await dataverseClient.list(d.entitySet, `$select=${select}&$filter=${filter}`) as { value?: any[] }
  const records: any[] = Array.isArray(data.value) ? data.value : []
  return records.map(r => ({ date: r[d.date]?.substring(0, 10), name: r[d.name] }))
}
