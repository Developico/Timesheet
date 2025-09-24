"use client"

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// Sheet removed in favor of shared ProjectDetailPanel
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye, ChevronUp, ChevronDown, Copy as CopyIcon, X } from "lucide-react"
import { ProjectDetailPanel } from "@/components/projects/project-detail-panel"
import { useFilters } from "@/lib/filter-context"
import { useConsultants } from "@/hooks/use-consultants"
import { useViewingScope } from "@/lib/viewing-scope"
import { formatHours } from "@/lib/time-entries-summary"
import type { Project } from "@/lib/data"
import type { TimeEntry } from "@/types"
import { useNewProjects, NEW_DAYS } from "@/lib/use-new-projects"
import { useAuth } from "@/lib/auth-client"
import { toast } from "@/hooks/use-toast"
import { useAggregatedDynamicCss } from "@/lib/dynamic-styles"
import { summarize } from "@/lib/time-entries-summary"

export function ProjectsTable() {
  const filtersContext = useFilters()
  const { filteredProjects, filteredTimeEntries, filters } = filtersContext
  const allTimeEntries = (filtersContext as any).normalizedEntries as TimeEntry[] || []
  const allProjectsUnfiltered = (filtersContext as any).allProjects as Project[] || []
  const { newProjects, isNew, markViewed } = useNewProjects()
  // Sortable fields per requirement: Hours (computed), Name, Client, Code. Others static.
  const [sortField, setSortField] = useState<keyof Project | 'hours'>("hours")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  
  // Persistent project filters - use lazy initialization from localStorage
  const [projectScope, setProjectScope] = useState<"my"|"all">(() => {
    if (typeof window === 'undefined') return "my"
    try {
      const saved = window.localStorage.getItem('tt_project_filters')
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.projectScope || "my"
      }
    } catch {}
    return "my"
  })
  
  const [billableFilter, setBillableFilter] = useState<'all'|'yes'|'no'>(() => {
    if (typeof window === 'undefined') return 'all'
    try {
      const saved = window.localStorage.getItem('tt_project_filters')
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.billableFilter || 'all'
      }
    } catch {}
    return 'all'
  })
  
  const [onlyReported, setOnlyReported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const saved = window.localStorage.getItem('tt_project_filters')
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.onlyReported || false
      }
    } catch {}
    return false
  })
  
  // Debug state changes - remove in production
  // useEffect(() => { console.log('Project scope changed to:', projectScope) }, [projectScope])
  // useEffect(() => { console.log('Billable filter changed to:', billableFilter) }, [billableFilter])  
  // useEffect(() => { console.log('Only reported changed to:', onlyReported) }, [onlyReported])
  
  // Load sorting from localStorage on mount
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('tt_project_sorting') : null
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.sortField) setSortField(parsed.sortField)
        if (parsed.sortDirection) setSortDirection(parsed.sortDirection)
      }
    } catch {
      // ignore errors
    }
  }, [])
  
    // Save project filters to localStorage when they change
    try {
      if (typeof window !== 'undefined') {
        const data = {
          projectScope,
          billableFilter,
          onlyReported
        }
        window.localStorage.setItem('tt_project_filters', JSON.stringify(data))
      }
    } catch (e) {
      // ignore
    }  // Save sorting to localStorage when it changes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('tt_project_sorting', JSON.stringify({
          sortField,
          sortDirection
        }))
      }
    } catch {
      // ignore errors
    }
  }, [sortField, sortDirection])
  // Refs to hold latest filter state for event listeners
  const projectScopeRef = useRef(projectScope)
  const billableFilterRef = useRef(billableFilter)
  const onlyReportedRef = useRef(onlyReported)
  useEffect(()=>{ projectScopeRef.current = projectScope }, [projectScope])
  useEffect(()=>{ billableFilterRef.current = billableFilter }, [billableFilter])
  useEffect(()=>{ onlyReportedRef.current = onlyReported }, [onlyReported])
  const [assignedIds, setAssignedIds] = useState<Set<string>|null>(null)
  // Column visibility preferences (persisted)
  const defaultCols = { billable: true, client: true, allUsers: true }
  const [cols, setCols] = useState<{billable:boolean;client:boolean;allUsers:boolean}>(defaultCols)
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const { consultants } = useConsultants()
  const { consultantId: scopedConsultant } = useViewingScope()
  const { user } = useAuth()
  const currentUserEmail = user?.email?.toLowerCase() || null
  const currentUserId = scopedConsultant || consultants.find(c=> c.email && c.email.toLowerCase() === currentUserEmail)?.id || null
  const primaryConsultantId = currentUserId
  
  // Initialize assigned projects for current user
  useEffect(() => {
    let ignore = false
    if (!currentUserId) return
    
    fetch('/api/dataverse/project-assignments', { 
      cache: 'default',
      // Add cache headers to respect cache for 15 minutes like other endpoints
      headers: {
        'Cache-Control': 'max-age=900' // 15 minutes
      }
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to fetch assignments')))
      .then(json => {
        if (!ignore && Array.isArray(json.value)) {
          setAssignedIds(new Set(json.value))
        }
      })
      .catch(err => {
        console.warn('Failed to load project assignments:', err)
        // Keep assignedIds as null - fallback to time-based calculation
      })
    
    return () => { ignore = true }
  }, [currentUserId])

  // Persist column visibility preferences
  useEffect(()=>{
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('tt_project_table_cols') : null
      if(raw){
        const parsed = JSON.parse(raw)
        setCols(c=> ({...c, ...parsed}))
      }
    } catch { /* ignore */ }
  }, [])
  useEffect(()=>{
    try { if (typeof window !== 'undefined') window.localStorage.setItem('tt_project_table_cols', JSON.stringify(cols)) } catch { /* ignore */ }
  }, [cols])

  // Build extended project metrics once per dependency change
  const projectsWithMetrics = useMemo(()=>{
    return filteredProjects.map(project => {
      const entries = filteredTimeEntries.filter(e=> e.projectId === project.id)
      const userEntries = currentUserId ? entries.filter(e=> e.consultantId === currentUserId) : entries
      const userHours = userEntries.reduce((s,e)=> s+e.hours,0)
      const userBillableHours = userEntries.filter(e=>e.billable).reduce((s,e)=> s+e.hours,0)
      const assignedConsultants = [...new Set(entries.map(e=> e.consultantId))]
      return {
        ...project,
        actualHours: userHours,
        billableHours: userBillableHours,
        assignedConsultants,
        billablePercentage: userHours > 0 ? (userBillableHours / userHours) * 100 : 0,
        // Preserve real allUsers flag only if explicitly true; do not infer from 'assigned'.
  allUsers: (project as any).allUsers === true,
      }
    })
  }, [filteredProjects, filteredTimeEntries, currentUserId])

  // Build metrics for ALL projects (unfiltered) for counter calculations  
  const allProjectsWithMetrics = useMemo(()=>{
    return allProjectsUnfiltered.map(project => {
      const entries = allTimeEntries.filter(e=> e.projectId === project.id)
      const userEntries = currentUserId ? entries.filter(e=> e.consultantId === currentUserId) : entries
      const userHours = userEntries.reduce((s,e)=> s+e.hours,0)
      const userBillableHours = userEntries.filter(e=>e.billable).reduce((s,e)=> s+e.hours,0)
      return {
        ...project,
        actualHours: userHours,
        billableHours: userBillableHours,
        allUsers: (project as any).allUsers === true,
      }
    })
  }, [allProjectsUnfiltered, allTimeEntries, currentUserId])

  const filteredAndSortedProjects = useMemo(()=>{
    const arr = [...projectsWithMetrics]
    const direction = sortDirection === 'asc' ? 1 : -1
    arr.sort((a,b)=>{
      if (sortField === 'hours') return (a.actualHours - b.actualHours) * direction
      const aValue = a[sortField]
      const bValue = b[sortField]
      if (typeof aValue === 'string' && typeof bValue === 'string') return aValue.localeCompare(bValue) * direction
      if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * direction
      return 0
    })
    return arr
  }, [projectsWithMetrics, sortField, sortDirection])

  // Common helper to compute myProjectIds - uses global time entries for fallback
  const myProjectIds = useMemo(() => {
    const effectiveUserId = currentUserId || null
    return assignedIds
      ? assignedIds
      : effectiveUserId
        ? new Set(allTimeEntries.filter(e=> e.consultantId === effectiveUserId).map(e=> e.projectId))
        : new Set(allTimeEntries.map(e=> e.projectId))
  }, [assignedIds, currentUserId, allTimeEntries])

  // Base for all computations - applies search filtering
  const searchFiltered = useMemo(() => {
    const searching = (filters.searchQuery || '').trim().length > 0
    if (!searching) return filteredAndSortedProjects
    return filteredAndSortedProjects // search is already applied in filter context
  }, [filteredAndSortedProjects, filters.searchQuery])

  // Project Scope filtering bases - for counters use ALL projects, for display use filtered
  const myProjectsForCounts = useMemo(() => {
    // For counters, always use time entries based calculation regardless of assignments
    const effectiveUserId = currentUserId || null
    const timeBasedProjectIds = effectiveUserId
      ? new Set(allTimeEntries.filter(e=> e.consultantId === effectiveUserId).map(e=> e.projectId))
      : new Set(allTimeEntries.map(e=> e.projectId))
    
    return allProjectsWithMetrics.filter(p=> (p.allUsers === true) || timeBasedProjectIds.has(p.id))
  }, [allProjectsWithMetrics, currentUserId, allTimeEntries])

  const allProjectsForCounts = useMemo(() => {
    return projectsWithMetrics  // Use filtered projects with metrics instead of all projects
  }, [projectsWithMetrics, projectScope])

  // For table display, use filtered projects
  const myProjects = useMemo(() => {
    return searchFiltered.filter(p=> (p.allUsers === true) || myProjectIds.has(p.id))
  }, [searchFiltered, myProjectIds])

  const allProjects = useMemo(() => {
    return searchFiltered
  }, [searchFiltered])

  // Base for table filtering - applies all filters and sorting
  const baseForReportedFilter = useMemo(() => {
    let base = projectScope === 'my' ? myProjectsForCounts : allProjectsForCounts  // Use scope-appropriate projects
    if(billableFilter==='yes') base = base.filter(p=>p.billable)
    else if(billableFilter==='no') base = base.filter(p=>!p.billable)
    return base
  }, [projectScope, myProjectsForCounts, allProjectsForCounts, billableFilter])

  // Final rows for the table - use the computed baseForReportedFilter and apply final filters and sorting
  const tableRows = useMemo(()=>{
    let base = baseForReportedFilter
    if(onlyReported) base = base.filter(p=> p.actualHours > 0)
    
    // Apply sorting to final table data
    const direction = sortDirection === 'asc' ? 1 : -1
    base.sort((a,b)=>{
      if (sortField === 'hours') return (a.actualHours - b.actualHours) * direction
      const aValue = a[sortField]
      const bValue = b[sortField]
      if (typeof aValue === 'string' && typeof bValue === 'string') return aValue.localeCompare(bValue) * direction
      if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * direction
      return 0
    })
    
    return base
  }, [baseForReportedFilter, onlyReported, sortField, sortDirection])

  // Inject bar widths CSS for visible rows (always call hook to keep hooks order consistent)
  const hoursBarsCss = useMemo(()=>{
    const base = tableRows
    const maxHours = base.reduce((m,p)=> p.actualHours>m ? p.actualHours : m, 0) || 0
    return base.map((p,i)=>{
      const widthPct = maxHours>0 ? (p.actualHours/maxHours)*100 : 0
      const billablePct = p.actualHours>0 ? (p.billableHours/p.actualHours)*100 : 0
      const billWidth = (widthPct*billablePct)/100
      return `.projects-table [data-hours-index='${i}'] [data-bar-total]{width:${widthPct.toFixed(2)}%;}\n.projects-table [data-hours-index='${i}'] [data-bar-billable]{width:${billWidth.toFixed(2)}%;}`
    }).join('\n')
  }, [tableRows])
  useAggregatedDynamicCss('project-hours-bars', hoursBarsCss)

  const handleSort = (field: keyof Project | 'hours') => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Reset filters to default state (My / All / All)
  const resetFilters = () => {
    setProjectScope('my')
    setBillableFilter('all')
    setOnlyReported(false)
  }

  // Check if filters are in non-default state
  const hasNonDefaultFilters = projectScope !== 'my' || billableFilter !== 'all' || onlyReported !== false

  // Status column removed per requirement; helper no longer needed.

  const SortButton = ({ field, children }: { field: keyof Project | 'hours'; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-medium hover:bg-transparent"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field &&
          (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </div>
    </Button>
  )

  // Totals for summary bar (current filtered time entries for user)
  // Scope summary to active consultant: ViewingScope overrides; else current user detected by email; else first consultant; else all
  // primaryConsultantId already computed above for per-project aggregation

  const userEntries = useMemo(() => {
    if (scopedConsultant) return filteredTimeEntries.filter(e=> e.consultantId === scopedConsultant)
    if (primaryConsultantId) return filteredTimeEntries.filter(e=> e.consultantId === primaryConsultantId)
    return filteredTimeEntries
  }, [filteredTimeEntries, scopedConsultant, primaryConsultantId])
  // Attach project metadata for robust absence classification in summary
  const projectsById = useMemo(()=> new Map(filteredProjects.map(p=> [p.id, p])), [filteredProjects])
  const userAgg = summarize(userEntries.map(e=> ({...e, project: projectsById.get(e.projectId)})) as any)
  const totalUserHours = userAgg.total
  const totalBillableUserHours = userAgg.billable
  const totalNonBillableUserHours = userAgg.nonBillable
  const absenceUserHours = userAgg.absence

  // Broadcast current filter state so mobile sheet can reflect active buttons
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('tt:projects:state', {
      detail: {
        scope: projectScope,
        billable: billableFilter,
        onlyReported,
        projectCount: tableRows.length, // Add project count
      }
    }))
  }, [projectScope, billableFilter, onlyReported, tableRows.length])

  // Listen to mobile options events to adjust local filters without prop drilling
  useEffect(()=>{
    const setScope = (e: Event) => {
      const ce = e as CustomEvent<{ scope?: 'my'|'all' }>
      if(ce.detail?.scope) setProjectScope(ce.detail.scope)
    }
    const setBillable = (e: Event) => {
      const ce = e as CustomEvent<{ billable?: 'all'|'yes'|'no' }>
      if(ce.detail?.billable) setBillableFilter(ce.detail.billable)
    }
    const toggleReported = () => setOnlyReported(o=>!o)
    const setColumns = (e: Event) => {
      const ce = e as CustomEvent<{ billable?: boolean; client?: boolean; allUsers?: boolean; reset?: boolean }>
      if(ce.detail?.reset){ setCols(defaultCols); return }
      setCols(c=> ({
        billable: ce.detail?.billable ?? c.billable,
        client: ce.detail?.client ?? c.client,
        allUsers: ce.detail?.allUsers ?? c.allUsers,
      }))
    }
    window.addEventListener('tt:projects:set-scope', setScope)
    window.addEventListener('tt:projects:set-billable', setBillable)
    window.addEventListener('tt:projects:toggle-only-reported', toggleReported)
    const replyState = () => {
      try {
        window.dispatchEvent(new CustomEvent('tt:projects:state', {
          detail: {
            scope: projectScopeRef.current,
            billable: billableFilterRef.current,
            onlyReported: onlyReportedRef.current,
          }
        }))
      } catch {}
    }
    window.addEventListener('tt:projects:request-state', replyState)
    window.addEventListener('tt:projects:set-columns', setColumns)
    return ()=>{
      window.removeEventListener('tt:projects:set-scope', setScope)
      window.removeEventListener('tt:projects:set-billable', setBillable)
      window.removeEventListener('tt:projects:toggle-only-reported', toggleReported)
      window.removeEventListener('tt:projects:request-state', replyState)
      window.removeEventListener('tt:projects:set-columns', setColumns)
    }
  }, [])

  return (
    <div className="space-y-6 relative">
      {/* Summary metrics card (analogous to calendar view) */}
  <Card className="dark:bg-[var(--card)]">
  <CardContent className="py-4">
          {/* Mobile: 2x2 grid, Desktop: 1x4 grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-8 items-center">
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-purple-600 leading-none tabular-nums">{formatHours(totalUserHours)}</div>
              <div className="text-xs text-muted-token whitespace-nowrap"><span className="sm:hidden">Total</span><span className="hidden sm:inline">Total Hours</span></div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-billable leading-none tabular-nums">{formatHours(totalBillableUserHours)}</div>
              <div className="text-xs text-muted-token whitespace-nowrap"><span className="sm:hidden">Billable</span><span className="hidden sm:inline">Billable Hours</span></div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              {/* eslint-disable-next-line */}
              <div className="text-2xl font-bold leading-none text-[#174076] dark:text-[#6e93c9] tabular-nums">{formatHours(totalNonBillableUserHours)}</div>
              <div className="text-xs text-muted-token whitespace-nowrap"><span className="sm:hidden">Non‑billable</span><span className="hidden sm:inline">Non‑billable Hours</span></div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-absence leading-none tabular-nums">{formatHours(absenceUserHours)}</div>
              <div className="text-xs text-muted-token whitespace-nowrap"><span className="sm:hidden">Absence</span><span className="hidden sm:inline">Absence Hours</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
  <Card className="dark:bg-[var(--card)]">
        <CardHeader>
            <div className="flex items-center justify-between">
              {/* Three toggle groups in horizontal layout with fixed widths - HIDDEN ON MOBILE */}
              <div className="hidden lg:flex items-center gap-4 flex-wrap min-w-0">
                {/* Group 1: Project Scope - My/All */}
                <div className="flex items-center rounded-full border p-1 bg-background">
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    className="h-7 px-4 text-xs data-[active=true]:shadow-sm rounded-full min-w-[50px]"
                    data-active={projectScope==='my'}
                    onClick={()=>setProjectScope('my')}
                    title={assignedIds ? 'Assigned projects (plus ALL flagged)' : 'Projects you have time entries on (plus ALL flagged)'}
                  >My</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    className="h-7 px-4 text-xs data-[active=true]:shadow-sm rounded-full min-w-[50px]"
                    data-active={projectScope==='all'}
                    onClick={()=>setProjectScope('all')}
                    title="All filtered projects"
                  >All</Button>
                </div>
                
                {/* Group 2: Billable Filter - Billable/Non-billable/All */}
                <div className="flex items-center rounded-full border p-1 bg-background">
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    className="h-7 px-4 text-xs data-[active=true]:shadow-sm rounded-full min-w-[90px] tabular-nums"
                    data-active={billableFilter==='yes'}
                    onClick={()=>setBillableFilter('yes')}
                  >Billable</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    className="h-7 px-4 text-xs data-[active=true]:shadow-sm rounded-full min-w-[110px] tabular-nums"
                    data-active={billableFilter==='no'}
                    onClick={()=>setBillableFilter('no')}
                  >Non-billable</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    className="h-7 px-4 text-xs data-[active=true]:shadow-sm rounded-full min-w-[70px] tabular-nums"
                    data-active={billableFilter==='all'}
                    onClick={()=>setBillableFilter('all')}
                  >All</Button>
                </div>
                
                {/* Group 3: Reported Filter - Reported/All */}
                <div className="flex items-center rounded-full border p-1 bg-background">
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    className="h-7 px-4 text-xs data-[active=true]:shadow-sm rounded-full min-w-[90px] tabular-nums"
                    data-active={onlyReported}
                    onClick={()=>setOnlyReported(true)}
                    title="Projects with your hours in range"
                  >Reported</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    className="h-7 px-4 text-xs data-[active=true]:shadow-sm rounded-full min-w-[70px] tabular-nums"
                    data-active={!onlyReported}
                    onClick={()=>setOnlyReported(false)}
                    title="All filtered projects"
                  >All</Button>
                </div>
                
                {/* Results counter - ALWAYS VISIBLE */}
                <div className="text-sm text-muted-foreground px-2">
                  {tableRows.length} {tableRows.length === 1 ? 'project' : 'projects'}
                </div>
                
                {/* Reset filters button - visible only when filters are changed, HIDDEN ON MOBILE */}
                {hasNonDefaultFilters && (
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    className="hidden lg:flex h-7 px-4 text-xs rounded-full border transition-all hover:shadow-sm active:scale-95"
                    data-active={false}
                    onClick={resetFilters}
                    title="Reset filters to default (My / All / All)"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            <div className="relative ml-auto hidden md:block">
              <Button
                type="button"
                size="sm"
                variant="surface"
                className="h-7 px-3 text-xs data-[active=true]:shadow-sm"
                data-active={showColumnMenu}
                onClick={()=> setShowColumnMenu(s=>!s)}
                title="Toggle optional columns"
                aria-haspopup="menu"
                aria-expanded={showColumnMenu}
              >Columns</Button>
              {showColumnMenu && (
                <div className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-md border bg-[var(--surface-overlay)] text-[var(--text-primary)] backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface-overlay)_/_90] p-2 shadow-lg flex flex-col gap-1 text-xs" aria-label="Toggle columns">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-teal" checked={cols.billable} onChange={e=> setCols(c=>({...c,billable:e.target.checked}))} /> Billable
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-teal" checked={cols.client} onChange={e=> setCols(c=>({...c,client:e.target.checked}))} /> Client
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-teal" checked={cols.allUsers} onChange={e=> setCols(c=>({...c,allUsers:e.target.checked}))} /> All Users
                  </label>
                  <button
                    type="button"
                    onClick={()=>{ setCols(defaultCols); }}
                    className="mt-1 text-[10px] text-muted-token hover:text-foreground self-end"
                  >Reset</button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* (Summary moved to top card) */}
          <div className="rounded-md border bg-card dark:bg-[var(--surface-alt)] overflow-hidden">
            <div className="overflow-auto max-h-[70vh]">
            <Table className="projects-table table-sticky text-[13px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 left-0 z-20 bg-background w-12 text-center text-xs text-muted-foreground">#</TableHead>
                  <TableHead className="sticky top-0 left-0 z-20 bg-background min-w-[140px] pl-2">{/* Code column first & sticky */}
                    <SortButton field="code">Code</SortButton>
                  </TableHead>
                  {cols.billable && <TableHead className="mobile-hidden sticky top-0 bg-background">Billable</TableHead>}
                  {cols.client && <TableHead className="mobile-hidden sticky top-0 bg-background"><SortButton field="client">Client</SortButton></TableHead>}
                  <TableHead className="sticky top-0 bg-background"><SortButton field="name">Name</SortButton></TableHead>
                  {cols.allUsers && <TableHead className="mobile-hidden sticky top-0 bg-background">All Users</TableHead>}
                  <TableHead className="sticky top-0 bg-background"><SortButton field="hours">Hrs</SortButton></TableHead>
                  <TableHead className="sticky top-0 bg-background w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.length===0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-sm text-muted-token">
                      {projectScope==='my' ? (assignedIds? 'No assigned projects' : 'No projects with your recent time entries – switch to All to browse all codes.') : 'No projects'}
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.map((project, rowIndex) => {
                    const newForUser = isNew(project.id)
                    return (
                      <TableRow key={project.id} className={`hover:bg-muted/50 transition-colors ${newForUser?'ring-1 ring-[#6eedd9]':''}`}>
                        <TableCell className="sticky left-0 z-10 bg-background w-12 text-center">
                          <span className="text-xs text-gray-300 dark:text-gray-600 font-mono opacity-90">{rowIndex + 1}</span>
                        </TableCell>
                        <TableCell className="sticky left-0 z-10 bg-background pl-2">
                          <div className="flex items-center gap-2 min-w-[140px] pr-2">
                            {(() => {
                              const isAbsence = project.code === 'Office.Absences' || project.name?.toLowerCase().includes('absence')
                              const colorClass = isAbsence ? 'bg-[#e03768]' : (project.billable ? 'bg-[#6eedd9]' : 'bg-[#174076]')
                              const label = isAbsence ? 'Absence' : (project.billable ? 'Billable' : 'Non-billable')
                              return <div className={`w-3 h-3 rounded-full ${colorClass}`} title={label} aria-label={label} />
                            })()}
                            <span className="font-mono text-sm flex items-center gap-1">
                              {project.code}
                              {newForUser && <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-[#6eedd9]/20 text-[#174076] border border-[#6eedd9]">NEW</span>}
                            </span>
                            <button
                              type="button"
                              onClick={()=>{navigator.clipboard?.writeText(project.code).then(()=> toast({ title: 'Copied', description: `${project.code} copied to clipboard` })).catch(()=>{}); markViewed(project.id)}}
                              className="p-1 rounded hover:bg-muted/60 text-muted-token/50 hover:text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-border"
                              title="Copy project code"
                            >
                              <CopyIcon className="h-3 w-3" />
                              <span className="sr-only">Copy code {project.code}</span>
                            </button>
                          </div>
                        </TableCell>
                        {cols.billable && (
                          <TableCell className="mobile-hidden">
                            <Badge variant={project.billable ? "default" : "secondary"} className="text-[10px]">
                              {project.billable ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                        )}
                        {cols.client && <TableCell className="font-medium mobile-hidden">{project.client}</TableCell>}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span>{project.name}</span>
                            {cols.client && <span className="text-[10px] text-muted-token sm:hidden">{project.client}</span>}
                            {project.allUsers === true && cols.allUsers && <span className="sm:hidden text-[10px] text-billable">ALL USERS</span>}
                          </div>
                        </TableCell>
                        {cols.allUsers && (
                          <TableCell className="mobile-hidden">
                            { project.allUsers === true ? (
                              <Badge variant="outline" className="text-[10px] px-1 py-0.5 bg-[#6eedd9]/10 border-[#6eedd9]/40 text-billable">ALL</Badge>
                            ) : <span className="text-muted-token text-xs">-</span> }
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="text-sm min-w-[70px]" title={`Your hours: ${formatHours(project.actualHours)} (B ${formatHours(project.billableHours)} / NB ${formatHours(project.actualHours - project.billableHours)})`}>
                            <div className="tabular-nums font-medium">{formatHours(project.actualHours)}</div>
                            <div
                              className="hidden md:block h-1.5 w-full rounded bg-muted/70 overflow-hidden mt-1 relative"
                              title={`${formatHours(project.actualHours)} total; ${formatHours(project.billableHours)} billable`}
                              data-hours-index={rowIndex}
                            >
                              {(() => {
                                const isAbsence = project.code === 'Office.Absences' || project.name?.toLowerCase().includes('absence')
                                const barTrackClass = isAbsence ? 'bg-[#e03768]/35' : (project.billable ? 'bg-[#6eedd9]/35' : 'bg-[#174076]/35')
                                // make billable slightly softer like others and add shimmer
                                const barFillClass = isAbsence
                                  ? 'bg-[#e03768] bar-shimmer'
                                  : (project.billable ? 'bg-[#6eedd9]/85 bar-shimmer' : 'bg-[#174076] bar-shimmer')
                                return (
                                  <>
                                    <div className={`absolute inset-y-0 left-0 ${barTrackClass}`} data-bar-total aria-hidden="true" />
                                    <div className={`absolute inset-y-0 left-0 ${barFillClass}`} data-bar-billable aria-label="Billable hours proportion" />
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedProject(project); markViewed(project.id) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-token">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 ring-1 ring-[#6eedd9] rounded-sm" /> <span>Recently added (&lt;={NEW_DAYS} days)</span>
            </div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line */}
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-[#6eedd9]"></span> Billable</span>
              {/* eslint-disable-next-line */}
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-[#174076]"></span> Non-billable</span>
              {/* eslint-disable-next-line */}
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-[#e03768]"></span> Absence</span>
            </div>
            {newProjects.length>0 && <div className="text-billable">New for you: {newProjects.length}</div>}
            <div>Scope: {projectScope==='my' ? (assignedIds? 'projects you are assigned to' : 'projects you have time entries on (current filters applied)') : 'all filtered projects'}</div>
          </div>
        </CardContent>
      </Card>
  {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
            entries={filteredTimeEntries.filter(e=>e.projectId===selectedProject.id)}
            scopeLabel="filtered entries"
            onClose={()=>setSelectedProject(null)}
        />
      )}
    </div>
  )
}
