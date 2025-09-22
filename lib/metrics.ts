import type { TimeEntry, KPIMetrics, ProjectMetrics } from "@/types"
import { summarize, summarizeByDay, toPercent } from "@/lib/time-entries-summary"

// Import round2 function for 2-decimal precision
function round2(n: number){ return Math.round(n * 100) / 100 }

export function getWorkingDays(from: string, to: string): number {
  const startDate = new Date(from)
  const endDate = new Date(to)
  let workingDays = 0

  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay()
    // Monday = 1, Friday = 5 (exclude weekends)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workingDays++
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return workingDays
}

export function calculateKPIMetrics(timeEntries: TimeEntry[], from: string, to: string): KPIMetrics {
  const workingDays = getWorkingDays(from, to)
  const requiredHours = workingDays * 8

  const agg = summarize(timeEntries)
  const reportedHours = agg.total
  const billableHours = agg.billable

  const realizedPercentage = requiredHours > 0 ? (reportedHours / requiredHours) * 100 : 0
  const billablePercentage = reportedHours > 0 ? (billableHours / reportedHours) * 100 : 0

  // Count unique projects
  const activeProjects = new Set(timeEntries.map((entry) => entry.projectId)).size

  return {
    reportedHours: round2(reportedHours),
    requiredHours,
    realizedPercentage: round2(realizedPercentage),
    billableHours: round2(billableHours),
    billablePercentage: round2(billablePercentage),
    activeProjects,
  }
}

export function calculateProjectMetrics(
  timeEntries: TimeEntry[],
  projects: { id: string; name: string; code: string; color: string }[],
  topN = 5,
): ProjectMetrics[] {
  const projectHours = new Map<string, { total: number; billable: number }>()
  for (const e of timeEntries) {
    let ph = projectHours.get(e.projectId)
    if (!ph) { ph = { total: 0, billable: 0 }; projectHours.set(e.projectId, ph) }
    ph.total += e.hours
    if (e.billable) ph.billable += e.hours
  }
  const totalHours = summarize(timeEntries).total

  // Convert to metrics array
  const metrics: ProjectMetrics[] = []
  projectHours.forEach((hours, projectId) => {
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      metrics.push({
        projectId,
        projectName: project.name,
        projectCode: project.code,
        totalHours: round2(hours.total),
        billableHours: round2(hours.billable),
        percentage: totalHours > 0 ? round2((hours.total / totalHours) * 100) : 0,
        color: project.color,
      })
    }
  })

  // Sort by total hours descending
  metrics.sort((a, b) => b.totalHours - a.totalHours)

  // Return top N + "Other" if needed
  if (metrics.length > topN) {
    const topMetrics = metrics.slice(0, topN)
    const otherMetrics = metrics.slice(topN)

    const otherTotal = otherMetrics.reduce((sum, m) => sum + m.totalHours, 0)
    const otherBillable = otherMetrics.reduce((sum, m) => sum + m.billableHours, 0)
    const otherPercentage = otherMetrics.reduce((sum, m) => sum + m.percentage, 0)

    if (otherTotal > 0) {
      topMetrics.push({
        projectId: "other",
        projectName: "Other Projects",
        projectCode: "OTHER",
        totalHours: round2(otherTotal),
        billableHours: round2(otherBillable),
        percentage: round2(otherPercentage),
        color: "#6B7280",
      })
    }

    return topMetrics
  }

  return metrics
}

export function aggregateByDay(timeEntries: TimeEntry[]) {
  // Backward compatible shape (omit absence here to avoid breaking callers); recompute nonBillable accordingly
  const byDay = summarizeByDay(timeEntries)
  const out: Record<string, { total: number; billable: number; nonBillable: number }> = {}
  for (const [date, d] of Object.entries(byDay)) {
    out[date] = { total: d.total, billable: d.billable, nonBillable: d.nonBillable }
  }
  return out
}
