"use client"

import { useState, useEffect, useMemo } from "react"
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
import { ViewingBanner } from "@/components/admin/viewing-banner"
import { ConsultantDock } from "@/components/admin/consultant-dock"
import { useProjects } from "@/hooks/use-projects"
import { useConsultants } from "@/hooks/use-consultants"
import { useTimeEntries } from "@/hooks/use-time-entries"
import { useFilters, FilterProvider } from "@/lib/filter-context"
import { usePathname, useRouter } from "next/navigation"

export default function HomePage() {
  const pathname = usePathname() || '/'
  const router = useRouter()
  // Cookie helpers for tab persistence
  const readCookie = (name: string) => {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\[\]\\/+^]/g, '\\$&') + '=([^;]*)'))
    return match ? decodeURIComponent(match[1]) : null
  }
  const writeCookie = (name: string, value: string, days = 180) => {
    if (typeof document === 'undefined') return
    const d = new Date(); d.setTime(d.getTime() + days*24*60*60*1000)
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`
  }
  // Compute initial tab from URL or cookie
  const initialTab = useMemo(() => {
    // Explicit routes
    if (pathname.startsWith('/projects')) return 'projects' as const
    if (pathname.startsWith('/calendar')) return 'calendar' as const
    if (pathname.startsWith('/dashboard')) return 'dashboard' as const
    // Root '/' should always open Dashboard (do not override with cookie)
    if (pathname === '/') return 'dashboard' as const
    // Fallback to cookie only for unknown paths
    const saved = readCookie('tt_tab') as 'dashboard'|'calendar'|'projects'|null
    if (saved === 'projects' || saved === 'calendar' || saved === 'dashboard') return saved
    return 'dashboard' as const
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "projects">(initialTab)
  // Persist tab to cookie and optionally update URL
  useEffect(() => {
    writeCookie('tt_tab', activeTab)
    // Keep URL in sync, but avoid rewriting between '/' and '/dashboard' unnecessarily.
    if (activeTab === 'dashboard') {
      if (pathname === '/' || pathname.startsWith('/dashboard')) return
      router.replace('/dashboard')
      return
    }
    if (activeTab === 'projects') {
      if (!pathname.startsWith('/projects')) router.replace('/projects')
      return
    }
    if (activeTab === 'calendar') {
      if (!pathname.startsWith('/calendar')) router.replace('/calendar')
      return
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])
  // viewMode state reserved for future UI switcher (currently unused)

  const { user, isLoading: authLoading } = useAuth()
  // Data fetched via hooks (Dataverse or mock depending on feature flag)
  const { projects: rawProjects, loading: projectsLoading } = useProjects()
  const { consultants, loading: consultantsLoading } = useConsultants()
  // Dynamic date range based on filter context (defaults handled inside provider)
  // We consume filters after provider is mounted (render split pattern below).
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
  allUsers: (p as any).allUsers,
  }))
  // We create a child component that consumes filters to avoid provider ordering issues
  const loading = projectsLoading || consultantsLoading || authLoading

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
  <FilterProvider initialTimeEntries={[]} projects={[]}>
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

  function RangeDrivenApp(){
    const { filters, setTimeEntries } = useFilters()
    const now = new Date()
    function fmt(d: Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
    let start: Date; let end: Date
    const currentQuarter = Math.floor(now.getMonth()/3)
    switch(filters.dateRange){
      case 'this-week': {
        const monday = new Date(now); monday.setDate(now.getDate() - now.getDay() + 1)
        start = monday; end = new Date(monday); end.setDate(monday.getDate()+6); break
      }
      case 'this-quarter': {
        start = new Date(now.getFullYear(), currentQuarter*3, 1)
        end = new Date(now.getFullYear(), (currentQuarter+1)*3, 0); break
      }
      case 'this-year': {
        start = new Date(now.getFullYear(),0,1); end = new Date(now.getFullYear(),11,31); break
      }
      case 'previous-week': {
        const monday = new Date(now); monday.setDate(now.getDate() - now.getDay() + 1 -7)
        start = monday; end = new Date(monday); end.setDate(monday.getDate()+6); break
      }
      case 'previous-month': {
        start = new Date(now.getFullYear(), now.getMonth()-1,1); end = new Date(now.getFullYear(), now.getMonth(),0); break
      }
      case 'previous-quarter': {
        const prevQ = currentQuarter-1 < 0 ? 3 : currentQuarter-1
        const year = currentQuarter-1 < 0 ? now.getFullYear()-1 : now.getFullYear()
        start = new Date(year, prevQ*3,1); end = new Date(year,(prevQ+1)*3,0); break
      }
      case 'previous-year': {
        start = new Date(now.getFullYear()-1,0,1); end = new Date(now.getFullYear()-1,11,31); break
      }
      case 'this-month':
      default: {
        start = new Date(now.getFullYear(), now.getMonth(),1); end = new Date(now.getFullYear(), now.getMonth()+1,0); break
      }
    }
    const range = { from: fmt(start), to: fmt(end) }
  const { entries: timeEntries, loading: entriesLoading } = useTimeEntries({ ...range, billable: 'all' })
  useEffect(()=>{ if(!entriesLoading) setTimeEntries(timeEntries) }, [entriesLoading, timeEntries, setTimeEntries])
  const fullLoading = loading || entriesLoading
    return (
  <>
        <AppHeader />
        <ViewingBanner />
        <FilterBar />
        <NavigationTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="py-8">
          {fullLoading && (
            <div className="text-sm text-muted-foreground px-6 pb-4">Loading time entries...</div>
          )}
          {!fullLoading && activeTab === "dashboard" && (
            <div className="space-y-6">
              <KPICards />
              <Charts />
            </div>
          )}
          {!fullLoading && activeTab === "calendar" && <CalendarView />}
          {!fullLoading && activeTab === "projects" && <ProjectsTable />}
        </main>
        <ConsultantDock />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <FilterProvider initialTimeEntries={[]} projects={projects}>
        <RangeDrivenApp />
      </FilterProvider>
    </div>
  )
}
