"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFilters } from "@/lib/filter-context"
import { dataService } from "@/lib/data"

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("week")
  const { filteredTimeEntries } = useFilters()
  const projects = dataService.getProjects()

  const sampleTimeEntries = [
    { id: "1", date: "2024-01-15", projectId: "1", hours: 8, billable: true, description: "Development work" },
    { id: "2", date: "2024-01-15", projectId: "2", hours: 2, billable: false, description: "Team meeting" },
    { id: "3", date: "2024-01-16", projectId: "1", hours: 6, billable: true, description: "Bug fixes" },
    {
      id: "4",
      date: "2024-01-16",
      projectId: "3",
      hours: 8,
      billable: false,
      description: "Vacation",
      isAbsence: true,
    },
    { id: "5", date: "2024-01-17", projectId: "2", hours: 4, billable: true, description: "Client consultation" },
    { id: "6", date: "2024-01-17", projectId: "4", hours: 4, billable: false, description: "Training" },
    { id: "7", date: "2024-01-18", projectId: "1", hours: 7, billable: true, description: "Feature development" },
    {
      id: "8",
      date: "2024-01-19",
      projectId: "5",
      hours: 8,
      billable: false,
      description: "Sick leave",
      isAbsence: true,
    },
  ]

  const enhancedProjects = [
    ...projects,
    { id: "3", code: "VAC", name: "Vacation", color: "#f59e0b", billable: false, assigned: true },
    { id: "5", code: "SICK", name: "Sick Leave", color: "#ef4444", billable: false, assigned: true },
  ]

  const getWeekDays = (date: Date) => {
    const week = []
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
    startOfWeek.setDate(diff)

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      week.push(day)
    }
    return week
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    return days
  }

  const getEntriesForDate = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    return sampleTimeEntries.filter((entry) => entry.date === dateStr)
  }

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      newDate.setDate(prev.getDate() + (direction === "prev" ? -7 : 7))
      return newDate
    })
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate)

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const dayEntries = getEntriesForDate(day)
            const totalHours = dayEntries.reduce((sum, entry) => sum + entry.hours, 0)
            const billableHours = dayEntries
              .filter((entry) => entry.billable)
              .reduce((sum, entry) => sum + entry.hours, 0)
            const nonBillableHours = totalHours - billableHours
            const hasAbsence = dayEntries.some((entry) => entry.isAbsence)
            const isToday = day.toDateString() === new Date().toDateString()
            const isWeekend = day.getDay() === 0 || day.getDay() === 6

            return (
              <Card
                key={index}
                className={`${isToday ? "ring-2 ring-teal-500" : ""} ${isWeekend ? "bg-muted/30" : ""}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{dayNames[index]}</div>
                      <div className="text-lg font-bold">{day.getDate()}</div>
                    </div>
                    {totalHours > 0 && (
                      <Badge
                        variant={hasAbsence ? "destructive" : totalHours >= 8 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {totalHours}h
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {dayEntries.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">No entries</div>
                  ) : (
                    <>
                      {dayEntries.map((entry, idx) => {
                        const project = enhancedProjects.find((p) => p.id === entry.projectId)
                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-2 rounded-md ${
                              entry.isAbsence
                                ? "bg-red-50 border border-red-200"
                                : entry.billable
                                  ? "bg-teal-50 border border-teal-200"
                                  : "bg-blue-50 border border-blue-200"
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: project?.color || "#8884d8" }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium truncate">{project?.code}</div>
                                {entry.isAbsence && <div className="text-xs text-red-600 font-medium">ABSENCE</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium">{entry.hours}h</span>
                              {entry.billable && <span className="text-xs">💰</span>}
                            </div>
                          </div>
                        )
                      })}
                      {billableHours > 0 || nonBillableHours > 0 ? (
                        <div className="pt-2 border-t space-y-1">
                          {billableHours > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-teal-700">Billable:</span>
                              <span className="font-medium text-teal-700">{billableHours}h</span>
                            </div>
                          )}
                          {nonBillableHours > 0 && (
                            <div className="flex justify-between text-xs">
                              <span style={{ color: "#174076" }}>Non-billable:</span>
                              <span className="font-medium" style={{ color: "#174076" }}>
                                {nonBillableHours}h
                              </span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    return (
      <div className="grid grid-cols-7 gap-2">
        {getDaysInMonth(currentDate).map((day, index) => {
          if (!day) {
            return <div key={index} className="p-2 h-24" />
          }

          const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
          const dayEntries = getEntriesForDate(dayDate)
          const totalHours = dayEntries.reduce((sum, entry) => sum + entry.hours, 0)
          const billableHours = dayEntries
            .filter((entry) => entry.billable)
            .reduce((sum, entry) => sum + entry.hours, 0)

          return (
            <div
              key={day}
              className="p-2 h-24 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer overflow-hidden"
            >
              <div className="text-sm font-medium mb-1">{day}</div>
              {dayEntries.length > 0 && (
                <div className="space-y-1">
                  {dayEntries.slice(0, 2).map((entry, idx) => {
                    const project = enhancedProjects.find((p) => p.id === entry.projectId)
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: project?.color || "#8884d8" }}
                        />
                        <span className="text-xs truncate">{project?.code}</span>
                        {entry.billable && <span className="text-xs">💰</span>}
                      </div>
                    )
                  })}
                  {dayEntries.length > 2 && (
                    <div className="text-xs text-muted-foreground">+{dayEntries.length - 2} more</div>
                  )}
                  <div className="flex gap-1 mt-1">
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      {totalHours.toFixed(1)}h
                    </Badge>
                    {billableHours > 0 && (
                      <Badge variant="outline" className="text-xs px-1 py-0 text-teal-700 border-teal-200">
                        💰{billableHours.toFixed(1)}h
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const currentWeekEntries =
    viewMode === "week"
      ? getWeekDays(currentDate).flatMap((day) => getEntriesForDate(day))
      : sampleTimeEntries.filter((entry) => {
          const entryDate = new Date(entry.date)
          return (
            entryDate.getMonth() === currentDate.getMonth() && entryDate.getFullYear() === currentDate.getFullYear()
          )
        })

  const periodSummary = {
    totalHours: currentWeekEntries.reduce((sum, entry) => sum + entry.hours, 0),
    billableHours: currentWeekEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0),
    nonBillableHours: currentWeekEntries
      .filter((entry) => !entry.billable)
      .reduce((sum, entry) => sum + entry.hours, 0),
    absenceHours: currentWeekEntries.filter((entry) => entry.isAbsence).reduce((sum, entry) => sum + entry.hours, 0),
  }

  return (
    <div className="space-y-6">
      {/* Horizontal Summary Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-700">{periodSummary.billableHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Billable Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: "#174076" }}>
                {periodSummary.nonBillableHours.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">Non-billable Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{periodSummary.absenceHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Absence Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{periodSummary.totalHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Total Hours</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expanded Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                {viewMode === "week"
                  ? `Week of ${getWeekDays(currentDate)[0].toLocaleDateString()}`
                  : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
              </CardTitle>
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="h-7 px-3 text-xs"
                >
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="h-7 px-3 text-xs"
                >
                  Week
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => (viewMode === "week" ? navigateWeek("prev") : navigateMonth("prev"))}
              >
                ←
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (viewMode === "week" ? navigateWeek("next") : navigateMonth("next"))}
              >
                →
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "week" ? (
            <>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {dayNames.map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              {renderWeekView()}
            </>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              {renderMonthView()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
