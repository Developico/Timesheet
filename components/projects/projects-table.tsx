"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// Sheet removed in favor of shared ProjectDetailPanel
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye, ChevronUp, ChevronDown, Copy as CopyIcon } from "lucide-react"
import { ProjectDetailPanel } from "@/components/projects/project-detail-panel"
import { useFilters } from "@/lib/filter-context"
import { useConsultants } from "@/hooks/use-consultants"
import { useViewingScope } from "@/lib/viewing-scope"
import type { Project } from "@/lib/data"
import { useNewProjects, NEW_DAYS } from "@/lib/use-new-projects"
import { useAuth } from "@/lib/auth-client"
import { toast } from "@/hooks/use-toast"
import { useAggregatedDynamicCss } from "@/lib/dynamic-styles"
import { summarize } from "@/lib/time-entries-summary"

export function ProjectsTable() {
  const { filteredProjects, filteredTimeEntries, filters } = useFilters()
  const { newProjects, isNew, markViewed } = useNewProjects()
  // Sortable fields per requirement: Hours (computed), Name, Client, Code. Others static.
  const [sortField, setSortField] = useState<keyof Project | 'hours'>("hours")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectScope, setProjectScope] = useState<"my"|"all">("my")
  const [billableFilter, setBillableFilter] = useState<'all'|'yes'|'no'>('all')
  const [onlyReported, setOnlyReported] = useState<boolean>(false)
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

  // Precompute count of projects where current user has >0h in current filtered window
  const reportedProjectsCount = useMemo(()=> projectsWithMetrics.filter(p=> p.actualHours > 0).length, [projectsWithMetrics])
  // Count of projects that would appear under 'my' scope (ignoring search so it stays stable while typing)
  const myProjectsCount = useMemo(()=>{
    const effectiveUserId = currentUserId || null
    const myProjectIds = assignedIds
      ? assignedIds
      : effectiveUserId
        ? new Set(filteredTimeEntries.filter(e=> e.consultantId === effectiveUserId).map(e=> e.projectId))
        : new Set(filteredTimeEntries.map(e=> e.projectId))
    // Include projects marked allUsers explicitly or belonging to user via assignments/time entries
  return projectsWithMetrics.filter(p=> (p.allUsers === true) || myProjectIds.has(p.id)).length
  }, [assignedIds, filteredTimeEntries, projectsWithMetrics, currentUserId])
  // allProjectsCount computed after filteredAndSortedProjects is defined (placeholder, will set later)
  let allProjectsCount = 0

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
  allProjectsCount = filteredAndSortedProjects.length

  const handleSort = (field: keyof Project | 'hours') => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

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

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[projects-table] user aggregation snapshot', userAgg)
  }

  return (
    <div className="space-y-6 relative">
      {/* Summary metrics card (analogous to calendar view) */}
  <Card className="dark:bg-[var(--card)]">
  <CardContent className="py-4">
          <div className="grid grid-cols-4 gap-8 items-center">
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-purple-600 leading-none">{totalUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-token">Total Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-billable leading-none">{totalBillableUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-token">Billable Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              {/* eslint-disable-next-line */}
              <div className="text-2xl font-bold leading-none text-[#174076] dark:text-[#6e93c9]">{totalNonBillableUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-token">Non-billable Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-absence leading-none">{absenceUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-token">Absence Hours</div>
            </div>
          </div>
        </CardContent>
      </Card>
  <Card className="dark:bg-[var(--card)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <CardTitle>Projects ({filteredAndSortedProjects.length})</CardTitle>
              <div className="flex items-center rounded-lg border p-1 bg-background group-filter">
                <Button
                  type="button"
                  size="sm"
                  variant="surface"
                  className="h-7 px-3 text-xs data-[active=true]:shadow-sm"
                  data-active={projectScope==='my'}
                  onClick={()=>setProjectScope('my')}
                  title={assignedIds ? 'Assigned projects (plus ALL flagged)' : 'Projects you have time entries on (plus ALL flagged)'}
                >My Projects ({myProjectsCount})</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="surface"
                  className="h-7 px-3 text-xs data-[active=true]:shadow-sm"
                  data-active={projectScope==='all'}
                  onClick={()=>setProjectScope('all')}
                  title="All filtered projects"
                >All ({allProjectsCount})</Button>
              </div>
              <div className="flex items-center rounded-lg border p-1 bg-background group-filter">
                <Button
                  type="button"
                  size="sm"
                  variant="surface"
                  className="h-7 px-3 text-xs data-[active=true]:shadow-sm"
                  data-active={billableFilter==='all'}
                  onClick={()=>setBillableFilter('all')}
                >Billable: All</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="surface"
                  className="h-7 px-3 text-xs data-[active=true]:shadow-sm"
                  data-active={billableFilter==='yes'}
                  onClick={()=>setBillableFilter('yes')}
                >Yes</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="surface"
                  className="h-7 px-3 text-xs data-[active=true]:shadow-sm"
                  data-active={billableFilter==='no'}
                  onClick={()=>setBillableFilter('no')}
                >No</Button>
              </div>
              <div className="flex items-center rounded-lg border p-1 bg-background group-filter">
                <Button
                  type="button"
                  size="sm"
                  variant="surface"
                  className="h-7 px-3 text-xs data-[active=true]:shadow-sm"
                  data-active={onlyReported}
                  onClick={()=>setOnlyReported(o=>!o)}
                  title={`Projects with your hours in range: ${reportedProjectsCount}`}
                >Only Reported ({reportedProjectsCount})</Button>
              </div>
              <div className="relative">
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
                  <div className="absolute z-20 mt-1 min-w-[180px] rounded-md border bg-[var(--surface-overlay)] text-[var(--text-primary)] backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface-overlay)_/_90] p-2 shadow-lg flex flex-col gap-1 text-xs" aria-label="Toggle columns">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={cols.billable} onChange={e=> setCols(c=>({...c,billable:e.target.checked}))} /> Billable
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={cols.client} onChange={e=> setCols(c=>({...c,client:e.target.checked}))} /> Client
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={cols.allUsers} onChange={e=> setCols(c=>({...c,allUsers:e.target.checked}))} /> All Users
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
            <div />
          </div>
        </CardHeader>
        <CardContent>
          {/* (Summary moved to top card) */}
          <div className="rounded-md border bg-card dark:bg-[var(--surface-alt)] overflow-hidden">
            <div className="overflow-auto max-h-[70vh]">
            <Table className="projects-table table-sticky text-[13px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 left-0 z-20 bg-background min-w-[140px]">{/* Code column first & sticky */}
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
                {(() => {
                  const effectiveUserId = currentUserId || null
                  const myProjectIds = assignedIds
                    ? assignedIds
                    : effectiveUserId
                      ? new Set(filteredTimeEntries.filter(e=> e.consultantId === effectiveUserId).map(e=> e.projectId))
                      : new Set(filteredTimeEntries.map(e=> e.projectId))
                  const searching = (filters.searchQuery || '').trim().length > 0
                  let base = (projectScope==='my' && !searching)
                    ? filteredAndSortedProjects.filter(p=> (p.allUsers === true) || myProjectIds.has(p.id))
                    : filteredAndSortedProjects
                  if(billableFilter==='yes') base = base.filter(p=>p.billable)
                  else if(billableFilter==='no') base = base.filter(p=>!p.billable)
                  if(onlyReported) base = base.filter(p=> p.actualHours > 0)
                  if(base.length===0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-token">
                          {projectScope==='my' ? (assignedIds? 'No assigned projects' : 'No projects with your recent time entries – switch to All to browse all codes.') : 'No projects'}
                        </TableCell>
                      </TableRow>
                    )
                  }
                  const maxHours = base.reduce((m,p)=> p.actualHours>m ? p.actualHours : m, 0) || 0
                  // inject dynamic css for bars
                  useAggregatedDynamicCss('project-hours-bars', base.map((p,i)=>{
                    const widthPct = maxHours>0 ? (p.actualHours/maxHours)*100 : 0
                    const billablePct = p.actualHours>0 ? (p.billableHours/p.actualHours)*100 : 0
                    const billWidth = (widthPct*billablePct)/100
                    return `.projects-table [data-hours-index='${i}'] [data-bar-total]{width:${widthPct.toFixed(2)}%;}
.projects-table [data-hours-index='${i}'] [data-bar-billable]{width:${billWidth.toFixed(2)}%;}`
                  }).join('\n'))
                  return base.map((project, rowIndex) => {
                    const newForUser = isNew(project.id)
                    return (
                      <TableRow key={project.id} className={`hover:bg-muted/50 transition-colors ${newForUser?'ring-1 ring-[#6eedd9]':''}`}>
                        <TableCell className="sticky left-0 z-10 bg-background">
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
                          <div className="text-sm min-w-[70px]" title={`Your hours: ${project.actualHours.toFixed(1)}h (B ${project.billableHours.toFixed(1)} / NB ${(project.actualHours - project.billableHours).toFixed(1)})`}>
                            <div className="tabular-nums font-medium">{project.actualHours.toFixed(1)}h</div>
                            <div
                              className="hidden md:block h-1.5 w-full rounded bg-muted/70 overflow-hidden mt-1 relative"
                              title={`${project.actualHours.toFixed(1)}h total; ${project.billableHours.toFixed(1)}h billable`}
                              data-hours-index={rowIndex}
                            >
                              <div className="absolute inset-y-0 left-0 bg-[#6eedd9]/35" data-bar-total aria-hidden="true" />
                              <div className="absolute inset-y-0 left-0 bg-[#6eedd9]" data-bar-billable aria-label="Billable hours proportion" />
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
                })()}
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
