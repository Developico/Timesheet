export interface ReportParams {
  dateFrom: string // ISO date YYYY-MM-DD
  dateTo: string // ISO date YYYY-MM-DD
  groupBy: 'consultant' | 'project' | 'client'
  projectIds?: string[]
  consultantIds?: string[]
  billable?: 'all' | 'billable' | 'non-billable'
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
