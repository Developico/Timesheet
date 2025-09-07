export interface Consultant {
  id: string
  name: string
  email?: string
  avatarUrl?: string
}

export interface Project {
  id: string
  code: string
  client: string
  name: string
  meta?: string
  note?: string
  billable: boolean
  assigned: boolean
  color: string
}

export interface TimeEntry {
  id: string
  date: string // ISO date string (YYYY-MM-DD)
  consultantId: string
  projectId: string
  hours: number
  billable: boolean
  note?: string
}

export interface TimeEntryFilters {
  from: string
  to: string
  consultantId?: string
  projectIds?: string[]
  billable?: boolean | "all"
}

export interface KPIMetrics {
  reportedHours: number
  requiredHours: number
  realizedPercentage: number
  billableHours: number
  billablePercentage: number
  activeProjects: number
}

export interface ProjectMetrics {
  projectId: string
  projectName: string
  projectCode: string
  totalHours: number
  billableHours: number
  percentage: number
  color: string
}
