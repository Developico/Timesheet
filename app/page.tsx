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
import { useProjects } from "@/hooks/use-projects"
import { useConsultants } from "@/hooks/use-consultants"
import { useTimeEntries } from "@/hooks/use-time-entries"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "projects">("dashboard")
  // viewMode state reserved for future UI switcher (currently unused)

  const { user, isLoading: authLoading } = useAuth()
  // Data fetched via hooks (Dataverse or mock depending on feature flag)
  const { projects: rawProjects, loading: projectsLoading } = useProjects()
  const { consultants, loading: consultantsLoading } = useConsultants()
  // Default time range: current month
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth()+1, 0)
  const range = {
    from: `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`,
    to: `${to.getFullYear()}-${String(to.getMonth()+1).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`
  }
  const { entries: timeEntries, loading: entriesLoading } = useTimeEntries({ ...range, billable: 'all' })
  // Adapt raw projects to legacy Project shape expected by FilterProvider (fill safe defaults)
  const projects = rawProjects.map(p => ({
    id: p.id,
    name: p.name,
    client: (p as any).client || '',
    code: p.code || p.id.slice(0,6),
    color: (p as any).color || '#6366f1',
  status: 'active' as const,
    totalHours: 0,
    budget: 0,
    progress: 0,
    startDate: new Date().toISOString().substring(0,10),
    billable: (p as any).billable ?? true,
    assigned: (p as any).assigned ?? true,
    metaproject: (p as any).meta,
    note: (p as any).note,
  }))
  const loading = projectsLoading || consultantsLoading || entriesLoading || authLoading

  // Legacy effect removed (hooks handle fetching)

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
