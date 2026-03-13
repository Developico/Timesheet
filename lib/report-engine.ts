import type { TimeEntry, Project, Consultant } from '@/types'
import type { ReportParams, ReportResult, ReportRow, ReportSummary, TaskDetail } from '@/types/reports'

/**
 * Pure aggregation engine — takes raw data + params and returns a ReportResult.
 * No side effects, no data fetching.
 */
export function aggregateReport(
  entries: TimeEntry[],
  projects: Project[],
  consultants: Consultant[],
  params: ReportParams,
): ReportResult {
  const projectMap = new Map(projects.map(p => [p.id, p]))
  const consultantMap = new Map(consultants.map(c => [c.id, c]))

  // 1. Filter by billable
  let filtered = entries
  if (params.billable === 'billable') {
    filtered = filtered.filter(e => e.billable)
  } else if (params.billable === 'non-billable') {
    filtered = filtered.filter(e => !e.billable)
  }

  // 2. Filter by explicit project/consultant IDs
  if (params.projectIds && params.projectIds.length > 0) {
    const set = new Set(params.projectIds)
    filtered = filtered.filter(e => set.has(e.projectId))
  }
  if (params.consultantIds && params.consultantIds.length > 0) {
    const set = new Set(params.consultantIds)
    filtered = filtered.filter(e => set.has(e.consultantId))
  }

  // 3. Group
  const groups = new Map<string, { label: string; entries: TimeEntry[]; meta: Partial<ReportRow> }>()

  for (const entry of filtered) {
    let key: string
    let label: string
    let meta: Partial<ReportRow> = {}

    switch (params.groupBy) {
      case 'consultant': {
        key = entry.consultantId
        const c = consultantMap.get(entry.consultantId)
        label = c?.name ?? entry.consultantId
        meta = { consultantName: label }
        break
      }
      case 'project': {
        key = entry.projectId
        const p = projectMap.get(entry.projectId)
        label = p ? `${p.code} — ${p.name}` : entry.projectId
        meta = { projectCode: p?.code, clientName: p?.client }
        break
      }
      case 'client': {
        const p = projectMap.get(entry.projectId)
        key = p?.client ?? 'Unknown'
        label = key
        meta = { clientName: key }
        break
      }
    }

    const group = groups.get(key)
    if (group) {
      group.entries.push(entry)
    } else {
      groups.set(key, { label, entries: [entry], meta })
    }
  }

  // 4. Compute rows
  const rows: ReportRow[] = []
  for (const [groupKey, { label, entries: groupEntries, meta }] of groups) {
    const totalHours = round(groupEntries.reduce((s, e) => s + e.hours, 0))
    const billableHours = round(groupEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0))
    const nonBillableHours = round(totalHours - billableHours)

    let taskDetails: TaskDetail[] | undefined
    if (params.includeTasks) {
      taskDetails = groupEntries.map(e => ({
        task: e.task ?? '(no task)',
        date: e.date,
        consultantName: consultantMap.get(e.consultantId)?.name ?? e.consultantId,
        hours: e.hours,
        billable: e.billable,
      }))
      taskDetails.sort((a, b) => a.date.localeCompare(b.date) || a.task.localeCompare(b.task))
    }

    rows.push({
      groupKey,
      groupLabel: label,
      totalHours,
      billableHours,
      nonBillableHours,
      billablePercentage: totalHours > 0 ? round((billableHours / totalHours) * 100) : 0,
      entryCount: groupEntries.length,
      ...meta,
      ...(taskDetails ? { taskDetails } : {}),
    })
  }

  // 5. Sort descending by totalHours
  rows.sort((a, b) => b.totalHours - a.totalHours)

  // 6. Summary
  const summary: ReportSummary = {
    totalHours: round(rows.reduce((s, r) => s + r.totalHours, 0)),
    billableHours: round(rows.reduce((s, r) => s + r.billableHours, 0)),
    nonBillableHours: round(rows.reduce((s, r) => s + r.nonBillableHours, 0)),
    billablePercentage: 0,
    uniqueProjects: new Set(filtered.map(e => e.projectId)).size,
    uniqueConsultants: new Set(filtered.map(e => e.consultantId)).size,
  }
  summary.billablePercentage =
    summary.totalHours > 0 ? round((summary.billableHours / summary.totalHours) * 100) : 0

  return {
    params,
    rows,
    summary,
    generatedAt: new Date().toISOString(),
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
