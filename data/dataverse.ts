import type { IDataSource } from "./interfaces"
import type { Consultant, Project, TimeEntry, TimeEntryFilters } from "@/types"
import { DV } from "@/lib/dataverse-config"
import { dataverseClient } from "@/lib/dataverse-client"

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
    if (!DV.baseUrl) throw new Error("Dataverse not configured (DATAVERSE_URL)")
  }

  async getConsultants(): Promise<Consultant[]> {
    this.ensureEnabled()
    // For MVP: pull active users (statecode=0) limited fields
    const select = [DV.consultant.id, DV.consultant.fullName, DV.consultant.email, DV.consultant.avatar].join(",")
    const filter = `${DV.consultant.stateCode} eq 0`
    const data = await dataverseClient.list(DV.consultant.entitySet, `$select=${select}&$filter=${encodeURIComponent(filter)}`)
    const records: any[] = data.value || []
    return records.map((r) => ({
      id: r[DV.consultant.id],
      name: r[DV.consultant.fullName],
      email: r[DV.consultant.email],
      avatarUrl: r[DV.consultant.avatar] || undefined,
    }))
  }

  async getProjects(): Promise<Project[]> {
    this.ensureEnabled()
    const s = DV.project
    const select = [s.id, s.name, s.code, s.client, s.billable, s.meta, s.note, s.createdOn].join(",")
    const filter = `${s.stateCode} eq 0`
    const data = await dataverseClient.list(s.entitySet, `$select=${select}&$filter=${encodeURIComponent(filter)}`)
    const records: any[] = data.value || []
    return records.map((r) => ({
      id: r[s.id],
      code: r[s.code],
      client: r[s.client] || "",
      name: r[s.name] || "(No Name)",
      meta: r[s.meta] || undefined,
      note: r[s.note] || undefined,
      billable: !!r[s.billable],
      assigned: true, // refined later via ProjectUser relation
      color: assignColor(r[s.id]),
    }))
  }

  async getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]> {
    this.ensureEnabled()
    const tr = DV.timeRegister
    const selects = [tr.id, tr.startDateTime, tr.durationMin, tr.projectLookup, tr.userLookup, tr.billable, tr.note].join(",")
    const filters: string[] = []
    // Date filter: convert date (YYYY-MM-DD) into bounds (inclusive start, inclusive end 23:59)
    const fromIso = `${params.from}T00:00:00Z`
    const toIso = `${params.to}T23:59:59Z`
    filters.push(`${tr.startDateTime} ge ${fromIso} and ${tr.startDateTime} le ${toIso}`)
    if (params.consultantId) filters.push(`${tr.userLookup} eq ${params.consultantId}`)
    if (params.projectIds && params.projectIds.length > 0) {
      // OData lacks direct IN; build (a eq x or a eq y ...)
      const orExpr = params.projectIds.map((id) => `${tr.projectLookup} eq ${id}`).join(" or ")
      filters.push(`(${orExpr})`)
    }
    if (params.billable !== undefined && params.billable !== "all") {
      filters.push(`${tr.billable} eq ${params.billable ? 1 : 0}`)
    }
    const filter = encodeURIComponent(filters.join(" and "))
    const data = await dataverseClient.list(tr.entitySet, `$select=${selects}&$filter=${filter}`)
    const records: any[] = data.value || []
    return records.map((r) => ({
      id: r[tr.id],
      date: (r[tr.startDateTime] || "").substring(0, 10),
      consultantId: r[tr.userLookup],
      projectId: r[tr.projectLookup],
      hours: (r[tr.durationMin] || 0) / 60,
      billable: !!r[tr.billable],
      note: r[tr.note] || undefined,
    }))
  }

  async getProjectAssignments(consultantId: string): Promise<string[]> {
    this.ensureEnabled()
    const pu = DV.projectUser
    // Filter by user lookup; GUIDs in Dataverse filters should be presented without braces
    const filter = encodeURIComponent(`${pu.userLookup} eq ${consultantId}`)
    const select = pu.projectLookup
    const data = await dataverseClient.list(pu.entitySet, `$select=${select}&$filter=${filter}`)
    const records: any[] = data.value || []
    const ids = new Set<string>()
    for (const r of records) {
      const pid = r[pu.projectLookup]
      if (pid) ids.add(pid)
    }
    return [...ids]
  }
}

// (Optional) future explicit mapper exports if needed externally
export const mapDataverseProject = () => { /* intentionally minimal for now */ }

