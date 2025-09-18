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
  const codeRaw = projectCode || projectId
  const code = (codeRaw || '').toString().toLowerCase()
  const name = (projectName || '').toString().toLowerCase()

  // Handle common identifiers and naming variants
  // - Explicit id/code match
  if (projectId === 'Office.Absences') return true
  if (codeRaw === 'Office.Absences') return true
  if (code === 'abs') return true

  // - Substring heuristics across languages
  //   'absence', 'absences', 'vacation', 'holiday', 'leave', 'urlop' (PL)
  const tokens = [code, name]
  return tokens.some(t => t.includes('absence') || t.includes('absences') || t.includes('vacation') || t.includes('holiday') || t.includes('leave') || t.includes('urlop'))
}

export function summarize(entries: TimeEntry[]): TimeEntriesSummary {
  let total = 0, billable = 0, absence = 0
  for (const e of entries) {
    total += e.hours
    // Try to use attached project metadata if present (calendar and charts may pass it through)
    const proj: any = (e as any).project
    const projCode: string | undefined = proj?.code ?? (e as any).projectCode
    const projName: string | undefined = proj?.name ?? (e as any).projectName
    if (isAbsenceProject(e.projectId, projCode, projName)) {
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
    // Use richer project metadata when available
    const proj: any = (e as any).project
    const projCode: string | undefined = proj?.code ?? (e as any).projectCode
    const projName: string | undefined = proj?.name ?? (e as any).projectName
    if (isAbsenceProject(e.projectId, projCode, projName)) day.absence += e.hours
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
