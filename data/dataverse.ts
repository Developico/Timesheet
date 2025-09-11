import type { IDataSource } from "./interfaces"
import type { Consultant, Project, TimeEntry, TimeEntryFilters } from "@/types"
import { DV } from "@/lib/dataverse-config"
import { dataverseClient } from "@/lib/dataverse-client"
import { appLog } from '@/lib/app-logger'

// Basic color palette for deterministic color assignment
const PROJECT_COLORS = ["#01EED4", "#6366f1", "#f59e0b", "#dc2626", "#6B7280", "#10b981", "#8b5cf6"]
const colorCache = new Map<string, string>()
function assignColor(id: string) {
  if (colorCache.has(id)) return colorCache.get(id) as string
  const color = PROJECT_COLORS[colorCache.size % PROJECT_COLORS.length]
  colorCache.set(id, color)
  return color
}

export class DataverseDataSource implements IDataSource {
  private ensureEnabled() {
  if (!DV.baseUrl) throw new Error("Dataverse disabled: DATAVERSE_URL not set")
  }

  async getConsultants(): Promise<Consultant[]> {
    this.ensureEnabled()
  // Pull systemusers (no statecode filter; systemusers doesn't expose statecode OData field in this env)
  const consultantSelectFields = [DV.consultant.id, DV.consultant.fullName, DV.consultant.email, DV.consultant.azureAdObjectId]
  if (DV.consultant.avatar) consultantSelectFields.push(DV.consultant.avatar)
  const select = consultantSelectFields.join(",")
  const data = await dataverseClient.list(DV.consultant.entitySet, `$select=${select}&$orderby=${DV.consultant.fullName} asc`)
    const records: any[] = data.value || []
    return records.map((r) => ({
      id: r[DV.consultant.id],
      name: r[DV.consultant.fullName],
      email: r[DV.consultant.email],
  avatarUrl: DV.consultant.avatar ? (r[DV.consultant.avatar] || undefined) : undefined,
  aadObjectId: r[DV.consultant.azureAdObjectId] || undefined,
    }))
  }

  async getProjects(currentConsultantId?: string): Promise<Project[]> {
    this.ensureEnabled()
    const s = DV.project
  const projectSelectFields = [s.id, s.name, s.code, s.client, s.billable]
  if (s.allUsers) projectSelectFields.push(s.allUsers)
  if (s.meta && s.meta !== 'tt_metaprojectname') projectSelectFields.push(s.meta) // skip default meta if overridden to same missing value
  if (s.meta && s.meta === 'tt_metaprojectname' && process.env.DATAVERSE_FIELD_PROJECT_META) projectSelectFields.push(s.meta)
  projectSelectFields.push(s.note, s.createdOn)
  const select = projectSelectFields.filter(Boolean).join(",")
    const filter = `${s.stateCode} eq 0`
    let records: any[] = []
    try {
      const data = await dataverseClient.list(s.entitySet, `$select=${select}&$filter=${encodeURIComponent(filter)}`)
      records = data.value || []
    } catch(e:any) {
      const msg = e.message||''
      if (s.allUsers && msg.includes(s.allUsers)) {
        // Retry without allUsers field
        const fallbackSelect = projectSelectFields.filter(f=>f!==s.allUsers).join(',')
        const data2 = await dataverseClient.list(s.entitySet, `$select=${fallbackSelect}&$filter=${encodeURIComponent(filter)}`)
        records = data2.value || []
      } else throw e
    }
    let assignmentSet: Set<string> | null = null
    if (currentConsultantId) {
      try {
        const assigned = await this.getProjectAssignments(currentConsultantId)
        assignmentSet = new Set(assigned)
      } catch {/* ignore */}
    }
    return records.map((r) => {
      // AllUsers field (two options / boolean). Treat 1 / true / '1' as enabled.
      const rawAll = s.allUsers ? r[s.allUsers] : undefined
      const allUsers = rawAll === 1 || rawAll === true || rawAll === '1'
      const assigned = allUsers ? true : (assignmentSet ? assignmentSet.has(r[s.id]) : true)
      return {
        id: r[s.id],
        code: r[s.code],
        client: r[s.client] || "",
        name: r[s.name] || "(No Name)",
        meta: r[s.meta] || undefined,
        note: r[s.note] || undefined,
        billable: !!r[s.billable],
        assigned,
        allUsers,
        color: assignColor(r[s.id]),
      }
    })
  }

