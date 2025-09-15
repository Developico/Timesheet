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
        allUsers: project.assigned === false ? false : project.assigned || false, // placeholder semantics; original code referenced p.allUsers
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
    return projectsWithMetrics.filter(p=> p.allUsers || myProjectIds.has(p.id)).length
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

  const userEntries = useMemo(()=>{
    if(scopedConsultant) return filteredTimeEntries.filter(e=> e.consultantId === scopedConsultant)
    if(primaryConsultantId) return filteredTimeEntries.filter(e=> e.consultantId === primaryConsultantId)
    return filteredTimeEntries
  }, [filteredTimeEntries, scopedConsultant, primaryConsultantId])
  const totalUserHours = userEntries.reduce((s,e)=>s+e.hours,0)
  const totalBillableUserHours = userEntries.filter(e=>e.billable).reduce((s,e)=>s+e.hours,0)
  const totalNonBillableUserHours = totalUserHours - totalBillableUserHours
  // Absence hours: project code exactly 'Office.Absences' (or name containing 'absence')
  const absenceProjectIds = filteredProjects.filter(p=> p.code === 'Office.Absences' || p.name?.toLowerCase().includes('absence')).map(p=>p.id)
  const absenceUserHours = userEntries.filter(e=> absenceProjectIds.includes(e.projectId)).reduce((s,e)=>s+e.hours,0)

  return (
    <div className="space-y-6 relative">
      {/* Summary metrics card (analogous to calendar view) */}
  <Card className="dark:bg-[oklch(0.18_0_0)]">
  <CardContent className="py-4">
          <div className="grid grid-cols-4 gap-8 items-center">
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-purple-600 leading-none">{totalUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Total Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-teal-700 dark:text-teal-400 leading-none">{totalBillableUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Billable Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              {/* eslint-disable-next-line */}
              <div className="text-2xl font-bold leading-none text-[#174076] dark:text-[#6e93c9]">{totalNonBillableUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Non-billable Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-red-600 leading-none">{absenceUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Absence Hours</div>
            </div>
          </div>
        </CardContent>
      </Card>
  <Card className="dark:bg-[oklch(0.18_0_0)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <CardTitle>Projects ({filteredAndSortedProjects.length})</CardTitle>
              <div className="flex items-center rounded-lg border p-1 bg-background">
                <Button
                  type="button"
                  size="sm"
                  variant={projectScope==='my'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setProjectScope('my')}
                  title={assignedIds ? 'Assigned projects (plus ALL flagged)' : 'Projects you have time entries on (plus ALL flagged)'}
                >My Projects ({myProjectsCount})</Button>
                <Button
                  type="button"
                  size="sm"
                  variant={projectScope==='all'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setProjectScope('all')}
                  title="All filtered projects"
                >All ({allProjectsCount})</Button>
              </div>
              <div className="flex items-center rounded-lg border p-1 bg-background">
                <Button
                  type="button"
                  size="sm"
                  variant={billableFilter==='all'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setBillableFilter('all')}
                >Billable: All</Button>
                <Button
                  type="button"
                  size="sm"
                  variant={billableFilter==='yes'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setBillableFilter('yes')}
                >Yes</Button>
                <Button
                  type="button"
                  size="sm"
                  variant={billableFilter==='no'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setBillableFilter('no')}
                >No</Button>
              </div>
              <div className="flex items-center rounded-lg border p-1 bg-background">
                <Button
                  type="button"
                  size="sm"
                  variant={onlyReported? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setOnlyReported(o=>!o)}
                  title={`Projects with your hours in range: ${reportedProjectsCount}`}
                >Only Reported ({reportedProjectsCount})</Button>
              </div>
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant={showColumnMenu? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=> setShowColumnMenu(s=>!s)}
                  title="Toggle optional columns"
                >Columns</Button>
                {showColumnMenu && (
                  <div className="absolute z-20 mt-1 min-w-[180px] rounded-md border bg-background p-2 shadow-lg flex flex-col gap-1 text-xs">
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
                      className="mt-1 text-[10px] text-muted-foreground hover:text-foreground self-end"
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
          <div className="rounded-md border bg-card dark:bg-[oklch(0.19_0_0)] overflow-hidden">
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
                    ? filteredAndSortedProjects.filter(p=> p.allUsers || myProjectIds.has(p.id))
                    : filteredAndSortedProjects
                  if(billableFilter==='yes') base = base.filter(p=>p.billable)
                  else if(billableFilter==='no') base = base.filter(p=>!p.billable)
                  if(onlyReported) base = base.filter(p=> p.actualHours > 0)
                  if(base.length===0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                          {projectScope==='my' ? (assignedIds? 'No assigned projects' : 'No projects with your recent time entries – switch to All to browse all codes.') : 'No projects'}
                        </TableCell>
                      </TableRow>
                    )
                  }
                  return base.map(project => {
                    const newForUser = isNew(project.id)
                    return (
                      <TableRow key={project.id} className={`hover:bg-muted/50 transition-colors ${newForUser?'ring-1 ring-[#6eedd9]':''}`}>
                        <TableCell className="sticky left-0 z-10 bg-background">
                          <div className="flex items-center gap-2 min-w-[140px] pr-2">
                            {(() => {
                              const isAbsence = project.code === 'Office.Absences' || project.name?.toLowerCase().includes('absence')
                              const colorClass = isAbsence ? 'bg-red-600' : (project.billable ? 'bg-teal-500' : 'bg-[#174076]')
                              const label = isAbsence ? 'Absence' : (project.billable ? 'Billable' : 'Non-billable')
                              return <div className={`w-3 h-3 rounded-full ${colorClass}`} title={label} aria-label={label} />
                            })()}
                            <span className="font-mono text-sm flex items-center gap-1">
                              {project.code}
                              {newForUser && <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-[#6eedd9]/20 text-teal-700 border border-teal-300">NEW</span>}
                            </span>
                            <button
                              type="button"
                              onClick={()=>{navigator.clipboard?.writeText(project.code).then(()=> toast({ title: 'Copied', description: `${project.code} copied to clipboard` })).catch(()=>{}); markViewed(project.id)}}
                              className="p-1 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-border"
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
                            {cols.client && <span className="text-[10px] text-muted-foreground sm:hidden">{project.client}</span>}
                            {project.allUsers && cols.allUsers && <span className="sm:hidden text-[10px] text-teal-600 dark:text-teal-400">ALL USERS</span>}
                          </div>
                        </TableCell>
                        {cols.allUsers && (
                          <TableCell className="mobile-hidden">
                            { project.allUsers ? (
                              <Badge variant="outline" className="text-[10px] px-1 py-0.5 bg-teal-600/10 border-teal-600/40 text-teal-700 dark:text-teal-400">ALL</Badge>
                            ) : <span className="text-muted-foreground text-xs">-</span> }
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="text-sm min-w-[70px]" title={`Your hours: ${project.actualHours.toFixed(1)}h (B ${project.billableHours.toFixed(1)} / NB ${(project.actualHours - project.billableHours).toFixed(1)})`}>
                            <div className="tabular-nums font-medium">{project.actualHours.toFixed(1)}h</div>
                            <div className="hidden md:block h-1 w-full rounded bg-muted overflow-hidden mt-1">
                              {(() => {
                                const pct = project.actualHours>0 ? (project.billableHours / project.actualHours) * 100 : 0
                                const bucket = Math.round(pct) // 0..100
                                // Use CSS variable through data attribute; a small utility in globals can map this
                                return <div className="h-full bg-teal-500" data-pct={bucket} />
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
                })()}
              </TableBody>
            </Table>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 ring-1 ring-[#6eedd9] rounded-sm" /> <span>Recently added (&lt;={NEW_DAYS} days)</span>
            </div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line */}
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-teal-500"></span> Billable</span>
              {/* eslint-disable-next-line */}
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-[#174076]"></span> Non-billable</span>
              {/* eslint-disable-next-line */}
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-600"></span> Absence</span>
            </div>
            {newProjects.length>0 && <div className="text-teal-600">New for you: {newProjects.length}</div>}
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
