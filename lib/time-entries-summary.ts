import type { TimeEntry } from "@/types"

export interface TimeEntriesSummary {
  total: number
  billable: number
  nonBillable: number
  absence: number
}

export interface DailySummary extends TimeEntriesSummary {
  date: string
}

// Absence project heuristic centralised here
export function isAbsenceProject(projectId: string, projectCode?: string, projectName?: string): boolean {
  const code = projectCode || projectId
  const name = (projectName || '').toLowerCase()
  return projectId === 'Office.Absences' || code === 'Office.Absences' || code === 'ABS' || name.includes('absence')
}

export function summarize(entries: TimeEntry[]): TimeEntriesSummary {
  let total = 0, billable = 0, absence = 0
  for (const e of entries) {
    total += e.hours
    if (isAbsenceProject(e.projectId)) {
      absence += e.hours
      continue
    }
    if (e.billable) billable += e.hours
  }
  const nonBillable = total - billable - absence
  return roundSummary({ total, billable, nonBillable, absence })
}

export function summarizeByDay(entries: TimeEntry[]): Record<string, DailySummary> {
  const map: Record<string, DailySummary> = {}
  for (const e of entries) {
    if (!map[e.date]) map[e.date] = { date: e.date, total: 0, billable: 0, nonBillable: 0, absence: 0 }
    const day = map[e.date]
    day.total += e.hours
    if (isAbsenceProject(e.projectId)) day.absence += e.hours
    else if (e.billable) day.billable += e.hours
  }
  for (const d of Object.values(map)) {
    d.nonBillable = d.total - d.billable - d.absence
    roundSummaryMut(d)
  }
  return map
}

function roundSummary(s: TimeEntriesSummary): TimeEntriesSummary {
  return {
    total: round1(s.total),
    billable: round1(s.billable),
    nonBillable: round1(s.nonBillable),
    absence: round1(s.absence),
  }
}
function roundSummaryMut(s: TimeEntriesSummary){
  s.total = round1(s.total)
  s.billable = round1(s.billable)
  s.nonBillable = round1(s.nonBillable)
  s.absence = round1(s.absence)
}
function round1(n: number){ return Math.round(n * 10) / 10 }

// Small helper to derive percentages safely
export function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}