  async getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]> {
    this.ensureEnabled()
    const tr = DV.timeRegister
  const timeSelectFields = [tr.id, tr.startDateTime]
  if (tr.durationMin) timeSelectFields.push(tr.durationMin)
  timeSelectFields.push(tr.projectLookup, tr.userLookup)
  if (tr.billable) timeSelectFields.push(tr.billable)
  timeSelectFields.push(tr.note)
  if (tr.task) timeSelectFields.push(tr.task)
  const selects = timeSelectFields.filter(Boolean).join(",")
    const filters: string[] = []
    // Date filter: convert date (YYYY-MM-DD) into bounds (inclusive start, inclusive end 23:59)
    const fromIso = `${params.from}T00:00:00Z`
    const toIso = `${params.to}T23:59:59Z`
    filters.push(`${tr.startDateTime} ge ${fromIso} and ${tr.startDateTime} le ${toIso}`)
    if (params.consultantId) {
      const cid = params.consultantId
      const quoted = /^[0-9a-fA-F-]{36}$/.test(cid) ? cid : cid
      // Dataverse OData GUID equality: value can be plain GUID without braces, but wrap in quotes if non hex chars
      filters.push(`${tr.userLookup} eq ${quoted}`)
    }
    if (params.projectIds && params.projectIds.length > 0) {
      // OData lacks direct IN; build (a eq x or a eq y ...)
  const orExpr = params.projectIds.map((id) => `${tr.projectLookup} eq ${id}`).join(" or ")
      filters.push(`(${orExpr})`)
    }
    if (params.billable !== undefined && params.billable !== "all") {
      filters.push(`${tr.billable} eq ${params.billable ? 1 : 0}`)
    }
    const filter = encodeURIComponent(filters.join(" and "))
    appLog('debug','timeentries build',{ select: selects, filter: decodeURIComponent(filter) })
  let data: any
  let records: any[] = []
    try {
      data = await dataverseClient.list(tr.entitySet, `$select=${selects}&$filter=${filter}`)
      records = data.value || []
    } catch (e:any) {
      const msg = e.message || ''
      // Retry without duration field if that's the cause
      if (tr.durationMin && msg.includes(tr.durationMin)) {
        appLog('warn','timeentries duration column missing – attempting fallbacks',{ missing: tr.durationMin })
        // Base fields without duration
  const baseFields = [tr.id, tr.startDateTime, tr.projectLookup, tr.userLookup]
        if (tr.billable) baseFields.push(tr.billable)
  baseFields.push(tr.note)
  if (tr.task) baseFields.push(tr.task)
  const candidateList = (process.env.DATAVERSE_FIELD_TR_DURATION_CANDIDATES || 'tt_durationminutes,tt_durationmh,tt_duration,tt_minutes,tt_min').split(',').map(s=>s.trim()).filter(Boolean)
        let chosen: string | null = null
        let candidateRecords: any[] | null = null
        for (const cand of candidateList) {
          try {
            const sel = [...baseFields, cand].join(',')
            const d2 = await dataverseClient.list(tr.entitySet, `$select=${sel}&$filter=${filter}`)
            candidateRecords = d2.value || []
            chosen = cand
            appLog('info','timeentries duration fallback selected',{ column: cand })
            break
          } catch (ee:any) {
            if (ee.message && ee.message.includes(cand)) {
              appLog('debug','timeentries duration fallback not found',{ cand })
              continue
            } else {
              throw ee
            }
          }
        }
        // If none succeeded, do one query without any candidate to at least return skeleton rows
        if (!candidateRecords) {
          const sel = baseFields.join(',')
          const d3 = await dataverseClient.list(tr.entitySet, `$select=${sel}&$filter=${filter}`)
          candidateRecords = d3.value || []
          appLog('warn','timeentries no duration candidates matched returning zero hours')
        }
  return (candidateRecords || []).map(r=>{
          const raw = chosen ? (r[chosen] || 0) : 0
          // Heuristic: fields ending with 'mh' already in hours (man-hours); others assumed minutes
          const hrs = chosen && /mh$/i.test(chosen) ? raw : raw / 60
          return {
            id: r[tr.id],
            date: (r[tr.startDateTime] || '').substring(0,10),
            consultantId: r[tr.userLookup],
            projectId: r[tr.projectLookup],
            hours: hrs,
            billable: tr.billable ? !!r[tr.billable] : true,
            note: r[tr.note] || undefined,
            task: tr.task ? (r[tr.task] || undefined) : undefined,
          }
        })
      }
      throw e
    }
    // Derive billable from related project if timeregister has no billable column
    let projectBillableMap: Record<string, boolean> = {}
    if (!tr.billable) {
      const uniqueProjectIds = [...new Set(records.map(r=>r[tr.projectLookup]).filter(Boolean))]
      if (uniqueProjectIds.length) {
        const p = DV.project
        const chunks: string[][] = []
        const size = 20 // avoid overly long OData filter
        for (let i=0;i<uniqueProjectIds.length;i+=size) chunks.push(uniqueProjectIds.slice(i,i+size))
        for (const chunk of chunks) {
          const orExpr = chunk.map(id=>`${p.id} eq ${id}`).join(' or ')
          try {
            const projData = await dataverseClient.list(p.entitySet, `$select=${p.id},${p.billable}&$filter=${encodeURIComponent('('+orExpr+')')}`)
            for (const pr of projData.value || []) {
              projectBillableMap[pr[p.id]] = !!pr[p.billable]
            }
          } catch(e:any) {
            appLog('warn','timeentries project billable fetch error',{ message: e.message })
          }
        }
      }
    }
    return records.map((r) => {
      const projectId = r[tr.projectLookup]
      const billable = tr.billable ? !!r[tr.billable] : !!projectBillableMap[projectId]
      return {
        id: r[tr.id],
        date: (r[tr.startDateTime] || "").substring(0, 10),
        consultantId: r[tr.userLookup],
        projectId,
  hours: (()=>{ const raw = r[tr.durationMin] || 0; return /mh$/i.test(tr.durationMin) ? raw : raw / 60 })(),
        billable,
  note: r[tr.note] || undefined,
  task: tr.task ? (r[tr.task] || undefined) : undefined,
      }
    })
  }

  async getProjectAssignments(consultantId: string): Promise<string[]> {
    this.ensureEnabled()
    const pu = DV.projectUser
    // Filter by user lookup; GUIDs in Dataverse filters should be presented without braces
    const filter = encodeURIComponent(`${pu.userLookup} eq ${consultantId}`)
    const select = pu.projectLookup
  appLog('debug','assignments query',{ entity: pu.entitySet, filter: decodeURIComponent(filter) })
  const data = await dataverseClient.list(pu.entitySet, `$select=${select}&$filter=${filter}`)
    const records: any[] = data.value || []
    const ids = new Set<string>()
    for (const r of records) {
      const pid = r[pu.projectLookup]
      if (pid) ids.add(pid)
    }
  appLog('debug','assignments result',{ count: ids.size })
    return [...ids]
  }

  async getProjectTeam(projectId: string): Promise<string[]> {
    this.ensureEnabled()
    const pu = DV.projectUser
    // Filter by project lookup; GUIDs in Dataverse filters should be presented without braces
    const filter = encodeURIComponent(`${pu.projectLookup} eq ${projectId}`)
    const select = pu.userLookup
    appLog('debug','project team query',{ entity: pu.entitySet, filter: decodeURIComponent(filter) })
    const data = await dataverseClient.list(pu.entitySet, `$select=${select}&$filter=${filter}`)
    const records: any[] = data.value || []
    const ids = new Set<string>()
    for (const r of records) {
      const uid = r[pu.userLookup]
      if (uid) ids.add(uid)
    }
    appLog('debug','project team result',{ count: ids.size })
    return [...ids]
  }

  async getDaysOff(from: string, to: string): Promise<{ date: string; name?: string }[]> {
    this.ensureEnabled()
    const d = DV.daysOff
    const dateField = d.date
    const filter = encodeURIComponent(`${dateField} ge ${from} and ${dateField} le ${to}`)
    const select = [d.id, d.date, d.name].join(",")
    const data = await dataverseClient.list(d.entitySet, `$select=${select}&$filter=${filter}`)
    const records: any[] = data.value || []
    return records.map(r=>({ date: r[d.date]?.substring(0,10), name: r[d.name] }))
  }
}

// (Optional) future explicit mapper exports if needed externally
export const mapDataverseProject = () => { /* intentionally minimal for now */ }

