"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useFilters } from "@/lib/filter-context"
import { dataService } from "@/lib/data"

function useAnimatedCounter(end: number, duration = 1000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)

      setCount(Math.floor(progress * end))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration])

  return count
}

export function ActiveProjectsCard() {
  const { filteredTimeEntries, filters } = useFilters()
  const projects = dataService.getProjects()

  const projectHours = filteredTimeEntries.reduce(
    (acc, entry) => {
      acc[entry.projectId] = (acc[entry.projectId] || 0) + entry.hours
      return acc
    },
    {} as Record<string, number>,
  )

  // Add sample data if no entries exist
  const sampleProjectHours = {
    "proj-1": 45.5,
    "proj-2": 32.8,
    "proj-3": 28.2,
    "proj-4": 19.7,
    "proj-5": 12.3,
  }

  const finalProjectHours = Object.keys(projectHours).length > 0 ? projectHours : sampleProjectHours

  const sortedProjects = Object.entries(finalProjectHours)
    .sort(([, a], [, b]) => b - a)
    .slice(0, Math.max(filters.topN, 5))

  const totalHours = Object.values(finalProjectHours).reduce((sum, hours) => sum + hours, 0)

  const brandColors = ["#6eedd9", "#174076", "#e03768", "#9169f4", "#150628"]

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm bg-white dark:bg-gray-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Active Projects</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">Average 72% completed</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedProjects.map(([projectId, hours], index) => {
          const project = projects.find((p) => p.id === projectId)
          const percentage = totalHours > 0 ? (hours / totalHours) * 100 : 0
          const projectNames = ["E-commerce Platform", "Mobile App", "API Integration", "Dashboard", "Website Redesign"]
          const projectName = project?.name || projectNames[index] || `Project ${index + 1}`
          const completionPercentages = [85, 72, 94, 58, 43]
          const completion = completionPercentages[index] || Math.floor(Math.random() * 40) + 60

          return (
            <div key={projectId} className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: project?.color || brandColors[index % brandColors.length],
                    }}
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-white">{projectName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {project?.code || `PRJ-${index + 1}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">{completion}%</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{hours.toFixed(1)}h</div>
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${completion}%`,
                    backgroundColor: project?.color || brandColors[index % brandColors.length],
                  }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function HoursSummaryChart() {
  // const { filteredTimeEntries } = useFilters() // (reserved for future real data aggregation)
  const [viewMode, setViewMode] = useState<"weekly" | "daily">("weekly")
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Sample data for hours summary with absences
  type WeeklyPoint = { week: string; billable: number; nonBillable: number; absence: number; total: number }
  type DailyPoint = { day: string; billable: number; nonBillable: number; absence: number; total: number }

  const weeklyData: WeeklyPoint[] = [
    { week: "Week 1", billable: 32.5, nonBillable: 7.5, absence: 0, total: 40 },
    { week: "Week 2", billable: 28.0, nonBillable: 4.0, absence: 8, total: 40 },
    { week: "Week 3", billable: 35.2, nonBillable: 4.8, absence: 0, total: 40 },
    { week: "Week 4", billable: 30.1, nonBillable: 5.9, absence: 4, total: 40 },
  ]

  const dailyData: DailyPoint[] = [
    { day: "Mon", billable: 6.5, nonBillable: 1.5, absence: 0, total: 8.0 },
    { day: "Tue", billable: 7.2, nonBillable: 0.8, absence: 0, total: 8.0 },
    { day: "Wed", billable: 0, nonBillable: 0, absence: 8, total: 8.0 },
    { day: "Thu", billable: 8.1, nonBillable: 0.4, absence: 0, total: 8.5 },
    { day: "Fri", billable: 6.9, nonBillable: 1.1, absence: 0, total: 8.0 },
  ]

  interface UnifiedPoint { label: string; billable: number; nonBillable: number; absence: number; total: number }
  const base = viewMode === 'weekly' ? weeklyData : dailyData
  const currentData: UnifiedPoint[] = base.map(p => ({
    label: 'week' in p ? p.week : p.day,
    billable: p.billable,
    nonBillable: p.nonBillable,
    absence: p.absence,
    total: p.total,
  }))
  const maxTotal = Math.max(...currentData.map((d) => d.total))

  // Calculate totals for the period
  const totalBillable = currentData.reduce((sum, d) => sum + d.billable, 0)
  const totalNonBillable = currentData.reduce((sum, d) => sum + d.nonBillable, 0)
  const totalAbsence = currentData.reduce((sum, d) => sum + d.absence, 0)
  const grandTotal = totalBillable + totalNonBillable + totalAbsence

  const animatedBillable = useAnimatedCounter(totalBillable, 1200)
  const animatedNonBillable = useAnimatedCounter(totalNonBillable, 1400)
  const animatedAbsence = useAnimatedCounter(totalAbsence, 1600)
  const animatedTotal = useAnimatedCounter(grandTotal, 1800)

  return (
    <Card className="hover:shadow-xl transition-all duration-300 border-0 shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div
          className={`transition-all duration-700 ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`}
        >
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Hours Summary</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">Reported hours breakdown</p>
        </div>
        <div
          className={`flex gap-1 transition-all duration-700 delay-200 ${isVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
        >
          <Button
            variant={viewMode === "weekly" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("weekly")}
            className="text-xs px-3 py-1 transition-all duration-200 hover:scale-105"
          >
            Weekly
          </Button>
          <Button
            variant={viewMode === "daily" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("daily")}
            className="text-xs px-3 py-1 transition-all duration-200 hover:scale-105"
          >
            Daily
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-700 delay-300 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        >
          <div className="text-center group hover:scale-110 transition-transform duration-300">
            <div className="text-lg font-bold animate-pulse" style={{ color: "#14b8a6" }}>
              {animatedBillable.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-500">Billable</div>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 delay-500"
                style={{
                  width: isVisible ? "100%" : "0%",
                  backgroundColor: "#6eedd9",
                }}
              />
            </div>
          </div>
          <div className="text-center group hover:scale-110 transition-transform duration-300">
            <div className="text-lg font-bold" style={{ color: "#174076" }}>
              {animatedNonBillable.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-500">Non-billable</div>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 delay-700"
                style={{
                  width: isVisible ? "100%" : "0%",
                  backgroundColor: "#174076",
                }}
              />
            </div>
          </div>
          <div className="text-center group hover:scale-110 transition-transform duration-300">
            <div className="text-lg font-bold" style={{ color: "#dc2626" }}>
              {animatedAbsence.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-500">Absence</div>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 delay-900"
                style={{
                  width: isVisible ? "100%" : "0%",
                  backgroundColor: "#e03768",
                }}
              />
            </div>
          </div>
          <div className="text-center group hover:scale-110 transition-transform duration-300">
            <div className="text-lg font-bold" style={{ color: "#7c3aed" }}>
              {animatedTotal.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-500">Total</div>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 delay-1100"
                style={{
                  width: isVisible ? "100%" : "0%",
                  backgroundColor: "#9169f4",
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {currentData.map((item, index) => {
            const billablePercentage = maxTotal > 0 ? (item.billable / maxTotal) * 100 : 0
            const nonBillablePercentage = maxTotal > 0 ? (item.nonBillable / maxTotal) * 100 : 0
            const absencePercentage = maxTotal > 0 ? (item.absence / maxTotal) * 100 : 0

            return (
              <div
                key={index}
                className={`space-y-2 transition-all duration-500 hover:scale-[1.02] hover:shadow-md rounded-lg p-2 -m-2`}
                style={{
                  transitionDelay: `${index * 100 + 600}ms`,
                  transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                  opacity: isVisible ? 1 : 0,
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {item.label}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white animate-pulse">
                    {item.total.toFixed(1)}h
                  </span>
                </div>
                <div className="flex w-full h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="transition-all duration-1000"
                    style={{
                      width: isVisible ? `${billablePercentage}%` : "0%",
                      backgroundColor: "#6eedd9",
                      transitionDelay: `${index * 150 + 800}ms`,
                    }}
                    title={`Billable: ${item.billable.toFixed(1)}h`}
                  />
                  <div
                    className="transition-all duration-1000"
                    style={{
                      width: isVisible ? `${nonBillablePercentage}%` : "0%",
                      backgroundColor: "#174076",
                      transitionDelay: `${index * 150 + 900}ms`,
                    }}
                    title={`Non-billable: ${item.nonBillable.toFixed(1)}h`}
                  />
                  <div
                    className="transition-all duration-1000"
                    style={{
                      width: isVisible ? `${absencePercentage}%` : "0%",
                      backgroundColor: "#e03768",
                      transitionDelay: `${index * 150 + 1000}ms`,
                    }}
                    title={`Absence: ${item.absence.toFixed(1)}h`}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="transition-colors" style={{ color: "#14b8a6" }}>
                    B: {item.billable.toFixed(1)}h
                  </span>
                  <span className="transition-colors" style={{ color: "#174076" }}>
                    NB: {item.nonBillable.toFixed(1)}h
                  </span>
                  {item.absence > 0 && (
                    <span className="transition-colors" style={{ color: "#dc2626" }}>
                      A: {item.absence.toFixed(1)}h
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div
          className={`flex gap-4 pt-2 border-t border-gray-100 dark:border-gray-800 transition-all duration-700 delay-1200 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        >
          <div className="flex items-center gap-2 text-sm hover:scale-110 transition-transform duration-200 cursor-pointer">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: "#6eedd9" }} />
            <span className="text-gray-600 dark:text-gray-400 hover:text-teal-600 transition-colors">Billable</span>
          </div>
          <div className="flex items-center gap-2 text-sm hover:scale-110 transition-transform duration-200 cursor-pointer">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#174076" }} />
            <span className="text-gray-600 dark:text-gray-400 hover:text-blue-800 transition-colors">Non-billable</span>
          </div>
          <div className="flex items-center gap-2 text-sm hover:scale-110 transition-transform duration-200 cursor-pointer">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: "#e03768" }} />
            <span className="text-gray-600 dark:text-gray-400 hover:text-red-600 transition-colors">Absence</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function Charts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ActiveProjectsCard />
      <HoursSummaryChart />
    </div>
  )
}
