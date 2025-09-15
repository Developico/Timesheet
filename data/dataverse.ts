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
    // Pull consultants (system users). Robust fallback logic for environment discrepancies:
    // 1. entitySet must be plural 'systemusers'. If misconfigured to 'systemuser' or custom singular, retry with plural.
    // 2. Optional columns (statecode, avatar) may be absent; on 400 remove and retry.
    // 3. We always return a list; unknown optional fields won't break the endpoint.
    const baseEntitySet = DV.consultant.entitySet
    const candidateEntitySets = [baseEntitySet]
    if (!/s$/i.test(baseEntitySet)) candidateEntitySets.push(baseEntitySet + 's')
    if (baseEntitySet.toLowerCase() !== 'systemusers') candidateEntitySets.push('systemusers')

    let lastError: any = null
    for (const entitySet of candidateEntitySets) {
      let wantState = !!DV.consultant.stateCode
      let wantAvatar = !!DV.consultant.avatar
      let wantDisabled = !!DV.consultant.disabledFlag
      let wantAccessMode = !!DV.consultant.accessMode
      // Inner retry loop for dropping optional columns that cause 400
      for (let attempt = 0; attempt < 3; attempt++) {
        const consultantSelectFields = [DV.consultant.id, DV.consultant.fullName, DV.consultant.email, DV.consultant.azureAdObjectId]
        if (wantDisabled) consultantSelectFields.push(DV.consultant.disabledFlag as string)
        if (wantAccessMode) consultantSelectFields.push(DV.consultant.accessMode as string)
        if (wantState) consultantSelectFields.push(DV.consultant.stateCode as string)
        if (wantAvatar) consultantSelectFields.push(DV.consultant.avatar as string)
        const select = consultantSelectFields.filter(Boolean).join(',')
        try {
          const data = await dataverseClient.list(entitySet, `$select=${select}&$orderby=${DV.consultant.fullName} asc`) as { value?: any[] }
          const records: any[] = Array.isArray(data.value) ? data.value : []
          return records.map(r => {
            const disabledVal = wantDisabled ? r[DV.consultant.disabledFlag as string] : undefined
            const accessModeVal = wantAccessMode ? r[DV.consultant.accessMode as string] : undefined
            const stateVal = wantState ? r[DV.consultant.stateCode as string] : undefined
            // Derive isActive precedence: explicit disabled flag (boolean/1) -> access mode (3=Administrative/4=ReadOnly/Disabled?) -> statecode
            let isActive = true
            if (disabledVal !== undefined) {
              // disabled true / 1 / '1' => inactive
              isActive = !(disabledVal === true || disabledVal === 1 || disabledVal === '1')
            } else if (accessModeVal !== undefined) {
              // Some orgs: 0=Read-Write, 1=Administrative, 2=Read-Only, 3=Support User, 4=Non-interactive, 5=Portal? (Treat >1 as potentially inactive except 4 if needed)
              // Keep simple: treat accessmode 2 (Read-Only) as inactive and 4 (Non-interactive) as inactive for project allocation UI.
              if (accessModeVal === 2 || accessModeVal === '2' || accessModeVal === 4 || accessModeVal === '4') isActive = false
            } else if (stateVal !== undefined) {
              isActive = stateVal === 0 || stateVal === 'Active' || stateVal === '0'
            }
            return {
              id: r[DV.consultant.id],
              name: r[DV.consultant.fullName],
              email: r[DV.consultant.email],
              avatarUrl: wantAvatar ? (r[DV.consultant.avatar as string] || undefined) : undefined,
              aadObjectId: r[DV.consultant.azureAdObjectId] || undefined,
              isActive,
            }
          })
        } catch (e: any) {
          lastError = e
          const msg = e?.message || ''
          // 404 => try next entitySet
          if (/404/.test(msg) || /Resource not found/i.test(msg)) break
          // 400 with missing property: drop that column and retry
          if (/Could not find a property named/.test(msg)) {
            if (wantDisabled && DV.consultant.disabledFlag && msg.includes(DV.consultant.disabledFlag)) { wantDisabled = false; continue }
            if (wantAccessMode && DV.consultant.accessMode && msg.includes(DV.consultant.accessMode)) { wantAccessMode = false; continue }
            if (wantAvatar && DV.consultant.avatar && msg.includes(DV.consultant.avatar)) { wantAvatar = false; continue }
            // statecode may be entirely absent in environment
            if (wantState && msg.includes(DV.consultant.stateCode || 'statecode')) { wantState = false; continue }
          }
          // Other errors - do not retry this entitySet
          break
        }
      }
    }
    // If all attempts failed, rethrow last error (will be turned into 500 by route)
    if (lastError) throw lastError
    return []
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
  const data = await dataverseClient.list(s.entitySet, `$select=${select}&$filter=${encodeURIComponent(filter)}`) as { value?: any[] }
  records = Array.isArray(data.value) ? data.value : []
    } catch(e:any) {
      const msg = e.message||''
      if (s.allUsers && msg.includes(s.allUsers)) {
        // Retry without allUsers field if it's missing in environment
        const fallbackSelect = projectSelectFields.filter(f=>f!==s.allUsers).join(',')
        const data2 = await dataverseClient.list(s.entitySet, `$select=${fallbackSelect}&$filter=${encodeURIComponent(filter)}`) as { value?: any[] }
        records = Array.isArray(data2.value) ? data2.value : []
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
  data = await dataverseClient.list(tr.entitySet, `$select=${selects}&$filter=${filter}`) as { value?: any[] }
  records = Array.isArray(data.value) ? data.value : []
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
            const d2 = await dataverseClient.list(tr.entitySet, `$select=${sel}&$filter=${filter}`) as { value?: any[] }
            candidateRecords = Array.isArray(d2.value) ? d2.value : []
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
          const d3 = await dataverseClient.list(tr.entitySet, `$select=${sel}&$filter=${filter}`) as { value?: any[] }
          candidateRecords = Array.isArray(d3.value) ? d3.value : []
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
            const projData = await dataverseClient.list(p.entitySet, `$select=${p.id},${p.billable}&$filter=${encodeURIComponent('('+orExpr+')')}`) as { value?: any[] }
            for (const pr of (Array.isArray(projData.value) ? projData.value : [])) {
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
  const data = await dataverseClient.list(pu.entitySet, `$select=${select}&$filter=${filter}`) as { value?: any[] }
    const records: any[] = Array.isArray(data.value) ? data.value : []
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
  const data = await dataverseClient.list(pu.entitySet, `$select=${select}&$filter=${filter}`) as { value?: any[] }
  const records: any[] = Array.isArray(data.value) ? data.value : []
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
  const data = await dataverseClient.list(d.entitySet, `$select=${select}&$filter=${filter}`) as { value?: any[] }
  const records: any[] = Array.isArray(data.value) ? data.value : []
    return records.map(r=>({ date: r[d.date]?.substring(0,10), name: r[d.name] }))
  }
}

// (Optional) future explicit mapper exports if needed externally
export const mapDataverseProject = () => { /* intentionally minimal for now */ }

