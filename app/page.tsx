"use client"

import { useState, useEffect, useMemo } from "react"
import { HeaderWrapper } from "@/components/layout/header-wrapper"
import { useAuth } from "@/lib/auth-client"
import { SignInScreen } from "@/components/auth/signin-screen"
import { FilterBar } from "@/components/layout/filter-bar"
import { NavigationTabs } from "@/components/layout/navigation-tabs"
import { KPICards } from "@/components/dashboard/kpi-cards"
import dynamic from 'next/dynamic'
const Charts = dynamic(()=> import('@/components/dashboard/charts').then(m=> m.Charts), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" data-charts-skeleton>
  <div className="h-72 rounded-xl border bg-muted/30 dark:bg-[color:var(--surface-elev)_/_40] animate-pulse relative overflow-hidden lg:col-span-2">
        <div className="absolute inset-0 flex flex-col p-4 gap-4">
          <div className="h-4 w-40 bg-muted/60 dark:bg-[color:var(--surface-overlay)_/_30] rounded" />
          <div className="mt-2 flex-1 grid grid-rows-6 gap-2">
            {Array.from({length:6}).map((_,r)=> <div key={r} className="w-full h-full bg-muted/40 dark:bg-[color:var(--surface-overlay)_/_25] rounded" />)}
          </div>
        </div>
      </div>
  <div className="h-72 rounded-xl border bg-muted/30 dark:bg-[color:var(--surface-elev)_/_40] animate-pulse relative overflow-hidden lg:col-span-3">
        <div className="absolute inset-0 flex flex-col p-4 gap-4">
          <div className="h-4 w-40 bg-muted/60 dark:bg-[color:var(--surface-overlay)_/_30] rounded" />
          <div className="mt-2 flex-1 grid grid-rows-6 gap-2">
            {Array.from({length:6}).map((_,r)=> <div key={r} className="w-full h-full bg-muted/40 dark:bg-[color:var(--surface-overlay)_/_25] rounded" />)}
          </div>
        </div>
      </div>
    </div>
  )
})
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
  interface RawProjectLike { id: string; name: string; code?: string | null; client?: string | null }
  const projects = rawProjects.map(p => {
    const rp = p as RawProjectLike & { color?: string; billable?: boolean; assigned?: boolean; meta?: string; note?: string; allUsers?: string[] }
    return {
      id: rp.id,
      name: rp.name,
      client: rp.client || '',
      code: rp.code || rp.id.slice(0,6),
      color: rp.color || '#6366f1',
      status: 'active' as const,
      totalHours: 0,
      budget: 0,
      progress: 0,
      startDate: new Date().toISOString().substring(0,10),
      billable: rp.billable ?? true,
      assigned: rp.assigned ?? true,
      metaproject: rp.meta,
      note: rp.note,
      allUsers: rp.allUsers,
    }
  })
  // We create a child component that consumes filters to avoid provider ordering issues
  const loading = projectsLoading || consultantsLoading || authLoading

  // Legacy effect removed (hooks handle fetching)

  // Listen for global events from header (new project shortcuts)
  useEffect(()=>{
    type TabDetail = { tab?: 'dashboard' | 'calendar' | 'projects' }
    const handleSetTab = (e: Event) => {
      const de = e as CustomEvent<TabDetail>
      if(de.detail?.tab) setActiveTab(de.detail.tab)
    }
    const handleOpenProject = (_e: Event) => {
      /* placeholder for project open side effects */
    }
    window.addEventListener('ts:setActiveTab', handleSetTab)
    window.addEventListener('ts:openProject', handleOpenProject)
    return ()=> {
      window.removeEventListener('ts:setActiveTab', handleSetTab)
      window.removeEventListener('ts:openProject', handleOpenProject)
    }
  },[])

  // While auth session resolving show minimal spinner only (no data providers)
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-xs text-muted-foreground">Authenticating…</p>
        </div>
      </div>
    )
  }

  // Not authenticated -> show sign-in landing (no header, no providers required)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SignInScreen productName="Timesheet" />
      </div>
    )
  }

  // Authenticated but lacking required app role (Unauthorized)
  if (user.role === 'Unauthorized') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">Brak dostępu</h1>
          <p className="text-sm text-muted-foreground">Twoje konto zostało poprawnie uwierzytelnione, ale nie znajduje się w wymaganych grupach aplikacji. Skontaktuj się z administratorem aby uzyskać dostęp.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={()=>{ window.location.href = '/api/auth/signout' }}
              className="text-xs underline text-muted-foreground hover:text-foreground"
            >Wyloguj</button>
          </div>
        </div>
      </div>
    )
  }

  // Data loading (projects/consultants) after we know user is authorized
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <FilterProvider initialTimeEntries={[]} projects={[]}>
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Ładowanie danych…</p>
            </div>
          </div>
        </FilterProvider>
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
  <HeaderWrapper />
  <ViewingBanner />
        <FilterBar />
        <NavigationTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="py-8">
          {fullLoading && (
            <div className="text-sm text-muted-foreground px-6 pb-4">Loading time entries...</div>
          )}
          {!fullLoading && activeTab === "dashboard" && (
            <div className="space-y-8 mobile-px" data-dashboard-root>
              {/* KPI cards full-width: removed max-w constraint & centering */}
              <div className="space-y-6 w-full" data-kpi-wrap data-layout="full-width-kpi">
                <KPICards />
              </div>
              <div data-charts-section>
                {/* Full-width container aligned with KPI cards: no negative margins, relies on outer padding of dashboard root */}
                <div className="pb-3" data-charts-scroll>
                  <Charts />
                </div>
              </div>
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
