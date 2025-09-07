import type { TimeEntry, KPIMetrics, ProjectMetrics } from "@/types"

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

  const reportedHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0)
  const billableHours = timeEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0)

  const realizedPercentage = requiredHours > 0 ? (reportedHours / requiredHours) * 100 : 0
  const billablePercentage = reportedHours > 0 ? (billableHours / reportedHours) * 100 : 0

  // Count unique projects
  const activeProjects = new Set(timeEntries.map((entry) => entry.projectId)).size

  return {
    reportedHours: Math.round(reportedHours * 10) / 10,
    requiredHours,
    realizedPercentage: Math.round(realizedPercentage * 10) / 10,
    billableHours: Math.round(billableHours * 10) / 10,
    billablePercentage: Math.round(billablePercentage * 10) / 10,
    activeProjects,
  }
}

export function calculateProjectMetrics(
  timeEntries: TimeEntry[],
  projects: { id: string; name: string; code: string; color: string }[],
  topN = 5,
): ProjectMetrics[] {
  const projectHours = new Map<string, { total: number; billable: number }>()

  // Aggregate hours by project
  timeEntries.forEach((entry) => {
    const current = projectHours.get(entry.projectId) || { total: 0, billable: 0 }
    current.total += entry.hours
    if (entry.billable) {
      current.billable += entry.hours
    }
    projectHours.set(entry.projectId, current)
  })

  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0)

  // Convert to metrics array
  const metrics: ProjectMetrics[] = []
  projectHours.forEach((hours, projectId) => {
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      metrics.push({
        projectId,
        projectName: project.name,
        projectCode: project.code,
        totalHours: Math.round(hours.total * 10) / 10,
        billableHours: Math.round(hours.billable * 10) / 10,
        percentage: totalHours > 0 ? Math.round((hours.total / totalHours) * 1000) / 10 : 0,
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
        totalHours: Math.round(otherTotal * 10) / 10,
        billableHours: Math.round(otherBillable * 10) / 10,
        percentage: Math.round(otherPercentage * 10) / 10,
        color: "#6B7280",
      })
    }

    return topMetrics
  }

  return metrics
}

export function aggregateByDay(
  timeEntries: TimeEntry[],
): Record<string, { total: number; billable: number; nonBillable: number }> {
  const dailyData: Record<string, { total: number; billable: number; nonBillable: number }> = {}

  timeEntries.forEach((entry) => {
    if (!dailyData[entry.date]) {
      dailyData[entry.date] = { total: 0, billable: 0, nonBillable: 0 }
    }

    dailyData[entry.date].total += entry.hours
    if (entry.billable) {
      dailyData[entry.date].billable += entry.hours
    } else {
      dailyData[entry.date].nonBillable += entry.hours
    }
  })

  // Round values
  Object.keys(dailyData).forEach((date) => {
    dailyData[date].total = Math.round(dailyData[date].total * 10) / 10
    dailyData[date].billable = Math.round(dailyData[date].billable * 10) / 10
    dailyData[date].nonBillable = Math.round(dailyData[date].nonBillable * 10) / 10
  })

  return dailyData
}
