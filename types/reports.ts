export interface ReportParams {
  dateFrom: string // ISO date YYYY-MM-DD
  dateTo: string // ISO date YYYY-MM-DD
  groupBy: 'consultant' | 'project' | 'client'
  projectIds?: string[]
  consultantIds?: string[]
  billable?: 'all' | 'billable' | 'non-billable'
  includeTasks?: boolean
}

export interface TaskDetail {
  task: string
  date: string
  consultantName: string
  hours: number
  billable: boolean
}

export interface TaskGroupSummary {
  task: string
  totalHours: number
  billableHours: number
  nonBillableHours: number
  entryCount: number
}

export function groupTaskDetails(details: TaskDetail[]): TaskGroupSummary[] {
  const map = new Map<string, TaskGroupSummary>()
  for (const td of details) {
    const existing = map.get(td.task)
    if (existing) {
      existing.totalHours = Math.round((existing.totalHours + td.hours) * 100) / 100
      existing.billableHours = Math.round((existing.billableHours + (td.billable ? td.hours : 0)) * 100) / 100
      existing.nonBillableHours = Math.round((existing.nonBillableHours + (td.billable ? 0 : td.hours)) * 100) / 100
      existing.entryCount++
    } else {
      map.set(td.task, {
        task: td.task,
        totalHours: td.hours,
        billableHours: td.billable ? td.hours : 0,
        nonBillableHours: td.billable ? 0 : td.hours,
        entryCount: 1,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours)
}

export interface ReportRow {
  groupKey: string
  groupLabel: string
  totalHours: number
  billableHours: number
  nonBillableHours: number
  billablePercentage: number
  entryCount: number
  projectCode?: string
  clientName?: string
  consultantName?: string
  taskDetails?: TaskDetail[]
}

export interface ReportSummary {
  totalHours: number
  billableHours: number
  nonBillableHours: number
  billablePercentage: number
  uniqueProjects: number
  uniqueConsultants: number
}

export interface ReportResult {
  params: ReportParams
  rows: ReportRow[]
  summary: ReportSummary
  generatedAt: string // ISO timestamp
}
