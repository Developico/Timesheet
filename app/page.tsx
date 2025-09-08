"use client"

import { useState, useEffect } from "react"
import { AppHeader } from "@/components/layout/app-header"
import { useAuth } from "@/lib/auth-client"
import Link from "next/link"
import { SignInScreen } from "@/components/auth/signin-screen"
import { FilterBar } from "@/components/layout/filter-bar"
import { NavigationTabs } from "@/components/layout/navigation-tabs"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { Charts } from "@/components/dashboard/charts"
import { CalendarView } from "@/components/calendar/calendar-view"
import { ProjectsTable } from "@/components/projects/projects-table"
import { FilterProvider } from "@/lib/filter-context"
import { ViewingScopeProvider } from "@/lib/viewing-scope"
import { ViewingBanner } from "@/components/admin/viewing-banner"
import { ConsultantDock } from "@/components/admin/consultant-dock"
import { dataService } from "@/lib/data"
import type { TimeEntry, Project, Consultant } from "@/lib/data"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "projects">("dashboard")
  // viewMode state reserved for future UI switcher (currently unused)

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)
  const { user, isLoading: authLoading } = useAuth()

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

  // Listen for global events from header (new project shortcuts)
  useEffect(()=>{
    const handleSetTab = (e: any) => {
      if(e.detail?.tab) setActiveTab(e.detail.tab)
    }
    const handleOpenProject = (e: any) => {
      // store project id temporarily in sessionStorage; ProjectsTable will read event
      // (Direct open handled within its own listener already added earlier patch)
    }
    window.addEventListener('ts:setActiveTab', handleSetTab as any)
    window.addEventListener('ts:openProject', handleOpenProject as any)
    return ()=> {
      window.removeEventListener('ts:setActiveTab', handleSetTab as any)
      window.removeEventListener('ts:openProject', handleOpenProject as any)
    }
  },[])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <FilterProvider timeEntries={[]} projects={[]}>
          <AppHeader />
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

  // Not authenticated -> show sign-in landing (no data exposure)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader />
        <SignInScreen productName="Timesheet" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <ViewingScopeProvider>
        <FilterProvider timeEntries={timeEntries} projects={projects}>
          <AppHeader />
          <ViewingBanner />
          <FilterBar />
          <NavigationTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="py-8">
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <KPICards />
                <Charts />
              </div>
            )}
            {activeTab === "calendar" && <CalendarView />}
            {activeTab === "projects" && <ProjectsTable />}
          </main>
          <ConsultantDock />
        </FilterProvider>
      </ViewingScopeProvider>
    </div>
  )
}
