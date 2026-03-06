import type { ReportParams } from '@/types/reports'

export interface ReportPreset {
  id: string
  label: string
  description: string
  icon: string // lucide icon name
  /** Returns params with dynamically computed dates */
  getParams: () => Partial<ReportParams>
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentWeekRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  return { dateFrom: fmt(monday), dateTo: fmt(friday) }
}

function currentMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { dateFrom: fmt(start), dateTo: fmt(end) }
}

function previousMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  return { dateFrom: fmt(start), dateTo: fmt(end) }
}

export const REPORT_PRESETS: ReportPreset[] = [
  {
    id: 'weekly-consultant',
    label: 'Weekly by Consultant',
    description: 'Hours breakdown per consultant for the current week',
    icon: 'Users',
    getParams: () => ({
      ...currentWeekRange(),
      groupBy: 'consultant' as const,
    }),
  },
  {
    id: 'monthly-project',
    label: 'Monthly by Project',
    description: 'Project hours and billable ratio for the current month',
    icon: 'FolderKanban',
    getParams: () => ({
      ...currentMonthRange(),
      groupBy: 'project' as const,
    }),
  },
  {
    id: 'team-utilization',
    label: 'Team Utilization',
    description: 'Billable percentage per consultant for the current month',
    icon: 'BarChart3',
    getParams: () => ({
      ...currentMonthRange(),
      groupBy: 'consultant' as const,
      billable: 'all' as const,
    }),
  },
  {
    id: 'billing-summary',
    label: 'Billing Summary',
    description: 'Billable hours grouped by client for invoicing',
    icon: 'Receipt',
    getParams: () => ({
      ...previousMonthRange(),
      groupBy: 'client' as const,
      billable: 'billable' as const,
    }),
  },
]
