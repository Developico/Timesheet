"use client"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/layout/navbar"
import { FilterBar } from "@/components/layout/filter-bar"
import { NavigationTabs } from "@/components/layout/navigation-tabs"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { Charts } from "@/components/dashboard/charts"
import { CalendarView } from "@/components/calendar/calendar-view"
import { ProjectsTable } from "@/components/projects/projects-table"
import { FilterProvider } from "@/lib/filter-context"
import { dataService } from "@/lib/data"
import type { TimeEntry, Project, Consultant } from "@/lib/data"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "projects">("dashboard")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [entriesData, projectsData, consultantsData] = await Promise.all([
          Promise.resolve(dataService.getTimeEntries()),
          Promise.resolve(dataService.getProjects()),
          Promise.resolve(dataService.getConsultants()),
        ])

        setTimeEntries(entriesData)
        setProjects(projectsData)
        setConsultants(consultantsData)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <FilterProvider timeEntries={[]} projects={[]}>
          <Navbar />
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading timesheet data...</p>
            </div>
          </div>
        </FilterProvider>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <FilterProvider timeEntries={timeEntries} projects={projects}>
        <Navbar />
        <FilterBar viewMode={viewMode} onViewModeChange={setViewMode} />
        <NavigationTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="container px-6 py-8">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <KPICards />
              <Charts />
            </div>
          )}

          {activeTab === "calendar" && <CalendarView />}

          {activeTab === "projects" && <ProjectsTable />}
        </main>
      </FilterProvider>
    </div>
  )
}
